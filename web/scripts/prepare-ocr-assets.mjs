import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const assets = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'public/vendor/tesseract/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'public/vendor/tesseract/core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'public/vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', 'public/vendor/tesseract/lang/por.traineddata.gz'],
]

for (const [sourceRelative, targetRelative] of assets) {
  const source = resolve(root, sourceRelative)
  const target = resolve(root, targetRelative)
  if (!existsSync(source)) throw new Error(`OCR asset ausente: ${sourceRelative}`)
  mkdirSync(dirname(target), { recursive: true })
  if (!existsSync(target) || statSync(target).size !== statSync(source).size) {
    copyFileSync(source, target)
  }
}

console.log(`OCR local pronto (${assets.length} arquivos same-origin).`)
