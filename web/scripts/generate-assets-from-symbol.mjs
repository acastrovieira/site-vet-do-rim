import sharp from 'sharp'
import path from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Source image: the gold symbol-only image provided by the user for favicons
const SYMBOL_SRC = path.join(ROOT, 'public', 'logo', '5.png')

async function resizePng(size) {
  // Crop tightly, no margin/padding, transparent background
  return sharp(SYMBOL_SRC)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer()
}

function buildIco(entries) {
  const count = entries.length
  const headerSize = 6
  const dirEntrySize = 16

  let offset = headerSize + count * dirEntrySize
  const dirEntries = entries.map(({ size, buffer }) => {
    const entry = Buffer.alloc(dirEntrySize)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(buffer.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += buffer.length
    return entry
  })

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.buffer)])
}

async function main() {
  await sharp(SYMBOL_SRC).metadata()
  console.log(`Generating assets from cropped symbol: ${SYMBOL_SRC}`)

  // 1. Generate favicon.ico (16, 32, 48px)
  const icoSizes = [16, 32, 48]
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => {
      const buffer = await resizePng(size)
      return { size, buffer }
    })
  )
  const icoBuffer = buildIco(icoEntries)
  await fs.writeFile(path.join(ROOT, 'public', 'favicon.ico'), icoBuffer)
  await fs.writeFile(path.join(ROOT, 'src', 'app', 'favicon.ico'), icoBuffer)
  console.log('✓ Generated public/favicon.ico and src/app/favicon.ico')

  // 2. Generate favicon.png (32x32, transparent)
  const faviconPng = await resizePng(32)
  await fs.writeFile(path.join(ROOT, 'public', 'favicon.png'), faviconPng)
  console.log('✓ Generated public/favicon.png')

  // 3. Generate apple-touch-icon.png (180x180, transparent, full fit)
  const appleTouch = await resizePng(180)
  await fs.writeFile(path.join(ROOT, 'public', 'apple-touch-icon.png'), appleTouch)
  console.log('✓ Generated public/apple-touch-icon.png')

  // 4. Generate icon-192.png (192x192, transparent)
  const icon192 = await resizePng(192)
  await fs.writeFile(path.join(ROOT, 'public', 'icon-192.png'), icon192)
  console.log('✓ Generated public/icon-192.png')

  // 5. Generate icon-512.png (512x512, transparent)
  const icon512 = await resizePng(512)
  await fs.writeFile(path.join(ROOT, 'public', 'icon-512.png'), icon512)
  console.log('✓ Generated public/icon-512.png')

  console.log('✅ Asset generation complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
