/**
 * Geração de PDF da planilha evolutiva laboratorial.
 * Usa jspdf + jspdf-autotable para layout tabular formatado.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FreePatient, FreeLabExam } from './types'
import { getParamCategory, CATEGORY_ORDER, type LabCategory } from './categories'

/**
 * Gera e dispara download de PDF com a planilha evolutiva completa.
 *
 * @param patient - Dados do paciente
 * @param exams - Exames laboratoriais
 */
export async function exportToPdf(
  patient: FreePatient,
  exams: FreeLabExam[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // ─── Cabeçalho ─────────────────────────────────────────────────────────
  doc.setFillColor(26, 46, 90) // brand-500
  doc.rect(0, 0, 297, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Planilha Evolutiva Laboratorial', 14, 12)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`${patient.petName} · ${patient.species}${patient.breed ? ` · ${patient.breed}` : ''} · Tutor: ${patient.tutorName}`, 14, 19)

  doc.setFontSize(8)
  doc.setTextColor(180, 195, 220)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} · Vet do Rim — vetdorim.com.br`, 14, 25)

  let startY = 34

  // ─── Tabelas por categoria ─────────────────────────────────────────────
  const allParams = Array.from(new Set(exams.flatMap(e => e.parameters.map(p => p.name)))).sort()
  const groupedParams = CATEGORY_ORDER.map(cat => ({
    category: cat,
    params: allParams.filter(n => getParamCategory(n) === cat),
  })).filter(g => g.params.length > 0)

  for (const group of groupedParams) {
    if (startY > 180) {
      doc.addPage()
      startY = 14
    }

    const tableData = buildCategoryTable(group.category, group.params, exams)

    autoTable(doc, {
      startY,
      head: [['Parâmetro', 'Unidade', ...exams.map(e => e.examDate)]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [26, 46, 90],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.5,
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 36 },
        1: { halign: 'center', cellWidth: 18, textColor: [100, 116, 139] },
      },
      didParseCell(data) {
        // Destaca valores fora da referência em vermelho
        if (data.section === 'body' && data.column.index >= 2) {
          const rowIdx = data.row.index
          const paramName = group.params[rowIdx]
          if (paramName) {
            const examIdx = data.column.index - 2
            const exam = exams[examIdx]
            if (exam) {
              const p = exam.parameters.find(par => par.name === paramName)
              if (p?.refMin && p?.refMax) {
                const v = parseFloat(p.value)
                const mn = parseFloat(p.refMin)
                const mx = parseFloat(p.refMax)
                if (!isNaN(v) && !isNaN(mn) && !isNaN(mx) && (v < mn || v > mx)) {
                  data.cell.styles.textColor = [220, 38, 38]
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            }
          }
        }
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.2,
    })

    // Subtítulo da categoria
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 20
    startY = finalY + 6
  }

  // ─── Rodapé / Disclaimer ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text(
      '⚠️ Documento de caráter educacional. Não substitui a avaliação veterinária presencial. Gerado por Vet do Rim — vetdorim.com.br',
      14,
      200
    )
    doc.text(`Página ${i} de ${pageCount}`, 270, 200, { align: 'right' })
  }

  // ─── Download ──────────────────────────────────────────────────────────
  const fileName = `VetDoRim_${patient.petName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

/**
 * Constrói a matriz de dados de uma categoria para a tabela PDF.
 */
function buildCategoryTable(
  _category: LabCategory,
  params: string[],
  exams: FreeLabExam[]
): string[][] {
  return params.map(paramName => {
    let unit = ''
    const values = exams.map(exam => {
      const found = exam.parameters.find(p => p.name === paramName)
      if (found) {
        if (!unit && found.unit) unit = found.unit
        return found.value
      }
      return '—'
    })
    return [paramName, unit, ...values]
  })
}
