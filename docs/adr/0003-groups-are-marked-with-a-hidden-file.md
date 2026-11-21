# Groups are marked with a hidden file

From v0.3.0, a Project can hold Groups, which hold Tutorials and other Groups at any depth. An empty Group and a new, empty Tutorial are both empty folders, so the folders alone cannot say which one the user made. We decided that a Group created in the app gets an empty hidden file, `.tuto-group`, inside its folder. This narrows [ADR 0002](0002-folders-are-the-only-record.md): the folders are still the record of what exists and what it is called, and this one file records only what kind of folder it is.

A folder is classified in this order:

1. It contains `.tuto-group` → **Group**.
2. It contains at least one image file → **Tutorial** (any subfolders are ignored, as in v0.2, so screenshots never disappear from view).
3. It contains at least one visible subfolder → **Group** (so nested folders made in Finder work without the file).
4. Otherwise (empty, or only other files) → **Tutorial**.

## Considered Options

- **Contents only (no file):** a folder with subfolders is a Group, anything else a Tutorial. Keeps ADR 0002 intact, but a Group the user has just created shows as an empty Tutorial, with Start recording, until something is put in it. Rejected as confusing.
- **The file only:** only tagged folders are Groups. Nested folders made in Finder would show as Tutorials and hide their contents. Rejected.
- **A list of Groups in `settings.json`:** drifts from the disk as soon as folders are moved in Finder, which is exactly what ADR 0002 avoids. Rejected.

## Consequences

- v0.2 data needs no migration: its Tutorials hold images or nothing, and have no tag.
- Moving a Group, in Finder or in the app, keeps its tag because the file moves with the folder.
- Deleting `.tuto-group` from an empty Group turns it back into an empty Tutorial. That is acceptable; it is a hidden file.
