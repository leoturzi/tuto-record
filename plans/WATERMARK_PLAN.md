# tuto-record — Watermark plan

Every Screenshot gets a **Watermark**: the camera from the logo and the words "Tuto-Record", in light gray on a small translucent dark plate, in the bottom-right corner. Recording, the preview, the Settings window and the IPC contract do not change. Built on the `feat/watermark` branch, as one pull request into `main`.

---

## 1. Decisions (from the design grill, 2026-11-25)

| #   | Topic     | Decision                                                                                                                                                                                                                                                                                                 |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Where     | Every display's Screenshot in a Capture, not only the clicked one. Bottom-right corner                                                                                                                                                                                                                   |
| W2  | Permanent | Drawn into the saved PNG. No clean original is kept                                                                                                                                                                                                                                                      |
| W3  | Optional  | On. Turned off only by editing the code: the exported constant `WATERMARK_ENABLED`. No setting, no IPC, no UI                                                                                                                                                                                            |
| W4  | Look      | Two layers: a **plate**, a rounded rectangle in black at 45 % opacity, and on it the **logo and text** in `#e6e6e6` at 85 % opacity. No border, halo or shadow. Option B of the mocks; it replaces plain `#808080` at 45 %, which was too faint on dark and invisible on mid-gray                        |
| W5  | Logo      | A new file, `resources/watermark-logo.png`: only the camera, solid `#e6e6e6`, transparent background. The opacity is applied when drawing, not in the file                                                                                                                                               |
| W6  | Text      | "Tuto-Record", system sans-serif, weight 600, to the right of the logo and vertically centred on it                                                                                                                                                                                                      |
| W7  | Size      | From `s`, the shorter side of the Screenshot: logo height 3 % of `s` (at least 14 px). The plate is 2 % of `s` from the right and bottom edges. Relative to the logo height: text 60 %, gap 30 %, plate padding 40 % at the sides and 30 % at the top and bottom. Corner radius 18 % of the plate height |
| W8  | Order     | The Watermark first, the Marker on top, so the Click is never hidden                                                                                                                                                                                                                                     |
| W9  | Failure   | Fails the whole Capture and removes its files, as a Marker error does                                                                                                                                                                                                                                    |
| W10 | Docs      | **Watermark** joins the glossary; no ADR. Ships as v0.3.2, bumped in the same pull request (first planned without a bump)                                                                                                                                                                                |

## 2. What was checked before planning

Tried on 2026-11-25 with the project's `sharp` (0.35, librsvg 2.63), in x64 Node and in the arm64 Electron runtime.

- **Fonts:** SVG text renders with system fonts. `sans-serif` gives Helvetica, which has no semi-bold, so weight 600 **comes out as bold**. Not yet checked in the packaged app.
- **Logo:** the camera can be cut out of [`build/icon.png`](../build/icon.png) by colour (white on flat green, about `rgb(10, 123, 71)`), keeping smooth edges and the shutter lines. The camera is 768 × 570 px there.
- **W5 refined, crop the file to the camera:** in a square file the camera would fill only about 3/4 of the height, so W7's sizes and the vertical centring would be off. The file is cropped to the camera and 256 px high (about 345 × 256). The largest size needed is about 100 px (a 6K display).
- **W6 refined, measure the text:** SVG cannot measure text, so the text is rendered on its own, trimmed and then placed. No base64 logo inside an SVG is needed.
- **Cost:** average of 3 runs on arm64, on synthetic images.

  | Image       | Marker only (today) | Watermark only | Two passes | One pass, both |
  | ----------- | ------------------- | -------------- | ---------- | -------------- |
  | 2880 × 1800 | 85 ms               | 74 ms          | 161 ms     | 88 ms          |
  | 5120 × 2880 | 272 ms              | 206 ms         | 495 ms     | not measured   |

  All of it happens after the screen is grabbed, so it does not change what is captured. Captures are not queued, so slow ones overlap when clicking fast (Clicks count from 300 ms apart).

- **Legibility of W4:** contrast between the logo and text and the plate is 2.4 on white, 11.1 on `#1e1e1e`, 6.0 on `#808080` and 7.1 on blue (`#2b6cb0`). White is the weakest case: still readable, but soft. A plate at 60 to 65 % would fix it; it is one constant.
- **Unclicked displays are re-encoded:** today their PNG is written exactly as Electron produced it. With the Watermark, `sharp` re-encodes it, as it already does for the clicked display. Colours and file sizes are compared in the manual check.

