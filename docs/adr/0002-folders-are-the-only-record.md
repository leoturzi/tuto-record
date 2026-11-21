# Folders on disk are the only record of Projects and Tutorials

Narrowed by [ADR 0003](0003-groups-are-marked-with-a-hidden-file.md): from v0.3.0 a hidden `.tuto-group` file marks a folder as a Group.

From v0.2.0, every direct subfolder of the Projects folder is a Project, every direct subfolder of a Project is a Tutorial, and a folder's name is the Project's or Tutorial's name. The app keeps no list, database or metadata file of its own. We chose this so that what the user sees in Finder and in the app can never disagree: a folder created, renamed, moved or deleted in Finder shows up in the app on the next refresh, and the app needs no migration or repair logic.

## Consequences

- Names must be valid folder names, and they are unique within their parent, compared without regard to case, because APFS is case-insensitive by default. The v0.2.0 mockup showed two Projects called "Git Tutorial", which is not possible.
- There is nowhere to keep anything that is not in the file system: no custom order of Tutorials or Screenshots, no descriptions, no "display name" that differs from the folder name. The sidebar is sorted by folder creation time and the carousel by file name for that reason. Adding such data later means introducing a metadata file per Tutorial, which reverses part of this decision.
- Every image in a Tutorial folder is part of the Tutorial, including images the app did not make.

## Considered Options

- **A Project list in `settings.json`, folders as storage only:** allows display names, duplicates and custom order, but the list and the disk drift apart as soon as the user touches the folders in Finder, and the app then needs rules for missing and unknown folders. Rejected.
