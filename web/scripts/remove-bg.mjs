/**
 * remove-bg.mjs — v2 (Flood Fill + Antialiasing)
 * Algoritmo BFS a partir dos 4 cantos para remoção precisa do fundo.
 * Muito mais confiavel que threshold simples — trata antialiasing nas bordas.
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const FILES = [
  path.join(ROOT, 'public', 'logo.png'),
  path.join(ROOT, 'public', 'images', 'logo-oficial.png'),
]

// Tolerância de cor: quanto um pixel pode diferir do fundo e ainda ser removido
const TOLERANCE = 35
// Tolerância extra para antialiasing nas bordas (pixels semitransparentes)
const EDGE_TOLERANCE = 80

async function removeBg(filePath) {
  console.log(`\nProcessando: ${filePath}`)

  const { data: rawData, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const data = new Uint8Array(rawData)
  const total = width * height

  // ── 1. Detecta cor de fundo pelo pixel do canto superior-esquerdo ──────────
  const bgR = data[0], bgG = data[1], bgB = data[2]
  console.log(`  Cor de fundo detectada: rgb(${bgR},${bgG},${bgB})`)

  // ── 2. Flood Fill BFS dos 4 cantos ─────────────────────────────────────────
  const visited = new Uint8Array(total) // 0=nao visitado, 1=fundo, 2=logo
  const queue = []

  function colorDiff(i) {
    const idx = i * 4
    return (
      Math.abs(data[idx]     - bgR) +
      Math.abs(data[idx + 1] - bgG) +
      Math.abs(data[idx + 2] - bgB)
    )
  }

  function enqueue(i) {
    if (i >= 0 && i < total && !visited[i] && colorDiff(i) < TOLERANCE) {
      visited[i] = 1
      queue.push(i)
    }
  }

  // Semeia a partir de todos os pixels da borda da imagem
  for (let x = 0; x < width; x++) {
    enqueue(x)                         // topo
    enqueue((height - 1) * width + x)  // base
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width)                 // esquerda
    enqueue(y * width + width - 1)    // direita
  }

  // BFS
  while (queue.length > 0) {
    const i = queue.pop()
    const x = i % width
    const y = Math.floor(i / width)

    if (x > 0)          enqueue(i - 1)
    if (x < width - 1)  enqueue(i + 1)
    if (y > 0)          enqueue(i - width)
    if (y < height - 1) enqueue(i + width)
  }

  // ── 3. Apaga pixels de fundo identificados pelo BFS ────────────────────────
  let removedCount = 0
  for (let i = 0; i < total; i++) {
    if (visited[i] === 1) {
      data[i * 4 + 3] = 0
      removedCount++
    }
  }
  console.log(`  BFS removeu ${removedCount} pixels de fundo`)

  // ── 4. Antialiasing: suaviza bordas (pixels adjacentes ao fundo) ───────────
  let edgeCount = 0
  for (let i = 0; i < total; i++) {
    if (visited[i] === 1) continue // já transparente

    const x = i % width
    const y = Math.floor(i / width)

    // Verifica se tem vizinho transparente
    const neighbors = []
    if (x > 0)          neighbors.push(i - 1)
    if (x < width - 1)  neighbors.push(i + 1)
    if (y > 0)          neighbors.push(i - width)
    if (y < height - 1) neighbors.push(i + width)

    const hasTransparentNeighbor = neighbors.some(n => visited[n] === 1)
    if (!hasTransparentNeighbor) continue

    const diff = colorDiff(i)
    if (diff < EDGE_TOLERANCE) {
      // Pixel de borda: alpha proporcional à distância do fundo
      const alpha = Math.round((diff / EDGE_TOLERANCE) * 255)
      data[i * 4 + 3] = Math.min(data[i * 4 + 3], alpha)
      edgeCount++
    }
  }
  console.log(`  Antialiasing suavizou ${edgeCount} pixels de borda`)

  // ── 5. Salva PNG com transparência ─────────────────────────────────────────
  await sharp(Buffer.from(data.buffer), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(filePath + '.tmp.png')

  const fs = await import('fs')
  fs.default.renameSync(filePath + '.tmp.png', filePath)

  const { hasAlpha, channels } = await sharp(filePath).metadata()
  console.log(`  ✓ Salvo — channels: ${channels}, hasAlpha: ${hasAlpha}`)
}

async function main() {
  for (const file of FILES) {
    await removeBg(file)
  }
  console.log('\n✓ Logos com fundo 100% transparente.')
}

main().catch(console.error)
