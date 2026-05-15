/**
 * generate-favicon.mjs
 * Gera favicon.ico (16+32+48px) e favicon.png (32px) a partir do logo.png.
 * Cria ICO nativo com PNG-inside-ICO (Windows Vista+, todos os browsers modernos).
 * Coloca o favicon.ico em src/app/ (Next.js App Router convention).
 */

import sharp from 'sharp'
import path from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const LOGO = path.join(ROOT, 'public', 'logo.png')

// ── Gera PNG com fundo branco para ICO (browsers esperam fundo sólido no favicon) ─
async function resizePng(size) {
  return sharp(LOGO)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer()
}

// ── Constrói binário .ico com múltiplos tamanhos (PNG-inside-ICO) ─────────────────
function buildIco(entries) {
  const count = entries.length
  const headerSize = 6
  const dirEntrySize = 16

  // Calcula offsets
  let offset = headerSize + count * dirEntrySize
  const dirEntries = entries.map(({ size, buffer }) => {
    const entry = Buffer.alloc(dirEntrySize)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)  // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)  // height
    entry.writeUInt8(0, 2)                         // colorCount (0 = sem paleta)
    entry.writeUInt8(0, 3)                         // reserved
    entry.writeUInt16LE(1, 4)                      // planes
    entry.writeUInt16LE(32, 6)                     // bitCount (32bpp)
    entry.writeUInt32LE(buffer.length, 8)          // tamanho do dado PNG
    entry.writeUInt32LE(offset, 12)                // offset desde o início do arquivo
    offset += buffer.length
    return entry
  })

  // Header ICONDIR
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // type: 1 = ICO
  header.writeUInt16LE(count, 4)  // número de imagens

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.buffer)])
}

async function main() {
  console.log('Gerando favicons a partir de:', LOGO)

  // Gera PNGs nos tamanhos do ICO
  const sizes = [16, 32, 48]
  const entries = await Promise.all(
    sizes.map(async (size) => {
      const buffer = await resizePng(size)
      console.log(`  PNG ${size}x${size}: ${buffer.length} bytes`)
      return { size, buffer }
    }),
  )

  // Gera favicon.ico com os 3 tamanhos
  const icoBuffer = buildIco(entries)
  const icoAppPath = path.join(ROOT, 'src', 'app', 'favicon.ico')
  const icoPubPath = path.join(ROOT, 'public', 'favicon.ico')
  await fs.writeFile(icoAppPath, icoBuffer)
  await fs.writeFile(icoPubPath, icoBuffer)
  console.log(`  ✓ favicon.ico (${icoBuffer.length} bytes) → src/app/ e public/`)

  // Gera favicon.png 32x32 com fundo branco (para browsers que preferem PNG)
  const png32 = await resizePng(32)
  const pngPubPath = path.join(ROOT, 'public', 'favicon.png')
  await fs.writeFile(pngPubPath, png32)
  console.log(`  ✓ favicon.png 32x32 → public/`)

  // Regera apple-touch-icon com logo limpo
  const png180 = await sharp(LOGO)
    .resize(160, 160, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 255, g: 255, b: 255 } })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()
  await fs.writeFile(path.join(ROOT, 'public', 'apple-touch-icon.png'), png180)
  console.log('  ✓ apple-touch-icon.png 180x180 → public/')

  console.log('\n✅ Favicons gerados com sucesso.')
}

main().catch(console.error)
