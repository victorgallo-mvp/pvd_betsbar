// Generates PWA PNG icons from the SVG source using sharp.
// Run: node scripts/gen-icons.mjs

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../apps/web/public/icon.svg')
const outDir  = join(__dirname, '../apps/web/public')

const svgBuffer = readFileSync(svgPath)

let sharp
try {
  const m = await import('sharp')
  sharp = m.default
} catch {
  console.error('sharp not installed — run: pnpm add -D sharp --filter web')
  process.exit(1)
}

const sizes = [192, 512]
for (const size of sizes) {
  const out = join(outDir, `pwa-${size}x${size}.png`)
  await sharp(svgBuffer).resize(size, size).png().toFile(out)
  console.log(`✅ ${out}`)
}

// Also generate apple-touch-icon
await sharp(svgBuffer).resize(180, 180).png().toFile(join(outDir, 'apple-touch-icon.png'))
console.log('✅ apple-touch-icon.png')
console.log('Done.')
