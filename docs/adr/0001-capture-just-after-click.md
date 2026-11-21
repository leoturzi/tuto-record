# Capture Screenshots just after the Click, not at the Click moment

Screenshots are taken by calling `desktopCapturer.getSources()` when a Click arrives, so each one shows the screen about 100–300 ms after the Click, by which time the clicked app may already have reacted (a menu opened, a page changed). We accepted this for v0.1 because it is simple and costs nothing while idle.

## Considered Options

- **Live frame buffer:** keep a screen stream running during Recording and save the last frame before the Click. It shows exactly what the user saw, but costs CPU and battery the whole time and needs a hidden renderer to hold the streams. Rejected for v0.1; this is the first option to revisit if post-Click Screenshots turn out to hurt the tutorials.
