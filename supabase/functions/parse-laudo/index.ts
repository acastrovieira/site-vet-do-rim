import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import {
  containClinicalInference,
  getCorsHeaders,
  MAX_PDF_BYTES,
  readBoundedJsonResponse,
  readRequestBody,
} from "./contracts.ts";
import type { Database, LaudoIaErrorCode, LaudoIaProviderCode } from "./database.types.ts";

type VetDoRimClient = ReturnType<typeof createClient<Database>>;

const DEFAULT_ALLOWED_ORIGINS = ["https://vetdorim.com.br", "https://www.vetdorim.com.br"];
const extraOrigins = (Deno.env.get("PARSE_LAUDO_EXTRA_ORIGINS") ?? "").split(",").map(o => o.trim()).filter(o => /^https?:\/\/[a-z0-9.:-]+$/i.test(o));
const ALLOWED_ORIGINS = [...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AI_OUTPUT_BYTES = 256 * 1024;
const PROVENANCE_MAX_BYTES = 8 * 1024;

// AUDIT-001 Fase 2 (Tarefa 2.3): versao do SYSTEM_PROMPT/estrategia de extracao,
// gravada em ia_provenance a cada laudo finalizado para permitir reproduzir
// "qual prompt gerou este resultado". INCREMENTE este valor (data.sequencia)
// toda vez que o texto de SYSTEM_PROMPT ou a estrategia de extracao mudar.
const PROMPT_VERSION = "2026-07-18.1";

/**
 * Erros de autenticação/autorização usam 401/403/503; falhas de processamento
 * mantêm o contrato lógico lido pelo cliente. Toda resposta permanece no-store.
 */
function ok(body: Record<string, unknown>, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function unauthorized(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: "Não autorizado. Faça login novamente." }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function forbidden(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: "Acesso profissional não autorizado." }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function authorizationUnavailable(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: "Não foi possível validar a autorização." }), {
    status: 503,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function methodNotAllowed(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: "Metodo nao permitido." }), {
    status: 405,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Allow": "POST, OPTIONS",
    },
  });
}

function isPdf(buffer: ArrayBuffer) {
  if (buffer.byteLength < 5 || buffer.byteLength > MAX_PDF_BYTES) return false;
  const signature = new Uint8Array(buffer, 0, 5);
  return String.fromCharCode(...signature) === "%PDF-";
}

// AUDIT-001 Fase 2 (Tarefa 2.2): erro tipado que carrega, na origem da falha, o
// error_code (dentro da allowlist da migration 20260718110000) e o retryable
// corretos para refund_laudo_ia. Substitui o antigo failureCode() baseado em
// sniff de texto no catch geral — cada ponto de falha agora declara sua propria
// classificacao em vez de ser adivinhada a partir da mensagem.
class ProviderFailure extends Error {
  constructor(
    message: string,
    public readonly errorCode: LaudoIaErrorCode,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderFailure";
  }
}

/**
 * Bucketiza o status HTTP de um provedor de IA na allowlist de error_code.
 * 429 => rate limit (retryable); 5xx => indisponibilidade transitoria (retryable);
 * demais 4xx => resposta rejeitada pelo provedor (nao-retryable, ex.: payload
 * invalido aceito por engano, chave sem permissao, etc.).
 */
