import { mkdir, readdir, rename, stat } from 'fs/promises'
import { join } from 'path'
import type { NameResult, ProjectNode, TutorialRef } from '../shared/ipc'
import { isImageFile } from '../shared/images'
import { validateName } from '../shared/names'

export interface ProjectsDeps {
  /** The Projects folder, or throws with a readable message when it is missing or unusable. */
  getRoot(): Promise<string>
  /** Moves a file or folder to the Trash. */
  trash(path: string): Promise<void>
}

/** An image file in a Tutorial folder. `version` changes whenever the file does. */
export interface ImageFile {
  file: string
  version: number
}

export interface ProjectsService {
  /** Every Project and its Tutorials, newest first at both levels. */
  listTree(): Promise<ProjectNode[]>
  createProject(name: string): Promise<NameResult>
  createTutorial(project: string, name: string): Promise<NameResult>
  renameProject(project: string, to: string): Promise<NameResult>
  renameTutorial(ref: TutorialRef, to: string): Promise<NameResult>
  countTutorials(project: string): Promise<number>
  trashProject(project: string): Promise<void>
  trashTutorial(ref: TutorialRef): Promise<void>
  /** The Tutorial's folder; throws when the ref is invalid or the folder does not exist. */
  tutorialPath(ref: TutorialRef): Promise<string>
  /** Image files directly in the Tutorial folder, sorted by file name. */
  listImages(ref: TutorialRef): Promise<ImageFile[]>
  /** The path of one image in the Tutorial; throws unless it is an image file listed there. */
  imagePath(ref: TutorialRef, file: string): Promise<string>
  trashImage(ref: TutorialRef, file: string): Promise<void>
  trashAllImages(ref: TutorialRef): Promise<void>
}

const OK: NameResult = { error: null }

/** A single path segment that cannot leave its parent folder. */
function isSafeSegment(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name !== '' &&
    name !== '.' &&
    name !== '..' &&
    !name.includes('/') &&
    !name.includes('\0')
  )
}

const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) ||
  (a < b ? -1 : a > b ? 1 : 0)

/**
 * Visible subfolders of `dir`, newest first by creation time. Symbolic links are not followed,
 * so a Project or Tutorial can never point outside the Projects folder.
 */
async function childFolders(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  const dated = await Promise.all(
    folders.map(async (e) => {
      try {
        return { name: e.name, born: (await stat(join(dir, e.name))).birthtimeMs }
      } catch {
        return { name: e.name, born: 0 }
      }
    })
  )
  return dated.sort((a, b) => b.born - a.born || byName(a.name, b.name)).map((d) => d.name)
}

/** Every name in `dir` (files too), for the duplicate check. */
async function siblingNames(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((name) => !name.startsWith('.'))
}

function readableError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException | null)?.code
  if (code === 'EEXIST' || code === 'ENOTEMPTY') return 'That name is already used.'
  if (code === 'EACCES' || code === 'EPERM')
    return 'tuto-record is not allowed to change this folder.'
  return err instanceof Error ? err.message : String(err)
}

export function createProjectsService(deps: ProjectsDeps): ProjectsService {
  /** The folder of an existing Project; throws if `name` is not one. */
  async function projectPath(name: string): Promise<string> {
    const root = await deps.getRoot()
    if (isSafeSegment(name) && (await childFolders(root)).includes(name)) return join(root, name)
    throw new Error(`The Project "${String(name)}" no longer exists.`)
  }

  async function tutorialPath(ref: TutorialRef): Promise<string> {
    const project = await projectPath(ref.project)
    if (isSafeSegment(ref.tutorial) && (await childFolders(project)).includes(ref.tutorial)) {
      return join(project, ref.tutorial)
    }
    throw new Error(`The Tutorial "${String(ref.tutorial)}" no longer exists.`)
  }

  async function create(parent: string, name: string): Promise<NameResult> {
    const error = validateName(name, await siblingNames(parent))
    if (error) return { error }
    try {
      await mkdir(join(parent, name.trim()))
      return OK
    } catch (err) {
      return { error: readableError(err) }
    }
  }

  async function renameIn(parent: string, current: string, to: string): Promise<NameResult> {
    const error = validateName(to, await siblingNames(parent), current)
    if (error) return { error }
    const next = to.trim()
    if (next === current) return OK
    try {
      await rename(join(parent, current), join(parent, next))
      return OK
    } catch (err) {
      return { error: readableError(err) }
    }
  }

  async function listImages(ref: TutorialRef): Promise<ImageFile[]> {
    const folder = await tutorialPath(ref)
    const entries = await readdir(folder, { withFileTypes: true })
    const images = entries.filter((e) => e.isFile() && isImageFile(e.name))
    const files = await Promise.all(
      images.map(async (e) => {
        try {
          return { file: e.name, version: Math.round((await stat(join(folder, e.name))).mtimeMs) }
        } catch {
          return null // removed while listing
        }
      })
    )
    return files.filter((f): f is ImageFile => f !== null).sort((a, b) => byName(a.file, b.file))
  }

  async function imagePath(ref: TutorialRef, file: string): Promise<string> {
    if (isSafeSegment(file) && isImageFile(file)) {
      const listed = await listImages(ref)
      if (listed.some((image) => image.file === file)) return join(await tutorialPath(ref), file)
    }
    throw new Error(`The image "${String(file)}" no longer exists.`)
  }

  return {
    async listTree() {
      const root = await deps.getRoot()
      const projects = await childFolders(root)
      return Promise.all(
        projects.map(async (name) => {
          try {
            const tutorials = await childFolders(join(root, name))
            return { name, tutorials: tutorials.map((tutorial) => ({ name: tutorial })) }
          } catch {
            return { name, tutorials: [] }
          }
        })
      )
    },

    async createProject(name) {
      return create(await deps.getRoot(), name)
    },

    async createTutorial(project, name) {
      return create(await projectPath(project), name)
    },

    async renameProject(project, to) {
      await projectPath(project)
      return renameIn(await deps.getRoot(), project, to)
    },

    async renameTutorial(ref, to) {
      await tutorialPath(ref)
      return renameIn(await projectPath(ref.project), ref.tutorial, to)
    },

    async countTutorials(project) {
      return (await childFolders(await projectPath(project))).length
    },

    async trashProject(project) {
      await deps.trash(await projectPath(project))
    },

    async trashTutorial(ref) {
      await deps.trash(await tutorialPath(ref))
    },

    tutorialPath,
    listImages,
    imagePath,

    async trashImage(ref, file) {
      await deps.trash(await imagePath(ref, file))
    },

    async trashAllImages(ref) {
      const folder = await tutorialPath(ref)
      // One at a time, so the first failure stops the rest and is reported.
      for (const image of await listImages(ref)) await deps.trash(join(folder, image.file))
    }
  }
}
