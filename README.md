<p align="center"><img src="build/icon.png" alt="tuto-record logo" width="128"></p>

# tuto-record

A macOS app that saves a screenshot of every display each time you click, so your clicks can later be turned into a step-by-step tutorial. Pick a Tutorial, press Start, use your computer as usual, press Stop: the Tutorial now holds one screenshot per display per click, with a cursor arrow on a see-through red circle showing where you clicked and a small Tuto-Record watermark in the corner, and the window shows them all.

Version 0.3 runs on Apple Silicon Macs (M1 or later).

## Install

1. Download the latest `tuto-record-<version>.dmg` from the [Releases page](https://github.com/leoturzi/tuto-record/releases).
2. Open it and drag **tuto-record** into **Applications**.
3. Open the app. It is not notarized by Apple, so macOS blocks the first launch:
   - **macOS 15 (Sequoia) or later:** after the warning, go to **System Settings → Privacy & Security**, scroll down to the message about tuto-record and press **Open Anyway**, then confirm. Right-clicking the app and choosing **Open** no longer gets past the warning on these versions.
   - **macOS 14 or earlier:** right-click the app in Applications and choose **Open**, then **Open** again in the dialog.

   This is needed only once per version.

After installing a new version, macOS may ask for the two permissions again (see below).

## Using it

### Projects and Tutorials

Your work is organised in **Projects**. A Project holds **Tutorials**, and can also hold **Groups** to organise them: a Group holds Tutorials and other Groups, as deep as you like. A Tutorial is the set of screenshots of one task, such as "How to install Python". On disk they are plain folders:

```
<Projects folder>/
  Python/                          ← a Project
    Quick start/                   ← a Tutorial
    Setup/                         ← a Group
      macOS/                       ← a Group inside it
        How to install Python/     ← a Tutorial
          2026-11-21_09-15-42-123_d1.png
          …
```

The folders are all there is: a folder you create, rename, move or delete in Finder shows up in the app within a couple of seconds, and the other way round. A few things decide whether a folder inside a Project is a Group or a Tutorial:

- A Group made in the app has a hidden file, `.tuto-group`, so it stays a Group even while it is empty.
- A folder with screenshots in it is always a Tutorial; any folders inside it are ignored.
- A folder that only holds other folders is a Group, so nested folders you make in Finder work too.
- An empty folder made in Finder is an empty Tutorial. To make an empty Group, use **New Group** in the app.

### First launch: Settings

On first launch the **Settings** window opens by itself. It has two parts.

**Projects folder.** Press **Choose folder…** and pick the folder that holds all your Projects. The choice is remembered. **Open in Finder** shows it. If the folder is deleted or becomes read-only, both windows say so and recording is not possible until it is fixed. If you used version 0.1, its output folder is not reused: choose a Projects folder again. Your old screenshots stay where they were.

**Permissions.** tuto-record needs two macOS permissions, and asks for them one after the other:

1. **Accessibility**, so it can notice your clicks in any app. Turn tuto-record on in System Settings → Privacy & Security.
2. **Screen Recording**, so it can take the screenshots. Within a couple of seconds of granting the first one, macOS asks for this one too.

Each permission has an **Open Settings** button. macOS usually applies Screen Recording only after a restart, so press **Relaunch app** once it is on. macOS 15 and later also shows an occasional reminder that the app can record the screen; that is expected.

Open Settings again at any time with **⌘,** or the **Settings** button at the bottom of the sidebar.

### The main window

The sidebar on the left lists your Projects, newest first. Inside each one, Groups come first, then Tutorials, each newest first. Click a Project or Group to show or hide what's inside, and click a Tutorial to open it on the right. The heading shows where the Tutorial is (`Python › Setup › macOS › How to install Python`); when the window is narrow, the Groups in the middle shrink to `…`, and hovering shows the whole path.

- **New Project:** press **+** next to PROJECTS, type a name, press Return (Esc cancels).
- **New Tutorial or Group:** hover a Project or Group, press its **+**, and choose **New Tutorial** or **New Group**. A new Tutorial is selected.
- **Move:** drag a Tutorial or Group onto a Project or Group, in the same Project or another one. A Group moves with everything inside it. If something there already has that name, the move is refused and the window says why. To undo a move, drag it back.
- **Rename or delete:** hover a row and press **⋯**, then **Rename** or **Move to Trash**. Moving a Project or Group to the Trash takes everything inside it. The app asks first, and you can get everything back from the Trash.

Names can't contain `/` or `:`, can't start with a dot, and must be different from the other names next to them (ignoring upper and lower case). The field says what is wrong as you type.

### Record

Select a Tutorial that has no screenshots yet and press **Start recording**.

- Every window of the app hides, so none appears in your screenshots.
- Every **left click** anywhere on any display saves a screenshot. Right clicks, middle clicks and scrolling do nothing. Clicks less than 0.3 seconds apart count once, so a double-click is one capture.
- The Dock icon shows a number: the captures so far.

To stop, press **⌃⌥⌘R** (Control, Option, Command, R) or click the app's Dock icon. The window comes back and shows the new screenshots. The Dock click that stops the recording is not kept as a capture.

A Tutorial holds one recording. To redo it, press **Record again** at the top right: the app asks first, moves the Tutorial's images to the Trash, and starts recording.

If saving fails (the Tutorial folder was removed, the disk is full, Screen Recording was switched off), recording stops, a notification says why, and the window shows the same message.

### Look through and clean up

The selected Tutorial shows one large image and a row of thumbnails under it, which scrolls sideways.

- Click a thumbnail, or press **←** and **→**, to move through the images.
- To remove one, hover its thumbnail and press the **✕** in its corner, or select it and press **Delete**. The app asks first, then moves the file to the Trash.
- **Open in Finder** at the top right opens the Tutorial's folder.

## What gets saved

Each counted click is one **capture**: one PNG per connected display, saved in the selected Tutorial's folder as:

```
2026-11-21_09-15-42-123_d1.png
2026-11-21_09-15-42-123_d2.png
```

- The name is the local time of the click, so the files sort in the order you clicked, which is also the order the window shows them. `d1` is the main display and the others follow from left to right.
- Each picture has the display's full pixel resolution, Retina included.
- The picture of the display you clicked also has a **marker** on it: a cursor arrow in the middle of a translucent red circle. The arrow's tip is exactly where you clicked, and the circle is see-through, so the text and buttons under it stay readable. Other displays get no marker.
- Every picture has a small **watermark** in its bottom-right corner: the Tuto-Record camera and name on a see-through dark plate. It is part of the saved image, so it cannot be removed afterwards, and there is no setting to turn it off.

## Good to know

- **Every image in a Tutorial folder belongs to the Tutorial.** PNG, JPG, GIF and WebP files you copy in show up in the window, and **Record again** moves them to the Trash too. Other files and subfolders are left alone.
- **Nothing is deleted for good.** Removing a screenshot, Record again, and Move to Trash all use the macOS Trash.
- **⌃⌥⌘R only stops a recording.** When nothing is recording it just brings the window back. Starting is always the button.
- **Screenshots are taken just after the click**, about 0.1 to 0.3 seconds later, so if the click opens a menu or changes a page, the screenshot may already show the result.
- **The cursor drawn is always an arrow**, whatever the real pointer looked like (text cursor, hand, resize handle). The real pointer is not part of a screen capture.
- **Another app may own ⌃⌥⌘R.** If so, the window warns you; stop a recording by clicking the Dock icon instead.
- **The app is not notarized by Apple**, so macOS blocks its first launch. [Install](#install) says how to open it on each macOS version.

## More documentation

| Document                                                | What it covers                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Development guide](src/README.md)                      | Installing, building, running in development, setup, troubleshooting, and the source layout |
| [Glossary](GLOSSARY.md)                                 | The words this project uses (project, tutorial, recording, click, capture, screenshot, …)   |
| [MVP plan](plans/MVP_PLAN.md)                           | The plan for version 0.1 and its progress notes                                             |
| [v0.2.0 plan](plans/V0.2.0_PLAN.md)                     | The plan for version 0.2.0 (Projects, Tutorials, the new window)                            |
| [v0.2.0 implementation](plans/V0.2.0_IMPLEMENTATION.md) | How version 0.2.0 was built, step by step, and its progress notes                           |
| [v0.3.0 plan](plans/V0.3.0_PLAN.md)                     | The plan for version 0.3.0 (Groups inside Projects, drag and drop)                          |
| [v0.3.0 implementation](plans/V0.3.0_IMPLEMENTATION.md) | How version 0.3.0 is built, step by step, and its progress notes                            |
| [Watermark plan](plans/WATERMARK_PLAN.md)               | The plan for the watermark drawn on every screenshot                                        |
| [Decision records](docs/adr)                            | Why the hard-to-reverse choices were made                                                   |
| [Working rules for Claude](CLAUDE.md)                   | How Claude works in this project, including keeping the documentation up to date            |
