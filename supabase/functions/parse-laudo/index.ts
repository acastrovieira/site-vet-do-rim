import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://vetdorim.com.br",
  "https://www.vetdorim.com.br",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Todas as respostas de erro lógico retornam HTTP 200 com { success: false, error: "..." }.
 * Somente erros de autenticação retornam 401 para forçar a sessão a ser renovada.
 * Isso garante que o SDK do Supabase no cliente consiga ler o corpo do erro.
 */
function ok(body: Record<string, unknown>, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unauthorized(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: "Não autorizado. Faça login novamente." }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      laboratorio: { type: "string" },
      data_coleta: { type: "string" },
      data_resultado: { type: "string" },
    },
    required: ["paciente", "serie_vermelha", "serie_branca", "plaquetas", "bioquimica", "interpretacao_ia", "laboratorio", "data_coleta", "data_resultado"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = "Voce e um assistente clinico veterinario especialista em patologia clinica. Extraia todos os dados do PDF e retorne JSON estruturado conforme o schema fornecido. Se algum campo nao constar no laudo, retorne null. Para interpretacao, destaque achados relevantes para nefrologia como DRC, proteinuria, anemia renal, hiperfosfatemia e hipocalemia. Sugira estadiamento IRIS apenas se creatinina estiver presente.";

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
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiSchema = toGeminiSchema(HEMOGRAMA_SCHEMA.schema);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini retornou erro ${response.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await response.json();

  // Extrai texto da resposta do Gemini
  const candidates = data?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error("Gemini não retornou candidatos na resposta.");
  }

  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error("Gemini não retornou conteúdo na resposta.");
  }

  return parts[0]?.text ?? "";
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
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o",
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
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI retornou erro ${response.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const outputText = extractOpenAIOutputText(data);
  if (!outputText) {
    throw new Error("OpenAI não retornou dados estruturados.");
  }

  return outputText;
}

// ── Handler principal ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  let supabase: ReturnType<typeof createClient> | null = null;
  let laudoIdForFailure: string | null = null;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Autenticação ───────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return unauthorized(corsHeaders);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return unauthorized(corsHeaders);

    // ── Cota de IA ─────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ai_quota_used, ai_quota_limit")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return ok({ success: false, error: "Perfil de usuário não encontrado. Contate o suporte." }, corsHeaders);
    }

    const quotaUsed = profile.ai_quota_used || 0;
    const quotaLimit = profile.ai_quota_limit || 5;

    if (quotaUsed >= quotaLimit) {
      return ok({ success: false, error: `Limite de análises gratuitas atingido (${quotaUsed}/${quotaLimit}). Aguarde a renovação mensal.` }, corsHeaders);
    }

    // ── Validação do body ──────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const laudoId = body?.laudoId;
    if (!laudoId) {
      return ok({ success: false, error: "ID do laudo não informado." }, corsHeaders);
    }
    laudoIdForFailure = laudoId;

    // ── Busca laudo ─────────────────────────────────────────────────────
    const { data: laudo, error: laudoError } = await supabase
      .from("laudos_pdf")
      .select("id, storage_path, status, vet_id, nome_arquivo")
      .eq("id", laudoId)
      .single();

    if (laudoError || !laudo) {
      return ok({ success: false, error: "Laudo não encontrado. Tente fazer o upload novamente." }, corsHeaders);
    }
    if (laudo.vet_id !== user.id) {
      return ok({ success: false, error: "Acesso negado a este laudo." }, corsHeaders);
    }
    if (laudo.status === "concluido") {
      return ok({ success: false, error: "Este laudo já foi processado anteriormente." }, corsHeaders);
    }

    // ── Marca como processando ─────────────────────────────────────────
    const { error: processingError } = await supabase
      .from("laudos_pdf")
      .update({ status: "processando", erro_ia: null })
      .eq("id", laudoId);
    if (processingError) {
      throw new Error(`Não foi possível iniciar o processamento: ${processingError.message}`);
    }

    // ── Download do PDF do Storage ──────────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("laudos")
      .download(laudo.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Falha ao baixar o PDF: ${downloadError?.message ?? "arquivo não encontrado no storage"}`);
    }

    // ── Converte para base64 ───────────────────────────────────────────
    const pdfBytes = await fileData.arrayBuffer();
    const base64Pdf = arrayBufferToBase64(pdfBytes);
    const fileName = laudo.nome_arquivo || "laudo.pdf";

    // ── Chamada à IA (Gemini prioritário, OpenAI como fallback) ────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let outputText: string;
    let providerUsed: string;

    if (geminiKey) {
      // Usa Gemini 2.0 Flash (free tier: 15 RPM, 1.500 req/dia)
      outputText = await callGemini(geminiKey, base64Pdf, fileName);
      providerUsed = "gemini";
    } else if (openaiKey) {
      // Fallback: OpenAI GPT-4o (custo por token)
      outputText = await callOpenAI(openaiKey, base64Pdf, fileName);
      providerUsed = "openai";
    } else {
      throw new Error("Nenhuma API de IA configurada. Configure GEMINI_API_KEY (gratuito) ou OPENAI_API_KEY no projeto Supabase.");
    }

    let resultadoIa: unknown;
    try {
      resultadoIa = JSON.parse(outputText);
    } catch {
      throw new Error("Não foi possível interpretar a resposta da IA. Tente reenviar o PDF.");
    }

    // ── Salva resultado ────────────────────────────────────────────────
    const { error: resultUpdateError } = await supabase
      .from("laudos_pdf")
      .update({
        status: "concluido",
        resultado_ia: resultadoIa,
        erro_ia: null,
      })
      .eq("id", laudoId);
    if (resultUpdateError) {
      throw new Error(`Falha ao salvar resultado: ${resultUpdateError.message}`);
    }

    // ── Incrementa cota ────────────────────────────────────────────────
    const { error: quotaRpcError } = await supabase.rpc("increment_ai_quota", { user_id: user.id });
    if (quotaRpcError) {
      await supabase
        .from("profiles")
        .update({ ai_quota_used: quotaUsed + 1 })
        .eq("id", user.id);
    }

    return ok({ success: true, data: resultadoIa, provider: providerUsed }, corsHeaders);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[parse-laudo]:", msg);

    // Atualiza status para 'erro' no banco
    if (supabase && laudoIdForFailure) {
      await supabase
        .from("laudos_pdf")
        .update({
          status: "erro",
          erro_ia: msg.slice(0, 2000),
        })
        .eq("id", laudoIdForFailure);
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
