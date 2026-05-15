/**
 * remove-bg.mjs
 * Remove o fundo branco/claro dos logos PNG, tornando-o transparente.
 * Usa sharp (já incluso no Next.js) — sem dependências extras.
 *
 * Algoritmo:
 *   1. Converte para RGBA
 *   2. Para cada pixel: se luminosidade > threshold E saturação baixa → alpha = 0
 *   3. Aplica fade suave nas bordas semi-transparentes (antialiasing preservado)
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')   // web/scripts/../ = web/

const FILES = [
  path.join(ROOT, 'public', 'logo.png'),
  path.join(ROOT, 'public', 'images', 'logo-oficial.png'),
]

// Threshold de "branco" — pixels mais claros que isso viram transparentes
// 240 = branco quase puro; 220 = inclui tons levemente acinzentados
const WHITE_THRESHOLD = 240
const TOLERANCE = 30 // fade de borda para suavizar antialiasing

async function removeBg(filePath) {
  console.log(`Processando: ${filePath}`)

  const img = sharp(filePath)
  const { width, height } = await img.metadata()

  // Obtem buffer RGBA bruto
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8Array(data)
  const totalPixels = info.width * info.height

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const r = pixels[idx]
    const g = pixels[idx + 1]
    const b = pixels[idx + 2]
    // alpha já em pixels[idx + 3]

    // Luminância aproximada
    const luma = 0.299 * r + 0.587 * g + 0.114 * b

    // Saturação: diferença máxima entre canais RGB
    const cmax = Math.max(r, g, b)
    const cmin = Math.min(r, g, b)
    const saturation = cmax - cmin

    if (luma >= WHITE_THRESHOLD && saturation < TOLERANCE) {
      // Pixel branco/cinza claro → transparente
      // Fade proporcional: quanto mais claro, mais transparente
      const alphaFactor = 1 - (luma - WHITE_THRESHOLD) / (255 - WHITE_THRESHOLD)
      pixels[idx + 3] = Math.round(alphaFactor * 255)
    }
  }

  // Salva o resultado como PNG com transparência
  await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(filePath + '.tmp.png')

  // Substitui o original
  const fs = await import('fs')
  fs.default.renameSync(filePath + '.tmp.png', filePath)

  console.log(`  ✓ Fundo removido → ${filePath}`)
}

async function main() {
  for (const file of FILES) {
    await removeBg(file)
  }
  console.log('\nPronto! Todos os logos têm fundo transparente agora.')
}

main().catch(console.error)
