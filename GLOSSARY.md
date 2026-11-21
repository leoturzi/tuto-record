# tuto-record

A desktop app that saves a picture of the screen every time the user clicks, so the clicks can later be turned into a step-by-step tutorial.

## Language

**Recording**:
The period between the user pressing Start and pressing Stop, during which Clicks produce Captures.
_Avoid_: Session, run

**Click**:
A press of the left mouse button anywhere on any display while Recording. Other buttons and scrolling are not Clicks.
_Avoid_: Tap, mouse event

**Capture**:
The set of Screenshots taken in response to one Click: one Screenshot per connected display.
_Avoid_: Snap, shot

**Screenshot**:
An image of a single display, saved as one file in the Output folder.
_Avoid_: Screen grab, snapshot, image

**Marker**:
A red ring with an arrow cursor centred inside it, drawn on a Screenshot where the Click that triggered the Capture happened (the cursor's tip is the Click position). Only the Screenshot of the clicked display has one.
_Avoid_: Highlight, dot

**Output folder**:
The folder the user chose where all Screenshots are saved directly, with no subfolders.
_Avoid_: Target directory, save location, destination
