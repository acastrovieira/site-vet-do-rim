import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import {
  containClinicalInference,
  getCorsHeaders,
  MAX_PDF_BYTES,
  readBoundedJsonResponse,
  readRequestBody,
} from "./contracts.ts";
import type { Database } from "./database.types.ts";

type VetDoRimClient = ReturnType<typeof createClient<Database>>;

const ALLOWED_ORIGINS = [
  "https://vetdorim.com.br",
  "https://www.vetdorim.com.br",
  "http://localhost:3000",
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AI_OUTPUT_BYTES = 256 * 1024;

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

function failureCode(message: string) {
  if (message.includes("Gemini retornou erro")) return "GEMINI_UNAVAILABLE";
  if (message.includes("OpenAI retornou erro")) return "OPENAI_UNAVAILABLE";
  if (message.includes("Falha ao baixar")) return "STORAGE_DOWNLOAD_FAILED";
  if (message.includes("assinatura PDF")) return "INVALID_PDF";
  if (message.includes("cota")) return "QUOTA_FINALIZE_FAILED";
  if (message.includes("salvar resultado")) return "RESULT_FINALIZE_FAILED";
  if (message.includes("iniciar o processamento")) return "CLAIM_FAILED";
  if (message.includes("API de IA configurada")) return "PROVIDER_NOT_CONFIGURED";
  if (message.includes("resposta da IA") || message.includes("Resposta da IA")) return "INVALID_AI_OUTPUT";
  return "PROCESSING_FAILED";
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

// ── Schema do resultado (compartilhado entre Gemini e OpenAI) ────────────
const HEMOGRAMA_SCHEMA = {
  name: "hemograma_veterinario",
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
  base64Pdf: string,
  fileName: string,
): Promise<string> {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
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
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
      console.log(`[parse-laudo] Gemini rate limit (429). Tentativa ${attempt + 1}/${MAX_ATTEMPTS} em ${delayMs}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 429) {
      await response.body?.cancel();
      lastError = new Error("Gemini retornou erro 429.");
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Gemini retornou erro ${response.status}.`);
    }

    const data = await readBoundedJsonResponse(response);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Resposta da IA fora do formato esperado.");
    }

    // Extrai texto da resposta do Gemini
    const candidates = (data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    }).candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("Gemini não retornou candidatos na resposta.");
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("Gemini não retornou conteúdo na resposta.");
    }

    return typeof parts[0]?.text === "string" ? parts[0].text : "";
  }

  // Se esgotou retries, lança o último erro
  throw lastError ?? new Error("Gemini: máximo de tentativas excedido.");
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
  base64Pdf: string,
  fileName: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-5.6-terra",
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

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`OpenAI retornou erro ${response.status}.`);
  }

  const data = await readBoundedJsonResponse(response);
  const outputText = extractOpenAIOutputText(data);
  if (!outputText) {
    throw new Error("OpenAI não retornou dados estruturados.");
  }

  return outputText;
}