### One drawing pass

Two passes would encode the clicked display's PNG twice, so the Watermark and the Marker are layers of a single `composite`. This replaces the separate `drawWatermark` dependency discussed in the grill. The costs above were measured without the plate, which adds one small layer.

---

## 3. M1 — Logo file

- Make `resources/watermark-logo.png` from `build/icon.png` with a throwaway `sharp` script (not committed):
  1. Alpha per pixel: how far the red channel is from the background's towards white, `(R - bgR) / (255 - bgR)`, with 12 levels cut off at each end to drop the noise in the green, multiplied by the pixel's own alpha.
  2. Colour `#e6e6e6` everywhere.
  3. `trim()` to the camera, then resize to 256 px high.
- Docs: a row in [`resources/README.md`](../resources/README.md) and how the file was made. [`build/README.md`](../build/README.md) ("About the icons") gets a one-line reminder to redo it when the logo changes.

**✅ Check:** look at the file on mid-gray and on dark: clean edges, shutter lines open, no green left, no empty margin.

## 4. M2 — Geometry and drawing

### 4.1 `src/main/watermarkGeometry.ts` (pure)

```ts
/** Sizes in pixels for a Screenshot of this size (W7), rounded to whole pixels. */
export interface WatermarkLayout {
  logoHeight: number
  textSize: number
  gap: number
  margin: number
  paddingX: number
  paddingY: number
  radius: number
}
export function watermarkLayout(size: { width: number; height: number }): WatermarkLayout
```

Constants: `LOGO_RATIO = 0.03`, `LOGO_MIN_PX = 14`, `MARGIN_RATIO = 0.02`, `TEXT_RATIO = 0.6`, `GAP_RATIO = 0.3`, `PADDING_X_RATIO = 0.4`, `PADDING_Y_RATIO = 0.3`, `RADIUS_RATIO = 0.18`.

Tests (`tests/watermarkGeometry.test.ts`): 2880 × 1800; an ultrawide and a portrait image use the shorter side; the 14 px minimum.

### 4.2 `src/main/watermark.ts`

```ts
export const WATERMARK_ENABLED = true
export const PLATE_COLOR = '#000000'
export const PLATE_OPACITY = 0.45
export const INK_COLOR = '#e6e6e6' // the text; the logo file has the same colour
export const INK_OPACITY = 0.85

/** The layer that draws the Watermark on a Screenshot of this size, or null when it is off. */
export function createWatermark(deps: {
  loadLogo(): Promise<Buffer>
  enabled?: boolean // defaults to WATERMARK_ENABLED; lets tests turn it off
}): (size: { width: number; height: number }) => Promise<OverlayOptions | null>
```

- Resize the logo; render the text as SVG on an oversized transparent canvas and `trim()` it; put both on a transparent block, `logoHeight` high, as wide as logo + gap + text; multiply its alpha by `INK_OPACITY` once, over the whole block.
- Draw the plate (an SVG rounded rectangle, the block plus padding) and composite the block on it. The two become one layer, so it reaches the Screenshot in one step.
- Place the layer so the plate's right and bottom edges are `margin` px from the Screenshot's edges.
- The logo is a dependency because `?asset` imports do not work in Vitest.
- When off, `loadLogo` is never called.

### 4.3 `src/main/overlays.ts`

```ts
/** Draws the Watermark, then the Marker (clicked display only), in one pass (W8). */
export function createOverlays(deps: {
  watermark: ReturnType<typeof createWatermark>
}): (
  png: Buffer,
  size: { width: number; height: number },
  marker: MarkerSpec | null
) => Promise<Buffer>
```

- No layers (Watermark off, no Marker): returns `png` itself, not re-encoded.
- `marker.ts`: `drawMarker` is replaced by `markerLayer(spec): OverlayOptions`. `markerSvg` is unchanged. `tests/marker.test.ts` composites the layer in a small helper; its assertions stay.

Tests, on real rendered pixels:

- `tests/watermark.test.ts`: bottom-right changes and the rest of the image does not; a pixel of the plate off the logo and text is about 140 on white and 0 on black; a pixel inside the camera body is about 217 on white and 196 on black; the corners of the plate are rounded; the right and bottom margins hold; the logo file's colour is `INK_COLOR`; the layer doubles when the image doubles; off returns `null` without loading the logo; a failing `loadLogo` rejects. Text checks only ask that something is drawn right of the logo, never exact glyph pixels, so they do not depend on fonts. The real `resources/watermark-logo.png` is read from disk.
- `tests/overlays.test.ts`: size and format kept; no layers returns the same buffer; where the Marker and the Watermark overlap, the cursor stays pure black.

