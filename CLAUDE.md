# tuto-record: instructions for Claude

An Electron + TypeScript macOS app that saves a screenshot of every display on each left click. Start with [README.md](README.md) for what it does, [src/README.md](src/README.md) for how to build and run it, and with [GLOSSARY.md](GLOSSARY.md) for the vocabulary (Projects folder, Project, Group, Tutorial, Recording, Click, Capture, Screenshot, Marker). Use those terms in code, comments, UI text and docs.

## Documentation rule

Documentation is part of the change. It is not a follow-up task.

1. **Every place that has READMEs documents itself, and only itself.** A README describes the files and sub-folders directly in its own folder: what each one is for, its contracts (public functions, IPC channels, file formats, config keys), its rules and gotchas, and how it is tested.
2. **A parent README gives an overview of a child that has its own README and links to it.** It says what the child is for and how it connects to its siblings. It does not repeat the child's details, so there is one place to update. For example, if `src/main/` gets a `utils/` folder with its own README, `src/main/README.md` has a short "utils" entry linking to `utils/README.md`, and the detail about each helper lives only in `utils/README.md`.
3. **When you change something, update the README that documents it, in the same change.** That means behaviour, contracts, structure (added, removed, renamed or moved files and folders), configuration, commands, or a rule or gotcha you discovered. Only update what the change affects. A pure refactor that changes none of these needs no doc change.
4. **Update upward only when the overview is now wrong.** If a child's purpose or its connections to its siblings changed, fix the parent's overview and the root README. Otherwise leave the parent alone.
5. **When a folder grows its own structure, give it a README.** If it has several modules, a contract other code relies on, or non-obvious rules, add a README and link it from the parent. Move the detail down into it, and leave an overview in the parent.
6. **Keep links working.** When you move or rename a file or folder, fix every link and path that points at it, including build config that mentions it.
7. **Before finishing a task, check:** does any README describe what I just changed? If yes, is it now accurate?

Related documents, each with one job:

| Document                       | Holds                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| [README.md](README.md)         | How the app works, from the user's side. Nothing about development  |
| [src/README.md](src/README.md) | Install, setup, run, scripts, build, troubleshooting, source layout |
| [GLOSSARY.md](GLOSSARY.md)     | Domain terms only. No implementation details                        |
| [docs/adr/](docs/adr/)         | Decisions that are hard to reverse, surprising and a real trade-off |
| [plans/](plans/)               | Plans and their progress notes                                      |
| `**/README.md`                 | How the code in that folder works (see the rule above)              |

## Change workflow

Every change, however small (code, docs, config), goes through a branch and a pull request. Nothing is committed directly to `main`.

1. **Branch from an up-to-date `main`.** `git switch main && git pull`, then `git switch -c <type>/<short-name>`, where `<type>` is `feat`, `fix`, `docs`, `refactor` or `chore` and the name is kebab-case (`feat/groups-drag-and-drop`, `docs/pr-workflow`). One branch per change.
2. **Commit on the branch.** Before committing, run `npm run typecheck`, `npm run lint` and `npm test`, and follow the documentation rule above.
3. **Push the branch** to `origin` (`git push -u origin <branch>`).
4. **Open a pull request into `main`** with `gh pr create`. The description says what changed and why, how it was tested (including what was not tested, such as manual checks still pending), and which docs were updated.
5. **Wait for approval.** The user reviews and approves the pull request. Do not merge it, and do not push to `main`, unless the user says to after approving it.
6. **After the merge**, switch back to `main` and pull, and delete the branch locally (the remote branch is deleted with the merge, or by hand).

Follow-up changes to an open pull request go on its branch, as new commits.

## Code conventions

- **Testable core, thin Electron glue.** Put logic in a module that takes its dependencies as arguments, and put the real Electron or OS calls in a small separate file. Unit tests use fakes and never import `electron`. Details and examples: [src/main/README.md](src/main/README.md).
- IPC goes through the typed contract in `src/shared/ipc.ts` and the preload script. Validate anything arriving from the renderer in the main process.
- Add tests with the code. Run `npm run typecheck`, `npm run lint` and `npm test` before calling work done.

## Things that are easy to get wrong

- **Test permissions only with the packaged app.** `npm run dev` runs the stock Electron app, which can inherit permissions from whatever launched it. See [src/README.md](src/README.md#run).
- **Launch the app through `open`** (for example `open -n --env TUTO_DEBUG=1 …`), not by running the binary directly, or macOS attributes permissions to your shell.
- **Builds are ad-hoc signed, so every rebuild invalidates permissions.** Reset them with `tccutil` and grant again. [src/README.md](src/README.md#troubleshooting) has the commands.
- **This Mac's Node runs as x64 (Rosetta).** The arm64 app needs the arm64 binaries of `sharp`, `koffi` and Electron installed by hand. [src/README.md](src/README.md#setup) has the commands.
- Do not commit screenshots or the test output folder (`firsttuto/` is ignored).
