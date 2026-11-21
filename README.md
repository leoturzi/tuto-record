<p align="center"><img src="build/icon.png" alt="tuto-record logo" width="128"></p>

# tuto-record

A macOS app that saves a screenshot of every display each time you click, so your clicks can later be turned into a step-by-step tutorial. Press Start, use your computer as usual, press Stop: your folder is full of screenshots, one per display per click, with a red ring and a cursor arrow showing where you clicked.

Version 0.1 runs on Apple Silicon Macs.

## Using it

### First launch: permissions

tuto-record needs two macOS permissions, and asks for them one after the other:

1. **Accessibility**, so it can notice your clicks in any app. Turn tuto-record on in System Settings → Privacy & Security.
2. **Screen Recording**, so it can take the screenshots. Within a couple of seconds of granting the first one, macOS asks for this one too.

The window shows the state of each permission and has an **Open Settings** button for it. macOS usually applies Screen Recording only after a restart, so press **Relaunch app** once it is on. When both are granted the window says so. macOS 15 and later also shows an occasional reminder that the app can record the screen; that is expected.

### Choose a folder

Press **Choose folder…** and pick where the screenshots should go. They are saved directly in that folder, with no subfolders, and the choice is remembered. **Open folder** shows it in Finder. If the folder is deleted or becomes read-only, the window says so and recording is not possible until it is fixed.

### Record

**Start recording** is enabled once both permissions are granted and a folder is chosen. Press it, or press **⌃⌥⌘R** (Control, Option, Command, R).

- The window hides, so it never appears in your screenshots.
- Every **left click** anywhere on any display saves a screenshot. Right clicks, middle clicks and scrolling do nothing. Clicks less than 0.3 seconds apart count once, so a double-click is one capture.
- The Dock icon shows a number: the captures so far.

To stop, press **⌃⌥⌘R** again or click the app's Dock icon. The window comes back and shows how many captures were saved. The Dock click that stops the recording is not kept as a capture.

If saving fails (the folder was removed, the disk is full, Screen Recording was switched off), recording stops, a notification says why, and the window shows the same message.

## What gets saved

Each counted click is one **capture**: one PNG per connected display, saved in your folder as:

```
2026-11-21_09-15-42-123_d1.png
2026-11-21_09-15-42-123_d2.png
```

- The name is the local time of the click, so the files sort in the order you clicked. `d1` is the main display and the others follow from left to right.
- Each picture has the display's full pixel resolution, Retina included.
- The picture of the display you clicked also has a **marker** on it: a red ring with a cursor arrow, whose tip is exactly where you clicked. Other displays get a plain screenshot.

## Good to know

- **Screenshots are taken just after the click**, about 0.1 to 0.3 seconds later, so if the click opens a menu or changes a page, the screenshot may already show the result.
- **The cursor drawn is always an arrow**, whatever the real pointer looked like (text cursor, hand, resize handle). The real pointer is not part of a screen capture.
- **Another app may own ⌃⌥⌘R.** If so, the window warns you; the Start and Stop button still works.
- **The app is not notarized by Apple.** If you receive a copy from someone else, macOS may block the first launch: right-click the app, choose **Open**, or allow it under System Settings → Privacy & Security.

## More documentation

| Document                              | What it covers                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Development guide](src/README.md)    | Installing, building, running in development, setup, troubleshooting, and the source layout |
| [Glossary](GLOSSARY.md)               | The words this project uses (recording, click, capture, screenshot, marker, output folder)  |
| [MVP plan](plans/MVP_PLAN.md)         | The plan for version 0.1 and its progress notes                                             |
| [Decision records](docs/adr)          | Why the hard-to-reverse choices were made                                                   |
| [Working rules for Claude](CLAUDE.md) | How Claude works in this project, including keeping the documentation up to date            |
