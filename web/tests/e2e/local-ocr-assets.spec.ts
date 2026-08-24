import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('same-origin Portuguese OCR loads and recognizes a laboratory label without an API', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')

  for (const asset of [
    '/vendor/tesseract/worker.min.js',
    '/vendor/tesseract/core/tesseract-core-lstm.wasm.js',
    '/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
    '/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js',
    '/vendor/tesseract/lang/por.traineddata.gz',
  ]) {
    const response = await page.request.get(asset)
    expect(response.ok(), `${asset} deve estar disponível`).toBe(true)
    expect((await response.body()).byteLength).toBeGreaterThan(1_000)
  }

  await page.addScriptTag({
    path: resolve(process.cwd(), 'node_modules/tesseract.js/dist/tesseract.min.js'),
  })

  const recognized = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1_200
    canvas.height = 220
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#000000'
    context.font = 'bold 64px Arial'
    context.fillText('Creatinina 2,1 mg/dL', 45, 135)

    const api = (window as typeof window & {
      Tesseract: {
        OEM: { LSTM_ONLY: number }
        createWorker: (language: string, mode: number, options: Record<string, unknown>) => Promise<{
          recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>
          terminate: () => Promise<void>
        }>
      }
    }).Tesseract
    const worker = await api.createWorker('por', api.OEM.LSTM_ONLY, {
      workerPath: '/vendor/tesseract/worker.min.js',
      corePath: '/vendor/tesseract/core',
      langPath: '/vendor/tesseract/lang',
    })
    try {
      return (await worker.recognize(canvas)).data.text
    } finally {
      await worker.terminate()
    }
  })

  expect(recognized).toMatch(/creatinina/i)
  expect(recognized).toMatch(/2[,\.]1/)
})
