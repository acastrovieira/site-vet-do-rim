import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Schema OpenAI Structured Outputs para hemograma veterinário */
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
          tutor: { type: "string" }
        },
        required: ["nome", "especie", "raca", "idade", "peso_kg", "tutor"],
        additionalProperties: false
      },
      serie_vermelha: {
        type: "object",
        properties: {
          hemacias:    { type: ["number", "null"] },
          hemoglobina: { type: ["number", "null"] },
          hematocrito: { type: ["number", "null"] },
          vcm:         { type: ["number", "null"] },
          hcm:         { type: ["number", "null"] },
          chcm:        { type: ["number", "null"] },
          rdw:         { type: ["number", "null"] }
        },
        required: ["hemacias","hemoglobina","hematocrito","vcm","hcm","chcm","rdw"],
        additionalProperties: false
      },
      serie_branca: {
        type: "object",
        properties: {
          leucocitos_totais:        { type: ["number", "null"] },
          neutrofilos_segmentados:  { type: ["number", "null"] },
          neutrofilos_bastoes:      { type: ["number", "null"] },
          linfocitos:               { type: ["number", "null"] },
          monocitos:                { type: ["number", "null"] },
          eosinofilos:              { type: ["number", "null"] },
          basofilos:                { type: ["number", "null"] }
        },
        required: ["leucocitos_totais","neutrofilos_segmentados","neutrofilos_bastoes","linfocitos","monocitos","eosinofilos","basofilos"],
        additionalProperties: false
      },
      plaquetas: {
        type: "object",
        properties: {
          contagem: { type: ["number", "null"] },
          vpm:      { type: ["number", "null"] }
        },
        required: ["contagem", "vpm"],
        additionalProperties: false
      },
      bioquimica: {
        type: "object",
        properties: {
          ureia:          { type: ["number", "null"] },
          creatinina:     { type: ["number", "null"] },
          alt_tgp:        { type: ["number", "null"] },
          ast_tgo:        { type: ["number", "null"] },
          fosforo:        { type: ["number", "null"] },
          potassio:       { type: ["number", "null"] },
          sodio:          { type: ["number", "null"] },
          albumina:       { type: ["number", "null"] },
          proteina_total: { type: ["number", "null"] }
        },
        required: ["ureia","creatinina","alt_tgp","ast_tgo","fosforo","potassio","sodio","albumina","proteina_total"],
        additionalProperties: false
      },
      interpretacao_ia: {
        type: "object",
        properties: {
          resumo:                       { type: "string" },
          achados_relevantes:           { type: "array", items: { type: "string" } },
          alertas:                      { type: "array", items: { type: "string" } },
          estadiamento_iris_sugerido:   { type: ["string", "null"] }
        },
        required: ["resumo","achados_relevantes","alertas","estadiamento_iris_sugerido"],
        additionalProperties: false
      },
      laboratorio:    { type: "string" },
      data_coleta:    { type: "string" },
      data_resultado: { type: "string" }
    },
    required: ["paciente","serie_vermelha","serie_branca","plaquetas","bioquimica","interpretacao_ia","laboratorio","data_coleta","data_resultado"],
    additionalProperties: false
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // 2. Payload
    const { laudoId } = await req.json() as { laudoId: string };
    if (!laudoId) {
      return new Response(JSON.stringify({ error: "laudoId obrigatório" }), { status: 400, headers: corsHeaders });
    }

    // 3. Busca registro
    const { data: laudo, error: laudoError } = await supabase
      .from("laudos_pdf")
      .select("id, storage_path, status, vet_id")
      .eq("id", laudoId)
      .single();

    if (laudoError || !laudo) {
      return new Response(JSON.stringify({ error: "Laudo não encontrado" }), { status: 404, headers: corsHeaders });
    }
    if (laudo.vet_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: corsHeaders });
    }
    if (laudo.status === "concluido") {
      return new Response(JSON.stringify({ error: "Laudo já processado" }), { status: 409, headers: corsHeaders });
    }

    // 4. Marca como processando
    await supabase.from("laudos_pdf").update({ status: "processando" }).eq("id", laudoId);

    // 5. Download PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("laudos")
      .download(laudo.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Download falhou: ${downloadError?.message}`);
    }

    // 6. PDF → base64
    const pdfBytes = await fileData.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    // 7. OpenAI GPT-4o com Structured Outputs
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_schema", json_schema: HEMOGRAMA_SCHEMA },
        messages: [
          {
            role: "system",
            content: "Você é um assistente clínico veterinário especialista em patologia clínica. Extraia TODOS os dados do laudo PDF fornecido e retorne em formato JSON estruturado. Se algum campo não constar no laudo, retorne null. Para a interpretação, identifique achados relevantes para nefrologia (DRC, proteinúria, anemia renal, hiperfosfatemia, hipocalemia). Estadiamento IRIS apenas se creatinina estiver presente."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todos os dados deste laudo veterinário:" },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0
      })
    });

    if (!openaiResponse.ok) {
      const errBody = await openaiResponse.text();
      throw new Error(`OpenAI error ${openaiResponse.status}: ${errBody}`);
    }

    const openaiData = await openaiResponse.json();
    const resultadoIa = JSON.parse(openaiData.choices[0].message.content);

    // 8. Salva resultado
    await supabase.from("laudos_pdf").update({
      status: "concluido",
      resultado_ia: resultadoIa,
      erro_ia: null
    }).eq("id", laudoId);

    return new Response(JSON.stringify({ success: true, data: resultadoIa }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[parse-laudo]:", msg);

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