// ── Handler principal ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin, ALLOWED_ORIGINS);
  let supabase: VetDoRimClient | null = null;
  let laudoIdForFailure: string | null = null;
  let userIdForFailure: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return methodNotAllowed(corsHeaders);

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

    // ── Cota de IA ─────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, ai_quota_used, ai_quota_limit")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return authorizationUnavailable(corsHeaders);
    }
    if (!profile || !["vet", "admin"].includes(profile.role)) {
      return forbidden(corsHeaders);
    }

    const quotaUsed = profile.ai_quota_used ?? 0;
    const quotaLimit = profile.ai_quota_limit ?? 5;

    if (quotaUsed >= quotaLimit) {
      return ok({ success: false, error: `Limite de análises gratuitas atingido (${quotaUsed}/${quotaLimit}). Aguarde a renovação mensal.` }, corsHeaders);
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
      .select("id, storage_path, status, vet_id")
      .eq("id", laudoId)
      .single();

    if (laudoError || !laudo || laudo.vet_id !== user.id) {
      return ok({ success: false, error: "Laudo não encontrado. Tente fazer o upload novamente." }, corsHeaders);
    }
    if (!laudo.storage_path.startsWith(`${user.id}/`)) {
      return ok({ success: false, error: "Caminho do laudo inválido para este usuário." }, corsHeaders);
    }
    laudoIdForFailure = laudoId;
    userIdForFailure = user.id;
    if (laudo.status === "concluido") {
      return ok({ success: false, error: "Este laudo já foi processado anteriormente." }, corsHeaders);
    }

    // ── Marca como processando ─────────────────────────────────────────
    if (laudo.status === "processando") {
      return ok({ success: false, error: "Este laudo ja esta em processamento." }, corsHeaders);
    }

    const { data: claimedLaudo, error: processingError } = await supabase
      .from("laudos_pdf")
      .update({ status: "processando", erro_ia: null })
      .eq("id", laudoId)
      .eq("vet_id", user.id)
      .in("status", ["pendente", "erro"])
      .select("id")
      .maybeSingle();
    if (processingError || !claimedLaudo) {
      if (!processingError) {
        return ok({ success: false, error: "Este laudo ja esta em processamento." }, corsHeaders);
      }
      throw new Error(`Não foi possível iniciar o processamento: ${processingError.message}`);
    }

    // ── Download do PDF do Storage ──────────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("laudos")
      .download(laudo.storage_path);

    if (downloadError || !fileData) {
      throw new Error("Falha ao baixar o PDF do storage.");
    }

    // ── Converte para base64 ───────────────────────────────────────────
    if (fileData.size < 5 || fileData.size > MAX_PDF_BYTES) {
      throw new Error("Arquivo ausente, maior que 10 MiB ou sem assinatura PDF valida.");
    }
    const pdfBytes = await fileData.arrayBuffer();
    if (!isPdf(pdfBytes)) {
      throw new Error("Arquivo ausente, maior que 10 MiB ou sem assinatura PDF valida.");
    }
    const base64Pdf = arrayBufferToBase64(pdfBytes);
    const fileName = "laudo.pdf";

    // ── Chamada à IA (provider selecionado pela configuração) ─────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let outputText: string;
    let providerUsed: string;

    if (geminiKey) {
      // Modelo estável configurável por GEMINI_MODEL.
      outputText = await callGemini(geminiKey, base64Pdf, fileName);
      providerUsed = "gemini";
    } else if (openaiKey) {
      // OpenAI é usado somente quando Gemini não está configurado.
      outputText = await callOpenAI(openaiKey, base64Pdf, fileName);
      providerUsed = "openai";
    } else {
      throw new Error("Nenhuma API de IA configurada. Configure GEMINI_API_KEY ou OPENAI_API_KEY no projeto Supabase.");
    }

    if (new TextEncoder().encode(outputText).byteLength > MAX_AI_OUTPUT_BYTES) {
      throw new Error("Resposta da IA excedeu o limite permitido.");
    }

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(outputText);
    } catch {
      throw new Error("Não foi possível interpretar a resposta da IA. Tente reenviar o PDF.");
    }

    // ── Salva resultado ────────────────────────────────────────────────
    const resultadoIa = containClinicalInference(parsedOutput, HEMOGRAMA_SCHEMA.schema);

    const { data: finalizedLaudo, error: resultUpdateError } = await supabase
      .from("laudos_pdf")
      .update({
        status: "concluido",
        resultado_ia: resultadoIa,
        erro_ia: null,
      })
      .eq("id", laudoId)
      .eq("vet_id", user.id)
      .eq("status", "processando")
      .select("id")
      .maybeSingle();
    if (resultUpdateError || !finalizedLaudo) {
      if (!resultUpdateError) {
        throw new Error("Falha ao salvar resultado: estado do laudo foi alterado.");
      }
      throw new Error(`Falha ao salvar resultado: ${resultUpdateError.message}`);
    }

    // ── Incrementa cota ────────────────────────────────────────────────
    const { error: quotaRpcError } = await supabase.rpc("increment_ai_quota", { user_id: user.id });
    if (quotaRpcError) {
      throw new Error("Não foi possível registrar o uso da cota de forma segura.");
    }

    return ok({ success: true, data: resultadoIa, provider: providerUsed }, corsHeaders);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    const code = failureCode(msg);
    console.error("[parse-laudo] processamento falhou:", { code });

    // Atualiza status para 'erro' no banco
    if (supabase && laudoIdForFailure && userIdForFailure) {
      await supabase
        .from("laudos_pdf")
        .update({
          status: "erro",
          erro_ia: `PROCESSING_FAILED:${code}`,
        })
        .eq("id", laudoIdForFailure)
        .eq("vet_id", userIdForFailure)
        .eq("status", "processando");
    }

    // Mensagem pública sem expor detalhes sensíveis
    const publicMsg = msg.includes("API de IA configurada")
      ? "Serviço de IA não configurado. Contate o suporte técnico."
      : msg.includes("Gemini retornou erro") || msg.includes("OpenAI retornou erro")
      ? "Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos."
      : msg.includes("Falha ao baixar")
      ? "Erro ao acessar o arquivo PDF no storage. Tente fazer o upload novamente."
      : "Não foi possível processar o laudo agora. Tente novamente.";

    // Sempre retorna 200 para que o cliente consiga ler o corpo da resposta
    return ok({ success: false, error: publicMsg }, corsHeaders);
  }
});
