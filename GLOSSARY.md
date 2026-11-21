# tuto-record

A desktop app that saves a picture of the screen every time the user clicks, so the clicks can later be turned into a step-by-step tutorial.

## Language

### Organising

**Projects folder**:
The one folder the user chose that holds every Project.
_Avoid_: Output folder, root folder, workspace, library

**Project**:
A named container of related Tutorials, kept as a folder inside the Projects folder.
_Avoid_: Workspace, collection, album

**Group**:
A named container inside a Project that holds Tutorials and other Groups, so a Project's Tutorials can be organised at any depth. Kept as a folder.
_Avoid_: Section, chapter, folder, category

**Tutorial**:
A named, ordered set of Screenshots that walks through one task, kept as a folder inside its Project. Its Screenshots all come from one Recording; recording it again replaces them.
_Avoid_: Recording (for the saved result), guide, session

### Recording

**Recording**:
The period between the user pressing Start and pressing Stop, during which Clicks produce Captures for the selected Tutorial.
_Avoid_: Session, run; never use it for the saved Screenshots

**Click**:
A press of the left mouse button anywhere on any display while Recording. Other buttons and scrolling are not Clicks.
_Avoid_: Tap, mouse event

**Capture**:
The set of Screenshots taken in response to one Click: one Screenshot per connected display.
_Avoid_: Snap, shot

**Screenshot**:
An image of a single display, saved as one file in a Tutorial's folder.
_Avoid_: Screen grab, snapshot, image

**Marker**:
A translucent red circle with an arrow cursor in its middle, drawn on a Screenshot where the Click that triggered the Capture happened (the cursor's tip is the Click position). Only the Screenshot of the clicked display has one.
_Avoid_: Highlight, dot
