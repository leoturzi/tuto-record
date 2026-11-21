# Tutorial preview (`src/renderer/src/tutorial-preview`)

The right pane's content for a Tutorial that has images: the heading, one large image, and a horizontally scrolling strip of thumbnails.

| File                               | Role                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`previewView.ts`](previewView.ts) | Pure. `headingVariants(path)`, `buildPreview(images, selectedFile)`, `moveSelection`, `selectionAfterRemoval`, `sameImages`.         |
| [`preview.ts`](preview.ts)         | DOM. `createPreview(root, { select, trash })` → `render(images, view)`: the large image and the strip, with the ✕ on each thumbnail. |

## Behaviour

- **Heading:** the Tutorial's full path, `Python › Setup › macOS › Install`. When it does not fit, `main.ts` shows the next shorter form from `headingVariants`, where the Groups in the middle collapse to `…` one at a time (`Python › … › macOS › Install`, then `Python › … › Install`); the Project and the Tutorial always show, and the tooltip has the full path. It is measured after the header buttons are drawn, and again when the window is resized.
- **What is shown:** every image file in the Tutorial folder (main decides: png, jpg, jpeg, gif, webp), sorted by file name, one thumbnail per file. App Screenshots are named by Click time, so they come out in Click order, d1 before d2. The images come from main as `tuto-image://` URLs at two sizes (`thumbUrl`, `previewUrl`), never as file paths.
- **Selecting:** click a thumbnail, or press ← / →. The selection stops at both ends (no wrap), is outlined, and is scrolled into view. A selection that disappears (file removed in Finder) falls back to the first image. There are no arrow buttons, and **the large image does nothing when clicked**.
- **Removing:** hovering a thumbnail shows a ✕ in its top-right corner; Delete or Backspace does the same for the selected image. Main asks "Move … to the Trash?"; afterwards the next image is selected, or the previous one if it was the last.
- `state` is `none` (no Tutorial, or its images could not be read), `empty` (the recorder bar's empty state shows instead) or `images`.

## Rules

- **The strip is rebuilt only when the files change** (`sameImages` compares URLs, which include each file's version). Otherwise only the selection outline moves, so the scroll position survives the 1.5 s poll and nothing flickers.
- The keys are handled in `main.ts` and ignored while a text field has focus or a Recording is running.

## Tests

[`tests/previewView.test.ts`](../../../../tests/previewView.test.ts): heading variants, states, selection fallback, arrows at both ends, selection after removal, list comparison.
