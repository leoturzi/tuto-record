# Runtime resources (`resources`)

Images that the main process loads while the app runs. They are made from the logo in [`build`](../build/README.md).

| File                 | Used for                                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon.png`           | The window icon on Windows and Linux (macOS takes the icon from the app bundle instead). A 512 px rounded square.                                                                            |
| `icon-mac.png`       | The Dock icon in dev mode (`npm run dev`), where macOS would otherwise show Electron's icon. It has the margin and shadow macOS icons use, so it looks like the packaged app's icon. 512 px. |
| `watermark-logo.png` | The logo of the Watermark: only the camera, solid `#e6e6e6`, on a transparent background, cropped to the camera (345 × 256). The opacity is applied when drawing, not in the file.           |

They are imported with Vite's `?asset` suffix: `icon.png` in [`src/main/windows.ts`](../src/main/README.md#windowsts--the-two-windows), `icon-mac.png` in [`src/main/index.ts`](../src/main/README.md#indexts--wiring-and-lifecycle), `watermark-logo.png` in [`src/main/captureElectron.ts`](../src/main/README.md#capture).

## Remaking `watermark-logo.png`

It is a finished asset, made once from [`build/icon.png`](../build/icon.png) with `sharp`:

1. Take the alpha of each pixel from how far its red channel is from the green background's towards white, `(R - bgR - 12) / (255 - bgR - 24)`, clamped to 0 to 1 and multiplied by the pixel's own alpha. The 12 levels cut off at each end drop the noise in the green.
2. `trim()` to the camera and resize to 256 px high.
3. Set every pixel's colour to `#e6e6e6`, keeping its alpha. This comes **after** resizing, which would otherwise overshoot the colour at the edges.

The colour must equal `INK_COLOR` in [`src/main/watermark.ts`](../src/main/watermark.ts); a test checks it.
