export const MAX_REQUEST_BYTES = 4 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PROVIDER_RESPONSE_BYTES = 512 * 1024;

const MAX_SCHEMA_DEPTH = 12;
const MAX_SCHEMA_ARRAY_ITEMS = 100;
const MAX_SCHEMA_STRING_BYTES = 16 * 1024;
const textEncoder = new TextEncoder();
const ISO_CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isIsoCivilDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_CIVIL_DATE_RE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function assertProviderCivilDates(value: Record<string, unknown>): void {
  for (const key of ["data_coleta", "data_resultado"] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const date = value[key];
    if (date !== null && !isIsoCivilDate(date)) {
      throw new Error(`Resposta da IA com data civil invalida em $.${key}.`);
    }
  }
}

async function readBoundedText(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (!stream) return "";

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("body_limit_exceeded");
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function getCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export async function readRequestBody(
  req: Request,
): Promise<{ laudoId: unknown } | null> {
  const mediaType = req.headers.get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") return null;

  const contentLength = req.headers.get("Content-Length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) return null;
    if (Number(contentLength) > MAX_REQUEST_BYTES) return null;
  }

  let raw: string | null;
  try {
    raw = await readBoundedText(req.body, MAX_REQUEST_BYTES);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const value = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (
      Object.keys(value).length !== 1
      || !Object.prototype.hasOwnProperty.call(value, "laudoId")
    ) {
      return null;
    }
    return { laudoId: value.laudoId };
  } catch {
    return null;
  }
}

export async function readBoundedJsonResponse(
  response: Response,
  maxBytes = MAX_PROVIDER_RESPONSE_BYTES,
): Promise<unknown> {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    await response.body?.cancel("body_limit_exceeded");
    throw new Error("Resposta da IA excedeu o limite permitido.");
  }

  let raw: string | null;
  try {
    raw = await readBoundedText(response.body, maxBytes);
  } catch {
    throw new Error("Resposta da IA fora do formato esperado.");
  }
  if (raw === null) throw new Error("Resposta da IA excedeu o limite permitido.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Resposta da IA fora do formato esperado.");
  }
}

function valueMatchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "null":
      return value === null;
    case "object":
      return isRecord(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}

export function assertJsonMatchesSchema(
  value: unknown,
  schema: JsonSchema,
  path = "$",
  depth = 0,
): void {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new Error("Resposta da IA excedeu a profundidade permitida.");
  }

  const allowedTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type
    ? [schema.type]
    : [];
  if (allowedTypes.length === 0 || !allowedTypes.some((type) => valueMatchesType(value, type))) {
    throw new Error(`Resposta da IA com tipo invalido em ${path}.`);
  }
  if (value === null) return;

  if (typeof value === "string") {
    if (textEncoder.encode(value).byteLength > MAX_SCHEMA_STRING_BYTES) {
      throw new Error(`Resposta da IA com texto excessivo em ${path}.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_SCHEMA_ARRAY_ITEMS) {
      throw new Error(`Resposta da IA com lista excessiva em ${path}.`);
    }
    if (!schema.items) throw new Error(`Resposta da IA sem contrato de lista em ${path}.`);
    value.forEach((item, index) => {
      assertJsonMatchesSchema(item, schema.items as JsonSchema, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  if (!isRecord(value)) return;

  const properties = schema.properties ?? {};
  for (const requiredKey of schema.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
      throw new Error(`Resposta da IA sem campo obrigatorio em ${path}.${requiredKey}.`);
    }
  }

  if (schema.additionalProperties === false) {
    const unknownKey = Object.keys(value).find((key) => !(key in properties));
    if (unknownKey) {
      throw new Error(`Resposta da IA com campo desconhecido em ${path}.${unknownKey}.`);
    }
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childSchema = properties[key];
    if (childSchema) {
      assertJsonMatchesSchema(childValue, childSchema, `${path}.${key}`, depth + 1);
    }
  }
}

export function containClinicalInference(
  value: unknown,
  schema: JsonSchema,
): Record<string, unknown> {
  assertJsonMatchesSchema(value, schema);
  const result = value as Record<string, unknown>;
  assertProviderCivilDates(result);
  const interpretation = result["interpretacao_ia"] as Record<string, unknown>;

  return {
    ...result,
    interpretacao_ia: {
      ...interpretation,
      estadiamento_iris_sugerido: null,
    },
  };
}
