# Runtime resources (`resources`)

Images that the main process loads while the app runs. They are made from the logo in [`build`](../build/README.md).

| File           | Used for                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon.png`     | The window icon on Windows and Linux (macOS takes the icon from the app bundle instead). A 512 px rounded square.                                                                            |
| `icon-mac.png` | The Dock icon in dev mode (`npm run dev`), where macOS would otherwise show Electron's icon. It has the margin and shadow macOS icons use, so it looks like the packaged app's icon. 512 px. |

Both are imported in [`src/main/index.ts`](../src/main/README.md) with Vite's `?asset` suffix.
