import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { authorizeClinicAccess } from '@/lib/server-authorization'
import { authorizationFailureJson } from '@/lib/server-api-response'
import { isUuid } from '@/lib/identifiers'
import { isCivilDate } from '@/lib/civil-date'
import {
  ALL_LAB_KEYS,
  extractResultValue,
  type ResultadoIA,
} from '@/lib/lab/transform-laudo-data'
import { getCategoryForLabKey, type HemogramaKey } from '@/lib/lab/reference-values'
import { CLINICAL_RATE_LIMIT_SCOPES, consumeClinicalRateLimit } from '@/lib/server-rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Export de resultados laboratoriais em CSV ou XLSX.
 *
 * GET /api/lab/export?petId=xxx&format=csv
 * GET /api/lab/export?petId=xxx&format=xlsx
 * GET /api/lab/export?petId=xxx&format=csv&from=2026-01-01&to=2026-12-31
 *
 * Requer autenticação e membership da clínica. A fonte canônica neste fluxo
 * é o JSON revisado em laudos_pdf, o mesmo consumido pela tabela evolutiva.
 * Isso evita depender da migration histórica de exam_result_items.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  const format = searchParams.get('format') ?? 'csv'
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  if (!petId || !isUuid(petId)) {
    return NextResponse.json({ error: 'petId inválido.' }, { status: 400 })
  }

  if (!['csv', 'xlsx'].includes(format)) {
    return NextResponse.json({ error: 'format deve ser csv ou xlsx.' }, { status: 400 })
  }
  if ((fromDate && !isCivilDate(fromDate)) || (toDate && !isCivilDate(toDate))) {
    return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })
  }
  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json({ error: 'Data inicial deve ser anterior à data final.' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const authorization = await authorizeClinicAccess(supabase, ['vet', 'admin'])
  if (!authorization.ok) return authorizationFailureJson(authorization)
  const rateLimit = await consumeClinicalRateLimit(supabase, CLINICAL_RATE_LIMIT_SCOPES.export)
  if (rateLimit.state === 'limited') {
    return NextResponse.json(
      { error: 'Muitas exportações em sequência. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    )
  }
  // Exportação é leitura autorizada: indisponibilidade do contador não deve
  // bloquear acesso a um dado já autorizado. O cabeçalho permite observação
  // operacional sem registrar PII ou conteúdo clínico.
  const rateLimitDegraded = rateLimit.state === 'unavailable'
  if (!authorization.clinicId || !authorization.membershipRole) {
    return NextResponse.json({ error: 'Clínica ativa não confirmada.' }, { status: 403 })
  }

  // Busca informações do pet para o nome do arquivo
  const { data: pet } = await supabase
    .from('pets')
    .select('nome, especie')
    .eq('id', petId)
    .eq('clinic_id', authorization.clinicId)
    .maybeSingle()

  if (!pet) {
    return NextResponse.json({ error: 'Pet não encontrado.' }, { status: 404 })
  }

  const { data: laudos, error: queryError } = await supabase
    .from('laudos_pdf')
    .select('id, nome_arquivo, tipo_exame, created_at, resultado_ia')
    .eq('pet_id', petId)
    .eq('clinic_id', authorization.clinicId)
    .eq('status', 'concluido')
    .order('created_at', { ascending: true })

  if (queryError) {
    console.error('[Export] query_error', { code: queryError.code })
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 })
  }

  const items: ExamItem[] = []
  for (const laudo of laudos ?? []) {
    if (!laudo.resultado_ia || typeof laudo.resultado_ia !== 'object' || Array.isArray(laudo.resultado_ia)) continue
    const result = laudo.resultado_ia as unknown as ResultadoIA
    const collectionDate = isCivilDate(result.data_coleta) ? result.data_coleta : null
    if (fromDate && (!collectionDate || collectionDate < fromDate)) continue
    if (toDate && (!collectionDate || collectionDate > toDate)) continue

    const localEvidence = Array.isArray(result.extracao_local?.items)
      ? new Map(result.extracao_local.items.map((item) => [item.parametro, item]))
      : new Map<HemogramaKey, NonNullable<ResultadoIA['extracao_local']>['items'][number]>()

    for (const key of ALL_LAB_KEYS) {
      const value = extractResultValue(result, key)
      if (value === null) continue
      const evidence = localEvidence.get(key)
      const observation = evidence?.observation
      const laboratoryReference = observation?.reference.source === 'laboratory_report'
      const referenceMin = laboratoryReference ? observation.reference.min : null
      const referenceMax = laboratoryReference ? observation.reference.max : null
      const status = observation?.assessment.status === 'below'
        ? 'baixo'
        : observation?.assessment.status === 'above'
          ? 'alto'
          : observation?.assessment.status === 'within'
            ? 'normal'
            : 'indisponivel'

      items.push({
        parametro: key,
        categoria: categoryKey(key),
        valor: value,
        // Registros legados não carregam unidade verificável. Nunca inferir
        // unidade canina/felina durante a exportação.
        unidade: observation?.measurement.printedUnit ?? evidence?.unidade ?? null,
        ref_min: referenceMin,
        ref_max: referenceMax,
        status_ref: status,
        data_coleta: collectionDate,
        especie: pet.especie,
        extracted_at: laudo.created_at,
        laudos_pdf: {
          nome_arquivo: laudo.nome_arquivo,
          laboratorio: typeof result.laboratorio === 'string' ? result.laboratorio : null,
          tipo_exame: laudo.tipo_exame,
        },
      })
    }
  }

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum resultado encontrado para este pet no período.' },
      { status: 404 },
    )
  }

  const petNome = pet.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `resultados_${petNome}_${dateStr}`

  if (format === 'csv') {
    const csv = buildCsv(items)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      'Cache-Control': 'no-store',
      ...(rateLimitDegraded ? { 'X-RateLimit-Policy': 'degraded-read-only' } : {}),
      },
    })
  }

  // XLSX: construção manual em XML (formato OpenXML simplificado)
  // Não depende de dependências externas para manter o bundle pequeno
  const xlsx = buildXlsx(items, pet.nome)
  return new NextResponse(new Uint8Array(xlsx), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Cache-Control': 'no-store',
        ...(rateLimitDegraded ? { 'X-RateLimit-Policy': 'degraded-read-only' } : {}),
    },
  })
}

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────