**✅ Check:** `npm run typecheck`, `npm run lint`, `npm test`.

## 5. M3 — Capture

- `capture.ts`: in `CaptureDeps`, `drawMarker` becomes `drawOverlays(png, size, marker)`. It is called for every display, with `size` = the display's `pixelSize` and `marker` = `markerSpec(…)` for the clicked display, `null` otherwise. The all-or-nothing clean-up already covers W9.
- `captureElectron.ts`:

  ```ts
  import watermarkLogo from '../../resources/watermark-logo.png?asset'
  // readFile, not sharp(path): Node reads inside app.asar, native code does not.
  const watermark = createWatermark({ loadLogo: () => readFile(watermarkLogo) })
  ```

  `resources/**` is already unpacked by `electron-builder.yml`, so packaging needs no change.

- Tests (`tests/capture.test.ts`): the fake becomes `drawOverlays`, marking its output `+watermark` and, with a Marker, `+marker`. Cover: every display is drawn on; only the clicked one gets a Marker; the size passed is each display's real pixel size, also after a resize; a drawing error on **any** display, clicked or not, fails the Capture and leaves no files.

**✅ Check:** typecheck, lint, tests; `npm run build:unpack` succeeds.

## 6. M4 — Docs

| Document                                      | Change                                                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [GLOSSARY.md](../GLOSSARY.md)                 | **Watermark**: the camera logo and the app name on a small translucent plate, in a corner of every Screenshot. _Avoid_: Stamp, badge, logo overlay                       |
| [src/main/README.md](../src/main/README.md)   | Diagram, "Life of a click" step 3, Capture file table, all-or-nothing rule, a Watermark rule (W1–W8 and the off switch), test table                                      |
| [resources/README.md](../resources/README.md) | With M1                                                                                                                                                                  |
| [build/README.md](../build/README.md)         | With M1                                                                                                                                                                  |
| [README.md](../README.md)                     | The intro and the line "Other displays get a plain screenshot" become wrong; say every picture has a small watermark in the corner. Docs table row (done with this plan) |

## 7. M5 — Verify by hand

In the packaged app (`npm run build:mac`, reset permissions, launch with `open`; see [src/README.md](../src/README.md#troubleshooting)):

- [ ] The Watermark shows on every display, in the right font and place, and readable on a white, a dark and a busy area (Retina and, if available, non-Retina and portrait).
- [ ] The Marker is on top when clicking on the Watermark.
- [ ] Colours and file size of an unclicked display's Screenshot are close to one taken with `WATERMARK_ENABLED = false`.
- [ ] Fast clicking (about 3 per second) for 10 seconds: every Capture is saved and the app stays responsive.
- [ ] `WATERMARK_ENABLED = false`: Screenshots have no Watermark, and the Marker still works.

Then the pull request, which lists any of these not done.

## 8. Progress notes (2026-11-25)

**Code and docs done (M1–M4), manual check (M5) pending.**

- `watermark.ts` also has the `WATERMARK_TEXT` constant.
- `typecheck`, `lint` and `test` pass; `npm run build:unpack` builds the app.
- Run in the packaged app's runtime, with its packaged `sharp` and the logo read from `app.asar` (not through the app's own capture): the font renders and the look matches option B.
- Drawing time there, median of 16 runs: clicked display 87 → 100 ms at 2880 × 1800 and 238 → 260 ms at 5120 × 2880; an unclicked display now takes 89 and 226 ms, where it was written without drawing before.
- v0.3.1 was published with only the packaging fix, so the Watermark ships in v0.3.2; the bump is in this branch.
- Still to do by hand: the checklist above.

## Test map

| Module                 | Test file                               | Milestone |
| ---------------------- | --------------------------------------- | --------- |
| `watermarkGeometry.ts` | `tests/watermarkGeometry.test.ts` (new) | M2        |
| `watermark.ts`         | `tests/watermark.test.ts` (new)         | M2        |
| `overlays.ts`          | `tests/overlays.test.ts` (new)          | M2        |
| `marker.ts`            | `tests/marker.test.ts`                  | M2        |
| `capture.ts`           | `tests/capture.test.ts`                 | M3        |

Checked by hand: `captureElectron.ts`.