function providerStatusFailure(provider: string, status: number): ProviderFailure {
  if (status === 429) {
    return new ProviderFailure(`${provider} retornou erro 429.`, "provider_rate_limited", true);
  }
  if (status >= 500) {
    return new ProviderFailure(`${provider} retornou erro ${status}.`, "provider_unavailable", true);
  }
  return new ProviderFailure(`${provider} retornou erro ${status}.`, "provider_rejected", false);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * Classifica qualquer erro capturado no handler principal em (error_code da
 * allowlist, retryable, mensagem) para alimentar refund_laudo_ia. ProviderFailure
 * ja carrega essa classificacao na origem; qualquer outro erro (verdadeiramente
 * inesperado — bug, falha de rede ao chamar a propria RPC, etc.) cai no
 * fallback worker_crashed/retryable=true, que permite a um novo claim
 * (mesmo laudo, nova tentativa) recuperar o processamento.
 */
function classifyUnknown(error: unknown): { code: LaudoIaErrorCode; retryable: boolean; message: string } {
  if (error instanceof ProviderFailure) {
    return { code: error.errorCode, retryable: error.retryable, message: error.message };
  }
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return { code: "worker_crashed", retryable: true, message };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Monta o objeto de proveniencia gravado por finalize_laudo_ia em ia_provenance
 * (AUDIT-001 Tarefa 2.3). Inteiramente derivado de campos fixos/tecnicos — nunca
 * inclui nome de arquivo, path, prompt completo ou conteudo do PDF — por isso
 * fica muito abaixo do limite de 8KiB do contrato da RPC. O check de tamanho
 * abaixo e um cinto de seguranca defensivo, nao um caminho esperado.
 */
function buildProvenance(input: {
  provider: LaudoIaProviderCode;
  model: string;
  pdfSha256: string;
  pdfBytes: number;
}): Record<string, unknown> {
  const provenance = {
    provider: input.provider,
    model: input.model,
    prompt_version: PROMPT_VERSION,
    processed_at: new Date().toISOString(),
    pdf_sha256: input.pdfSha256,
    pdf_bytes: input.pdfBytes,
    schema_name: HEMOGRAMA_SCHEMA.name,
    schema_version: HEMOGRAMA_SCHEMA.version,
  };

  const bytes = new TextEncoder().encode(JSON.stringify(provenance)).byteLength;
  if (bytes > PROVENANCE_MAX_BYTES) {
    console.error("[parse-laudo] proveniencia excedeu o limite; gravando versao minima.", { bytes });
    return {
      provider: input.provider,
      prompt_version: PROMPT_VERSION,
      processed_at: provenance.processed_at,
    };
  }

  return provenance;
}

// ── Schema do resultado (compartilhado entre Gemini e OpenAI) ────────────
const HEMOGRAMA_SCHEMA = {
  name: "hemograma_veterinario",
  // Versao do schema clinico, gravada em ia_provenance.schema_version.
  // Incremente ao alterar campos/estrutura de HEMOGRAMA_SCHEMA.schema.
  version: "1",
  strict: true,
  schema: {
    type: "object",
    properties: {
      paciente: {
        type: "object",
        properties: {
          nome: { type: "string" },
          especie: { type: "string" },
          raca: { type: "string" },
          idade: { type: "string" },
          peso_kg: { type: ["number", "null"] },
          tutor: { type: "string" },
        },
        required: ["nome", "especie", "raca", "idade", "peso_kg", "tutor"],
        additionalProperties: false,
      },
      serie_vermelha: {
        type: "object",
        properties: {
          hemacias: { type: ["number", "null"] },
          hemoglobina: { type: ["number", "null"] },
          hematocrito: { type: ["number", "null"] },
          vcm: { type: ["number", "null"] },
          hcm: { type: ["number", "null"] },
          chcm: { type: ["number", "null"] },
          rdw: { type: ["number", "null"] },
        },
        required: ["hemacias", "hemoglobina", "hematocrito", "vcm", "hcm", "chcm", "rdw"],
        additionalProperties: false,
      },
      serie_branca: {
        type: "object",
        properties: {
          leucocitos_totais: { type: ["number", "null"] },
          neutrofilos_segmentados: { type: ["number", "null"] },
          neutrofilos_bastoes: { type: ["number", "null"] },
          linfocitos: { type: ["number", "null"] },
          monocitos: { type: ["number", "null"] },
          eosinofilos: { type: ["number", "null"] },
          basofilos: { type: ["number", "null"] },
        },
        required: [
          "leucocitos_totais",
          "neutrofilos_segmentados",
          "neutrofilos_bastoes",
          "linfocitos",
          "monocitos",
          "eosinofilos",
          "basofilos",
        ],
        additionalProperties: false,
      },
      plaquetas: {
        type: "object",
        properties: {
          contagem: { type: ["number", "null"] },
          vpm: { type: ["number", "null"] },
        },
        required: ["contagem", "vpm"],
        additionalProperties: false,
      },
      bioquimica: {
        type: "object",
        properties: {
          ureia: { type: ["number", "null"] },
          creatinina: { type: ["number", "null"] },
          alt_tgp: { type: ["number", "null"] },
          ast_tgo: { type: ["number", "null"] },
          fosforo: { type: ["number", "null"] },
          potassio: { type: ["number", "null"] },
          sodio: { type: ["number", "null"] },
          albumina: { type: ["number", "null"] },
          proteina_total: { type: ["number", "null"] },
        },
        required: ["ureia", "creatinina", "alt_tgp", "ast_tgo", "fosforo", "potassio", "sodio", "albumina", "proteina_total"],
        additionalProperties: false,
      },
      interpretacao_ia: {
        type: "object",
        properties: {
          resumo: { type: "string" },
          achados_relevantes: { type: "array", items: { type: "string" } },
          alertas: { type: "array", items: { type: "string" } },
          estadiamento_iris_sugerido: { type: ["string", "null"] },
        },
        required: ["resumo", "achados_relevantes", "alertas", "estadiamento_iris_sugerido"],
        additionalProperties: false,
      },
      laboratorio: { type: ["string", "null"] },
      data_coleta: { type: ["string", "null"] },
      data_resultado: { type: ["string", "null"] },
    },
    required: ["paciente", "serie_vermelha", "serie_branca", "plaquetas", "bioquimica", "interpretacao_ia", "laboratorio", "data_coleta", "data_resultado"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = "Voce e um assistente de extracao de dados de laudos veterinarios. Extraia somente informacoes presentes no PDF e retorne JSON estruturado conforme o schema fornecido. Use exclusivamente YYYY-MM-DD em data_coleta e data_resultado; quando a data ou outro campo nao constar no laudo, retorne null. Nao diagnostique DRC, nao recomende tratamento e nao sugira estadiamento IRIS. Em interpretacao_ia, liste apenas achados que o proprio laudo sinaliza fora da referencia e mantenha estadiamento_iris_sugerido como null. A avaliacao clinica depende de exame, hidratacao, estabilidade, especie e outros marcadores revisados por medico-veterinario.";

// ── Gemini API ───────────────────────────────────────────────────────────

/**
 * Converte o schema JSON Schema para o formato do Gemini.
 * Gemini não suporta `type: ["number", "null"]`, usa `nullable: true`.
 */
function toGeminiSchema(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(jsonSchema)) {
    if (key === "additionalProperties") continue; // Gemini não usa isso

    if (key === "type" && Array.isArray(value)) {
      // ["number", "null"] → type: "NUMBER", nullable: true
      const types = (value as string[]).filter((t) => t !== "null");
      result["type"] = geminiType(types[0] || "string");
      if ((value as string[]).includes("null")) {
        result["nullable"] = true;
      }
    } else if (key === "type" && typeof value === "string") {
      result["type"] = geminiType(value);
    } else if (key === "properties" && typeof value === "object" && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = toGeminiSchema(propVal as Record<string, unknown>);
      }
      result["properties"] = props;
    } else if (key === "items" && typeof value === "object" && value !== null) {
      result["items"] = toGeminiSchema(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function geminiType(t: string): string {
  switch (t) {
    case "string": return "STRING";
    case "number": return "NUMBER";
    case "integer": return "INTEGER";
    case "boolean": return "BOOLEAN";
    case "array": return "ARRAY";
    case "object": return "OBJECT";
    default: return "STRING";
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  base64Pdf: string,
  fileName: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const geminiSchema = toGeminiSchema(HEMOGRAMA_SCHEMA.schema);

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [
          { text: `Extraia todos os dados deste laudo veterinario (${fileName}). Retorne JSON estruturado:` },
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64Pdf,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
    },
  });

  // Retry com backoff exponencial para rate limit (429)
  const MAX_ATTEMPTS = 3;
  let lastError: ProviderFailure | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
      console.log(`[parse-laudo] Gemini rate limit (429). Tentativa ${attempt + 1}/${MAX_ATTEMPTS} em ${delayMs}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: requestBody,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new ProviderFailure("Gemini: tempo limite excedido.", "provider_timeout", true);
      }
      throw new ProviderFailure("Gemini: falha de rede.", "provider_unavailable", true);
    }

    if (response.status === 429) {
      await response.body?.cancel();
      lastError = providerStatusFailure("Gemini", 429);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw providerStatusFailure("Gemini", response.status);
    }

    let data: unknown;
    try {
      data = await readBoundedJsonResponse(response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Resposta da IA fora do formato esperado.";
      throw new ProviderFailure(msg, msg.includes("limite") ? "result_too_large" : "invalid_provider_response", false);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ProviderFailure("Resposta da IA fora do formato esperado.", "invalid_provider_response", false);
    }

    // Extrai texto da resposta do Gemini
    const candidates = (data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    }).candidates;
    if (!candidates || candidates.length === 0) {
      throw new ProviderFailure("Gemini não retornou candidatos na resposta.", "invalid_provider_response", false);
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new ProviderFailure("Gemini não retornou conteúdo na resposta.", "invalid_provider_response", false);
    }

    return typeof parts[0]?.text === "string" ? parts[0].text : "";
  }

  // Se esgotou retries, lança o último erro
  throw lastError ?? new ProviderFailure("Gemini: máximo de tentativas excedido.", "provider_rate_limited", true);
}

// ── OpenAI API (fallback) ────────────────────────────────────────────────

function extractOpenAIOutputText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }>;
  };

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  base64Pdf: string,
  fileName: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: HEMOGRAMA_SCHEMA.name,
            strict: HEMOGRAMA_SCHEMA.strict,
            schema: HEMOGRAMA_SCHEMA.schema,
          },
        },
        input: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Extraia todos os dados deste laudo veterinario:" },
              {
                type: "input_file",
                filename: fileName,
                file_data: `data:application/pdf;base64,${base64Pdf}`,
              },
            ],
          },
        ],
        max_output_tokens: 4096,
        temperature: 0,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ProviderFailure("OpenAI: tempo limite excedido.", "provider_timeout", true);
    }
    throw new ProviderFailure("OpenAI: falha de rede.", "provider_unavailable", true);
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw providerStatusFailure("OpenAI", response.status);
  }

  let data: unknown;
  try {
    data = await readBoundedJsonResponse(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Resposta da IA fora do formato esperado.";
    throw new ProviderFailure(msg, msg.includes("limite") ? "result_too_large" : "invalid_provider_response", false);
  }

  const outputText = extractOpenAIOutputText(data);
  if (!outputText) {
    throw new ProviderFailure("OpenAI não retornou dados estruturados.", "invalid_provider_response", false);
  }

  return outputText;
}

// ── Tratamento das falhas de claim_laudo_ia (nenhum claim existe ainda,
//    portanto nunca chamamos refund aqui — so ha o que compensar depois que
//    o claim tiver sucesso). Mensagens publicas sem detalhe interno. ────────
function handleClaimRpcError(
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  if (message.includes("quota_exhausted") || message.includes("quota_cycle_expired")) {
    return ok({ success: false, error: "Limite de análises gratuitas atingido. Aguarde a renovação mensal." }, corsHeaders);
  }
  if (message.includes("already_processing")) {
    return ok({ success: false, error: "Este laudo ja esta em processamento." }, corsHeaders);
  }
  if (message.includes("claim_conflict")) {
    return ok({ success: false, error: "Não foi possível iniciar o processamento agora. Tente novamente." }, corsHeaders);
  }
  if (message.includes("laudo_not_found")) {
    return ok({ success: false, error: "Laudo não encontrado. Tente fazer o upload novamente." }, corsHeaders);
  }
  if (message.includes("service_role_required") || message.includes("quota_not_configured")) {
    return authorizationUnavailable(corsHeaders);
  }
  console.error("[parse-laudo] claim_laudo_ia falhou de forma inesperada.", { message });
  return ok({ success: false, error: "Não foi possível processar o laudo agora. Tente novamente." }, corsHeaders);
}

// ── Handler principal ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin, ALLOWED_ORIGINS);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return methodNotAllowed(corsHeaders);

  let supabase: VetDoRimClient | null = null;

  // AUDIT-001 Fase 2 (Tarefa 2.2): so preenchido DEPOIS que claim_laudo_ia
  // retornar disposition 'claimed'/'reclaimed'. O catch geral so chama
  // refund_laudo_ia quando este objeto existir — nunca antes (guarda contra
  // "inventar" uma compensacao para um claim que nunca existiu).
  let activeClaim: {
    laudoId: string;
    clinicId: string;
    actorUserId: string;
    idempotencyKey: string;
    claimId: string;
    claimToken: string;
  } | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[parse-laudo] Configuracao obrigatoria do backend ausente.");
      return ok({ success: false, error: "Servico temporariamente indisponivel." }, corsHeaders);
    }

    supabase = createClient<Database>(
      supabaseUrl,
      serviceRoleKey,
    );

    // ── Autenticação ───────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return unauthorized(corsHeaders);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      accessToken,
    );
    if (authError || !user) return unauthorized(corsHeaders);

    // ── Papel profissional ──────────────────────────────────────────────
    // Checagem preliminar e barata; a autorizacao real por clinica acontece
    // dentro de claim_laudo_ia, que revalida clinica ativa + membership ativa
    // do ator (vet/clinic_admin) na mesma transacao da reserva de cota.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return authorizationUnavailable(corsHeaders);
    }
    if (!profile || !["vet", "admin"].includes(profile.role)) {
      return forbidden(corsHeaders);
    }

    // ── Validação do body ──────────────────────────────────────────────
    const body = await readRequestBody(req);
    const laudoId = body?.laudoId;
    if (typeof laudoId !== "string" || !UUID_RE.test(laudoId)) {
      return ok({ success: false, error: "ID do laudo invalido." }, corsHeaders);
    }

    // ── Busca laudo ─────────────────────────────────────────────────────
    const { data: laudo, error: laudoError } = await supabase
      .from("laudos_pdf")
      .select("id, storage_path, status, vet_id, clinic_id")
      .eq("id", laudoId)
      .single();

    if (laudoError || !laudo || laudo.vet_id !== user.id) {
      return ok({ success: false, error: "Laudo não encontrado. Tente fazer o upload novamente." }, corsHeaders);
    }
    if (!laudo.storage_path.startsWith(`${user.id}/`)) {
      return ok({ success: false, error: "Caminho do laudo inválido para este usuário." }, corsHeaders);
    }

    // Dependencia de ordem de deploy: as migrations de tenancy
    // (20260718100000_tenancy_expand e 20260718100100_tenancy_backfill_default_clinic)
    // precisam ja estar aplicadas ANTES do deploy desta funcao. Se clinic_id vier
    // nulo aqui (backfill nao rodou), falhamos cedo e sem detalhe interno — o
    // proprio claim_laudo_ia rejeitaria com invalid_request de qualquer forma,
    // mas checar aqui evita depender da mensagem crua da RPC para esse caso.
    if (!laudo.clinic_id) {
      console.error("[parse-laudo] laudo sem clinic_id (backfill de tenancy pendente).", { laudoId });
      return ok({ success: false, error: "Servico temporariamente indisponivel." }, corsHeaders);
    }

    // ── claim_laudo_ia: reserva atomica de cota + estado ANTES de qualquer
    //    chamada externa (elimina o TOCTOU de cota e o estado nao-idempotente
    //    do padrao antigo de update manual). idempotency_key e gerada nesta
    //    requisicao (o front ainda nao envia uma propria; ver riscos/pendencias
    //    no relatorio da tarefa) — a unicidade de reserva por laudo em
    //    private.laudo_ia_claims ja impede dupla cobranca mesmo sem chave
    //    estavel entre retries do navegador.
    const idempotencyKey = crypto.randomUUID();
    const { data: claimRows, error: claimError } = await supabase
      .rpc("claim_laudo_ia", {
        p_clinic_id: laudo.clinic_id,
        p_actor_user_id: user.id,
        p_laudo_id: laudoId,
        p_idempotency_key: idempotencyKey,
      });

    if (claimError) {
      return handleClaimRpcError(claimError.message ?? "", corsHeaders);
    }
    const claimResult = claimRows?.[0];
    if (!claimResult) {
      return ok({ success: false, error: "Não foi possível processar o laudo agora. Tente novamente." }, corsHeaders);
    }

    switch (claimResult.disposition) {
      case "processing":
        return ok({ success: false, error: "Este laudo ja esta em processamento." }, corsHeaders);
      case "already_completed":
        return ok({ success: false, error: "Este laudo já foi processado anteriormente." }, corsHeaders);
      case "attempts_exhausted":
        return ok({ success: false, error: "Este laudo atingiu o limite de tentativas de processamento. Contate o suporte." }, corsHeaders);
      case "terminal":
        return ok({ success: false, error: "Este laudo não pode mais ser processado. Contate o suporte." }, corsHeaders);
      case "claimed":
      case "reclaimed":
        break;
      default:
        console.error("[parse-laudo] disposition inesperada do claim.", { disposition: claimResult.disposition });
        return ok({ success: false, error: "Não foi possível processar o laudo agora. Tente novamente." }, corsHeaders);
    }

    if (!claimResult.claim_id || !claimResult.claim_token || !claimResult.storage_bucket || !claimResult.storage_path) {
      console.error("[parse-laudo] claim sem token/path utilizavel.", { disposition: claimResult.disposition });
      return ok({ success: false, error: "Não foi possível processar o laudo agora. Tente novamente." }, corsHeaders);
    }

    // A partir daqui existe um claim ativo: qualquer falha subsequente DEVE
    // ser compensada via refund_laudo_ia (nunca por update direto de status).
    activeClaim = {
      laudoId,
      clinicId: laudo.clinic_id,
      actorUserId: user.id,
      idempotencyKey,
      claimId: claimResult.claim_id,
      claimToken: claimResult.claim_token,
    };

    // ── Download do PDF do Storage (bucket/path vem do claim, nunca do body
    //    nem recalculado localmente) ──────────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(claimResult.storage_bucket)
      .download(claimResult.storage_path);

    if (downloadError || !fileData) {
      throw new ProviderFailure("Falha ao baixar o PDF do storage.", "storage_missing", true);
    }

    // ── Converte para base64 ───────────────────────────────────────────
    if (fileData.size < 5 || fileData.size > MAX_PDF_BYTES) {
      throw new ProviderFailure("Arquivo ausente, maior que 10 MiB ou sem assinatura PDF valida.", "invalid_pdf", false);
    }
    const pdfBytes = await fileData.arrayBuffer();
    if (!isPdf(pdfBytes)) {
      throw new ProviderFailure("Arquivo ausente, maior que 10 MiB ou sem assinatura PDF valida.", "invalid_pdf", false);
    }
    const base64Pdf = arrayBufferToBase64(pdfBytes);
    const fileName = "laudo.pdf";

    // ── Chamada à IA (provider selecionado pela configuração) ─────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let outputText: string;
    let providerUsed: LaudoIaProviderCode;
    let modelUsed: string;

    if (geminiKey) {
      // Modelo estável configurável por GEMINI_MODEL.
      modelUsed = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
      outputText = await callGemini(geminiKey, modelUsed, base64Pdf, fileName);
      providerUsed = "gemini";
    } else if (openaiKey) {
      // OpenAI é usado somente quando Gemini não está configurado.
      modelUsed = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-terra";
      outputText = await callOpenAI(openaiKey, modelUsed, base64Pdf, fileName);
      providerUsed = "openai";
    } else {
      throw new ProviderFailure(
        "Nenhuma API de IA configurada. Configure GEMINI_API_KEY ou OPENAI_API_KEY no projeto Supabase.",
        "internal_processing_error",
        false,
      );
    }

    if (new TextEncoder().encode(outputText).byteLength > MAX_AI_OUTPUT_BYTES) {
      throw new ProviderFailure("Resposta da IA excedeu o limite permitido.", "result_too_large", false);
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(outputText);
    } catch {
      throw new ProviderFailure("Não foi possível interpretar a resposta da IA. Tente reenviar o PDF.", "invalid_provider_response", false);
    }

    // ── Valida contrato clínico local ──────────────────────────────────
    let resultadoIa: Record<string, unknown>;
    try {
      resultadoIa = containClinicalInference(parsedOutput, HEMOGRAMA_SCHEMA.schema);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Resposta da IA invalida.";
      throw new ProviderFailure(msg, "invalid_result_schema", false);
    }

    // ── Proveniência da IA (Tarefa 2.3) ─────────────────────────────────
    const pdfSha256 = await sha256Hex(pdfBytes);
    const provenance = buildProvenance({
      provider: providerUsed,
      model: modelUsed,
      pdfSha256,
      pdfBytes: pdfBytes.byteLength,
    });

    // ── finalize_laudo_ia: grava resultado clinico + proveniencia + consome
    //    a cota reservada, tudo na mesma transacao ────────────────────────
    const { data: finalizeRows, error: finalizeError } = await supabase
      .rpc("finalize_laudo_ia", {
        p_clinic_id: activeClaim.clinicId,
        p_actor_user_id: activeClaim.actorUserId,
        p_laudo_id: activeClaim.laudoId,
        p_claim_id: activeClaim.claimId,
        p_claim_token: activeClaim.claimToken,
        p_idempotency_key: activeClaim.idempotencyKey,
        p_result: resultadoIa,
        p_provider_code: providerUsed,
        p_provenance: provenance,
      });

    if (finalizeError || !finalizeRows?.[0]) {
      // O resultado ja foi validado localmente; uma falha aqui e uma
      // anomalia operacional (RPC/rede), nao um problema do PDF ou da IA.
      // worker_crashed/retryable=true permite que um novo claim (proxima
      // tentativa) recupere o processamento sem reprocessar cota.
      throw new ProviderFailure(
        finalizeError?.message ?? "Falha ao finalizar o processamento do laudo.",
        "worker_crashed",
        true,
      );
    }

    return ok({ success: true, data: resultadoIa, provider: providerUsed }, corsHeaders);

  } catch (error) {
    const classified = classifyUnknown(error);
    console.error("[parse-laudo] processamento falhou:", { errorCode: classified.code, retryable: classified.retryable });

    // ── Compensação via refund_laudo_ia (nunca update direto de status) ──
    // So chamamos refund se um claim realmente existir; falhas antes do claim
    // (auth, validacao de body, laudo nao encontrado, erros da propria
    // claim_laudo_ia) ja retornaram acima e nunca chegam neste catch com
    // activeClaim nulo tendo reservado algo.
    if (supabase && activeClaim) {
      try {
        await supabase.rpc("refund_laudo_ia", {
          p_clinic_id: activeClaim.clinicId,
          p_actor_user_id: activeClaim.actorUserId,
          p_laudo_id: activeClaim.laudoId,
          p_claim_id: activeClaim.claimId,
          p_claim_token: activeClaim.claimToken,
          p_idempotency_key: activeClaim.idempotencyKey,
          p_retryable: classified.retryable,
          p_error_code: classified.code,
        });
      } catch (refundError) {
        // Nao propaga: o reaper/proxima tentativa reconcilia via expiracao de
        // lease. Propagar aqui so trocaria uma mensagem generica por outra.
        console.error("[parse-laudo] refund_laudo_ia falhou apos falha de processamento.", {
          message: refundError instanceof Error ? refundError.message : "erro desconhecido",
        });
      }
    }

    // Mensagem pública sem expor detalhes sensíveis
    const publicMsg = classified.message.includes("API de IA configurada")
      ? "Serviço de IA não configurado. Contate o suporte técnico."
      : classified.code === "provider_rate_limited" || classified.code === "provider_unavailable" || classified.code === "provider_rejected"
      ? "Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos."
      : classified.code === "provider_timeout"
      ? "O processamento demorou demais. Tente novamente."
      : classified.code === "storage_missing"
      ? "Erro ao acessar o arquivo PDF no storage. Tente fazer o upload novamente."
      : classified.code === "invalid_pdf"
      ? "Arquivo PDF inválido ou corrompido. Verifique o arquivo e tente novamente."
      : "Não foi possível processar o laudo agora. Tente novamente.";

    // Sempre retorna 200 para que o cliente consiga ler o corpo da resposta
    return ok({ success: false, error: publicMsg }, corsHeaders);
  }
});