type ExamItem = {
  parametro: string
  categoria: string
  valor: number | null
  unidade: string | null
  ref_min: number | null
  ref_max: number | null
  status_ref: string | null
  data_coleta: string | null
  especie: string
  extracted_at: string
  laudos_pdf: {
    nome_arquivo: string
    laboratorio: string | null
    tipo_exame: string
  } | null
}

function categoryKey(key: HemogramaKey) {
  const category = getCategoryForLabKey(key)
  if (category === 'Série Vermelha') return 'serie_vermelha'
  if (category === 'Série Branca') return 'serie_branca'
  if (category === 'Plaquetas') return 'plaquetas'
  if (category === 'Bioquímica Hepática') return 'bioquimica_hepatica'
  return 'bioquimica_renal'
}

// ──────────────────────────────────────────────────────────────
// Labels de parâmetros em português
// ──────────────────────────────────────────────────────────────
const PARAM_LABELS: Record<string, string> = {
  hemacias: 'Hemácias',
  hemoglobina: 'Hemoglobina',
  hematocrito: 'Hematócrito',
  vcm: 'VCM',
  hcm: 'HCM',
  chcm: 'CHCM',
  rdw: 'RDW',
  leucocitos_totais: 'Leucócitos Totais',
  neutrofilos_segmentados: 'Neutrófilos Segmentados',
  neutrofilos_bastoes: 'Bastonetes',
  linfocitos: 'Linfócitos',
  monocitos: 'Monócitos',
  eosinofilos: 'Eosinófilos',
  basofilos: 'Basófilos',
  plaquetas_contagem: 'Plaquetas',
  plaquetas_vpm: 'VPM (Plaquetas)',
  ureia: 'Uréia',
  creatinina: 'Creatinina',
  alt_tgp: 'ALT (TGP)',
  ast_tgo: 'AST (TGO)',
  fosforo: 'Fósforo',
  potassio: 'Potássio',
  sodio: 'Sódio',
  albumina: 'Albumina',
  proteina_total: 'Proteína Total',
}

const CATEGORIA_LABELS: Record<string, string> = {
  serie_vermelha: 'Série Vermelha',
  serie_branca: 'Série Branca',
  plaquetas: 'Plaquetas',
  bioquimica_renal: 'Bioquímica Renal',
  bioquimica_hepatica: 'Bioquímica Hepática',
}

const STATUS_LABELS: Record<string, string> = {
  normal: 'Normal',
  alto: 'Elevado',
  baixo: 'Reduzido',
  indisponivel: '—',
}

