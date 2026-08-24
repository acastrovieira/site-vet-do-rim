'use client'

import { parseLocalLabText } from './text-parser.ts'
import type { LocalExtractionDraft } from './types.ts'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PAGES = 20
const MAX_OCR_PAGES = 10
const MAX_CANVAS_PIXELS = 2_500_000
const MIN_DIGITAL_TEXT_CHARS = 40

export interface LocalPdfExtractionProgress {
  phase: 'reading' | 'text' | 'ocr-loading' | 'ocr'
  current: number
  total: number
  message: string
}

interface ExtractOptions {
  signal?: AbortSignal
  onProgress?: (progress: LocalPdfExtractionProgress) => void
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Operação cancelada', 'AbortError')
}

function textItemLines(items: readonly unknown[]) {
  const positioned = items
    .filter((item): item is { str: string; transform: number[]; width?: number } => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as { str?: unknown; transform?: unknown }
      return typeof candidate.str === 'string'
        && Array.isArray(candidate.transform)
        && candidate.transform.length >= 6
    })
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
    }))
    .filter((item) => item.text)
    .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x)

  const lines: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = []
  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2)
    if (line) line.parts.push({ x: item.x, text: item.text })
    else lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] })
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' '))
    .join('\n')
}

export async function extractLocalDraftFromPdf(
  file: File,
  options: ExtractOptions = {},
): Promise<LocalExtractionDraft> {
  if (file.type !== 'application/pdf') throw new Error('Apenas arquivos PDF são aceitos.')
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new Error('O PDF deve ter no máximo 10 MB.')
  assertNotAborted(options.signal)
  options.onProgress?.({ phase: 'reading', current: 0, total: 1, message: 'Abrindo PDF no dispositivo…' })

  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await loadingTask.promise

  try {
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) {
      throw new Error(`O PDF deve ter entre 1 e ${MAX_PAGES} páginas.`)
    }

    const digitalPages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      assertNotAborted(options.signal)
      options.onProgress?.({
        phase: 'text', current: pageNumber, total: pdf.numPages,
        message: `Lendo texto da página ${pageNumber} de ${pdf.numPages}…`,
      })
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      digitalPages.push(textItemLines(content.items))
      page.cleanup()
    }

    const digitalDraft = parseLocalLabText(digitalPages, 'pdf-text')
    const digitalCharacterCount = digitalPages.join('').replace(/\s/g, '').length
    if (digitalCharacterCount >= MIN_DIGITAL_TEXT_CHARS && digitalDraft.items.length > 0) {
      return digitalDraft
    }

    if (pdf.numPages > MAX_OCR_PAGES) {
      throw new Error(`O PDF parece escaneado. O OCR local aceita até ${MAX_OCR_PAGES} páginas por vez.`)
    }

    options.onProgress?.({ phase: 'ocr-loading', current: 0, total: pdf.numPages, message: 'Preparando OCR local…' })
    const { createWorker, OEM, PSM } = await import('tesseract.js')
    let workerTerminated = false
    const worker = await createWorker('por', OEM.LSTM_ONLY, {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/core',
      langPath: '/vendor/tesseract/lang',
      logger(message) {
        if (message.status !== 'recognizing text') return
        options.onProgress?.({
          phase: 'ocr', current: Math.max(0, message.progress), total: 1,
          message: `Reconhecendo texto localmente… ${Math.round(message.progress * 100)}%`,
        })
      },
    })

    const terminateWorker = () => {
      if (workerTerminated) return
      workerTerminated = true
      void worker.terminate()
    }
    options.signal?.addEventListener('abort', terminateWorker, { once: true })

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      })
      const ocrPages: string[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        assertNotAborted(options.signal)
        options.onProgress?.({
          phase: 'ocr', current: pageNumber - 1, total: pdf.numPages,
          message: `OCR local na página ${pageNumber} de ${pdf.numPages}…`,
        })
        const page = await pdf.getPage(pageNumber)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height))))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new Error('Não foi possível preparar a página para OCR.')
        await page.render({ canvas, canvasContext: context, viewport }).promise
        const recognition = await worker.recognize(canvas)
        ocrPages.push(recognition.data.text)
        canvas.width = 1
        canvas.height = 1
        page.cleanup()
      }

      assertNotAborted(options.signal)
      return parseLocalLabText(ocrPages, 'ocr')
    } finally {
      options.signal?.removeEventListener('abort', terminateWorker)
      if (!workerTerminated) await worker.terminate()
    }
  } finally {
    await loadingTask.destroy()
  }
}
