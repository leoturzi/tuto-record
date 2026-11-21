// Generates every app icon from build/logo-source.jpg. Run with `npm run icons` (macOS only,
// because it uses `iconutil` to write the .icns). The outputs are committed, so this only needs
// to run when the logo changes.
//
// Outputs:
//   build/icon.icns   macOS: rounded square with the standard margin and a soft shadow
//   build/icon.ico    Windows: full-bleed rounded square, sizes 16 to 256
//   build/icon.png    1024 px full-bleed rounded square (Linux, and electron-builder's fallback)
//   resources/icon.png 512 px copy used for the window icon (Windows, Linux)
//   resources/icon-mac.png 512 px macOS-style icon (with margin) used for the Dock icon in dev mode
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const SOURCE = join(here, 'logo-source.jpg')

// The logo's background colour, measured from the source image.
const BACKGROUND = { r: 10, g: 122, b: 72 }
// The camera sits a little above the middle of the source; this moves it to the middle.
const SHIFT = { x: 2, y: 46 }

/** The source as a square PNG of `size` pixels, with the camera centred. */
async function artwork(size) {
  const meta = await sharp(SOURCE).metadata()
  const base = sharp({
    create: { width: meta.width, height: meta.height, channels: 3, background: BACKGROUND }
  })
  const centred = await base
    .composite([{ input: SOURCE, left: SHIFT.x, top: SHIFT.y }])
    .png()
    .toBuffer()
  return sharp(centred).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()
}

/** A superellipse (the "squircle" macOS icons use) as an SVG path in a `size` box. */
function squirclePath(size, exponent = 5) {
  const r = size / 2
  const points = []
  for (let i = 0; i < 360; i++) {
    const t = (i / 360) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = r + r * Math.sign(c) * Math.abs(c) ** (2 / exponent)
    const y = r + r * Math.sign(s) * Math.abs(s) ** (2 / exponent)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

const svgShape = (size, shape, fill = '#fff') =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<path d="${shape}" fill="${fill}"/></svg>`
  )

const roundedRect = (size, radius) =>
  `M${radius},0H${size - radius}A${radius},${radius} 0 0 1 ${size},${radius}V${size - radius}` +
  `A${radius},${radius} 0 0 1 ${size - radius},${size}H${radius}` +
  `A${radius},${radius} 0 0 1 0,${size - radius}V${radius}A${radius},${radius} 0 0 1 ${radius},0Z`

/** Full-bleed rounded square of `size` pixels (Windows, Linux, README). */
async function flatIcon(size) {
  const shape = svgShape(size, roundedRect(size, Math.round(size * 0.18)))
  return sharp(await artwork(size))
    .composite([{ input: shape, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** macOS icon: a 1024 canvas with the squircle at 824 px (Apple's grid) and a soft shadow. */
async function macMaster() {
  const canvas = 1024
  const body = 824
  const margin = (canvas - body) / 2
  const shape = squirclePath(body)
  const rounded = await sharp(await artwork(body))
    .composite([{ input: svgShape(body, shape), blend: 'dest-in' }])
    .png()
    .toBuffer()
  // The shadow is drawn on a larger canvas so the blur is not cut off at the shape's edge.
  const pad = 60
  const shadowBox = body + pad * 2
  const shadow = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${shadowBox}" height="${shadowBox}">` +
        `<path transform="translate(${pad} ${pad})" d="${shape}" fill="#000" fill-opacity="0.32"/></svg>`
    )
  )
    .blur(14)
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: shadow, left: margin - pad, top: margin - pad + 12 },
      { input: rounded, left: margin, top: margin }
    ])
    .png()
    .toBuffer()
}

const resized = (png, size) =>
  sharp(png).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()

/** Packs PNG images into one .ico file (PNG-compressed entries, supported since Windows Vista). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)
  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length
  entries.forEach(({ size, png }, i) => {
    const at = i * 16
    directory.writeUInt8(size >= 256 ? 0 : size, at) // 0 means 256
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1)
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, directory, ...entries.map((e) => e.png)])
}

async function main() {
  // macOS .icns
  const master = await macMaster()
  const iconset = join(await mkdtemp(join(tmpdir(), 'tuto-iconset-')), 'icon.iconset')
  await mkdir(iconset)
  for (const base of [16, 32, 128, 256, 512]) {
    await writeFile(join(iconset, `icon_${base}x${base}.png`), await resized(master, base))
    await writeFile(join(iconset, `icon_${base}x${base}@2x.png`), await resized(master, base * 2))
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(here, 'icon.icns')])
  await rm(dirname(iconset), { recursive: true, force: true })

  // Windows .ico
  const flat = await flatIcon(1024)
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const entries = []
  for (const size of sizes) entries.push({ size, png: await resized(flat, size) })
  await writeFile(join(here, 'icon.ico'), buildIco(entries))

  // PNGs
  await writeFile(join(here, 'icon.png'), flat)
  await writeFile(join(root, 'resources', 'icon.png'), await resized(flat, 512))
  await writeFile(join(root, 'resources', 'icon-mac.png'), await resized(master, 512))

  console.log(
    'Icons written: build/icon.icns, build/icon.ico, build/icon.png, resources/icon.png, resources/icon-mac.png'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