// ──────────────────────────────────────────────────────────────
// CSV builder
// ──────────────────────────────────────────────────────────────
function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  const str = typeof value === 'string' && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCsv(items: ExamItem[]): string {
  const headers = [
    'Data Coleta',
    'Categoria',
    'Parâmetro',
    'Valor',
    'Unidade',
    'Ref. Mín.',
    'Ref. Máx.',
    'Status',
    'Espécie',
    'Laboratório',
    'Tipo Exame',
  ]

  const rows = items.map((item) => [
    item.data_coleta ?? '',
    CATEGORIA_LABELS[item.categoria] ?? item.categoria,
    PARAM_LABELS[item.parametro] ?? item.parametro,
    item.valor !== null ? String(item.valor).replace('.', ',') : '',
    item.unidade ?? '',
    item.ref_min !== null ? String(item.ref_min).replace('.', ',') : '',
    item.ref_max !== null ? String(item.ref_max).replace('.', ',') : '',
    STATUS_LABELS[item.status_ref ?? ''] ?? item.status_ref ?? '',
    item.especie,
    item.laudos_pdf?.laboratorio ?? '',
    item.laudos_pdf?.tipo_exame ?? '',
  ])

  const allRows = [headers, ...rows]
  return '\uFEFF' + allRows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  // \uFEFF = BOM para UTF-8, garante que Excel abre corretamente com acentos
}

// ──────────────────────────────────────────────────────────────
// XLSX builder (OpenXML mínimo, sem dependências externas)
// Gera um .xlsx válido com uma planilha, sem fórmulas
// ──────────────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildXlsx(items: ExamItem[], petNome: string): Buffer {
  const headers = [
    'Data Coleta', 'Categoria', 'Parâmetro', 'Valor',
    'Unidade', 'Ref. Mín.', 'Ref. Máx.', 'Status', 'Espécie',
    'Laboratório', 'Tipo Exame',
  ]

  // Shared strings para texto (evita repetição de strings no XML)
  const sharedStrings: string[] = []
  const ssMap = new Map<string, number>()

  function ss(val: string): number {
    if (ssMap.has(val)) return ssMap.get(val)!
    const idx = sharedStrings.length
    sharedStrings.push(val)
    ssMap.set(val, idx)
    return idx
  }

  // Monta as células de cada linha
  type CellData = { t: 's' | 'n' | 'd'; v: number | string }
  const sheetRows: CellData[][] = []

  // Cabeçalho
  sheetRows.push(headers.map((h) => ({ t: 's' as const, v: ss(h) })))

  // Dados
  for (const item of items) {
    sheetRows.push([
      { t: 's', v: ss(item.data_coleta ?? '') },
      { t: 's', v: ss(CATEGORIA_LABELS[item.categoria] ?? item.categoria) },
      { t: 's', v: ss(PARAM_LABELS[item.parametro] ?? item.parametro) },
      item.valor !== null ? { t: 'n', v: item.valor } : { t: 's', v: ss('') },
      { t: 's', v: ss(item.unidade ?? '') },
      item.ref_min !== null ? { t: 'n', v: item.ref_min } : { t: 's', v: ss('') },
      item.ref_max !== null ? { t: 'n', v: item.ref_max } : { t: 's', v: ss('') },
      { t: 's', v: ss(STATUS_LABELS[item.status_ref ?? ''] ?? '') },
      { t: 's', v: ss(item.especie) },
      { t: 's', v: ss(item.laudos_pdf?.laboratorio ?? '') },
      { t: 's', v: ss(item.laudos_pdf?.tipo_exame ?? '') },
    ])
  }

  const colLetters = ['A','B','C','D','E','F','G','H','I','J','K']

  // Gera o XML da planilha
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${sheetRows.map((row, ri) =>
  `    <row r="${ri + 1}">${row.map((cell, ci) => {
    const ref = `${colLetters[ci]}${ri + 1}`
    if (cell.t === 'n') return `<c r="${ref}" t="n"><v>${cell.v}</v></c>`
    return `<c r="${ref}" t="s"><v>${cell.v}</v></c>`
  }).join('')}</row>`
).join('\n')}
  </sheetData>
</worksheet>`

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map((s) => `  <si><t>${escapeXml(s)}</t></si>`).join('\n')}
</sst>`

  const safeSheetName = `Resultados ${petNome}`.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Resultados'
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  // Monta o ZIP manualmente (formato OpenXML = ZIP)
  // Usa a biblioteca de compressão nativa do Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require('adm-zip') as typeof import('adm-zip')
  const zip = new AdmZip()
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf8'))
  zip.addFile('_rels/.rels', Buffer.from(rootRels, 'utf8'))
  zip.addFile('xl/workbook.xml', Buffer.from(workbookXml, 'utf8'))
  zip.addFile('xl/_rels/workbook.xml.rels', Buffer.from(workbookRels, 'utf8'))
  zip.addFile('xl/worksheets/sheet1.xml', Buffer.from(sheetXml, 'utf8'))
  zip.addFile('xl/sharedStrings.xml', Buffer.from(ssXml, 'utf8'))

  return zip.toBuffer()
}
