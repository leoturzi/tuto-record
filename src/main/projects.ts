import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ItemKind, NameResult, ProjectNode, TreeNode } from '../shared/ipc'
import { isImageFile } from '../shared/images'
import { validateName } from '../shared/names'
import { isWithin, parentOf, samePath, type ItemPath } from '../shared/paths'

/** The hidden file that marks a folder as a Group (docs/adr/0003). */
export const GROUP_TAG = '.tuto-group'

/** Recursion guard. Links are never followed, so this only stops absurdly deep trees. */
const MAX_DEPTH = 64

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
  /** Every Project and what it holds, Groups first then Tutorials, each newest first. */
  listTree(): Promise<ProjectNode[]>
  createProject(name: string): Promise<NameResult>
  /** Creates a Tutorial or a Group (with its tag file) inside a Project or Group. */
  createItem(parent: ItemPath, kind: ItemKind, name: string): Promise<NameResult>
  /** Renames a Project, Group or Tutorial. */
  rename(path: ItemPath, to: string): Promise<NameResult>
  /** Tutorials at any depth inside a Project or Group (0 for a Tutorial). */
  countTutorials(path: ItemPath): Promise<number>
  /** Moves a Project, Group or Tutorial to the Trash. */
  trash(path: ItemPath): Promise<void>
  /** Moves a Tutorial or Group into the Project or Group `destination`. */
  move(path: ItemPath, destination: ItemPath): Promise<NameResult>
  /** The Tutorial's folder; throws when the path is not an existing Tutorial. */
  tutorialPath(path: ItemPath): Promise<string>
  /** Image files directly in the Tutorial folder, sorted by file name. */
  listImages(tutorial: ItemPath): Promise<ImageFile[]>
  /** The path of one image in the Tutorial; throws unless it is an image file listed there. */
  imagePath(tutorial: ItemPath, file: string): Promise<string>
  trashImage(tutorial: ItemPath, file: string): Promise<void>
  trashAllImages(tutorial: ItemPath): Promise<void>
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
 * Visible subfolders of `dir`. Symbolic links are not followed (a `Dirent` for a link is not a
 * directory), so nothing can lead outside the Projects folder.
 */
async function childFolders(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
}

/** Sorts folder names newest first by creation time, then by name. */
async function newestFirst(dir: string, names: string[]): Promise<string[]> {
  const dated = await Promise.all(
    names.map(async (name) => {
      try {
        return { name, born: (await stat(join(dir, name))).birthtimeMs }
      } catch {
        return { name, born: 0 }
      }
    })
  )
  return dated.sort((a, b) => b.born - a.born || byName(a.name, b.name)).map((d) => d.name)
}

/** Every visible name in `dir` (files too), for the duplicate check. */
async function siblingNames(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((name) => !name.startsWith('.'))
}

/**
 * Whether a folder inside a Project is a Group or a Tutorial (docs/adr/0003), in this order: it
 * holds the tag file → Group; it holds an image → Tutorial (its subfolders are ignored); it holds a
 * visible subfolder → Group; otherwise → Tutorial.
 */
export async function classify(folder: string): Promise<ItemKind> {
  const entries = await readdir(folder, { withFileTypes: true })
  if (entries.some((e) => e.name === GROUP_TAG)) return 'group'
  if (entries.some((e) => e.isFile() && isImageFile(e.name))) return 'tutorial'
  if (entries.some((e) => e.isDirectory() && !e.name.startsWith('.'))) return 'group'
  return 'tutorial'
}

function readableError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException | null)?.code
  if (code === 'EEXIST' || code === 'ENOTEMPTY') return 'That name is already used.'
  if (code === 'EACCES' || code === 'EPERM')
    return 'tuto-record is not allowed to change this folder.'
  if (code === 'EXDEV') return "Can't move between disks."
  return err instanceof Error ? err.message : String(err)
}

const describe = (path: ItemPath): string => `"${path[path.length - 1]}"`

export function createProjectsService(deps: ProjectsDeps): ProjectsService {
  /**
   * The folder at `path`, checked one name at a time: each must be an existing, visible, non-link
   * direct child of the previous one. Throws otherwise.
   */
  async function resolve(path: ItemPath): Promise<string> {
    let folder = await deps.getRoot()
    if (!Array.isArray(path) || path.length === 0) throw new Error('Nothing is selected.')
    for (const name of path) {
      if (
        !isSafeSegment(name) ||
        name.startsWith('.') ||
        !(await childFolders(folder)).includes(name)
      ) {
        throw new Error(`${describe(path)} no longer exists.`)
      }
      folder = join(folder, name)
    }
    return folder
  }

  /** The folder of a Project or a Group (something that can hold Tutorials and Groups). */
  async function containerPath(path: ItemPath): Promise<string> {
    const folder = await resolve(path)
    if (path.length > 1 && (await classify(folder)) !== 'group') {
      throw new Error(`${describe(path)} is a Tutorial, not a Group.`)
    }
    return folder
  }

  async function tutorialPath(path: ItemPath): Promise<string> {
    const folder = await resolve(path)
    if (path.length < 2 || (await classify(folder)) !== 'tutorial') {
      throw new Error(`${describe(path)} is not a Tutorial.`)
    }
    return folder
  }

  /** The children of a Project or Group folder: Groups first, then Tutorials, each newest first. */
  async function listChildren(folder: string, depth: number): Promise<TreeNode[]> {
    let names: string[]
    try {
      names = await newestFirst(folder, await childFolders(folder))
    } catch {
      return [] // unreadable: show it empty rather than fail the whole tree
    }
    const nodes = await Promise.all(
      names.map(async (name): Promise<TreeNode> => {
        const child = join(folder, name)
        let kind: ItemKind = 'tutorial'
        try {
          kind = await classify(child)
        } catch {
          // unreadable folder: show it as an empty Tutorial
        }
        if (kind === 'tutorial') return { kind, name }
        return {
          kind,
          name,
          children: depth < MAX_DEPTH ? await listChildren(child, depth + 1) : []
        }
      })
    )
    // A stable sort keeps the newest-first order inside each kind.
    return nodes.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'group' ? -1 : 1))
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

  async function countIn(folder: string, depth: number): Promise<number> {
    if (depth > MAX_DEPTH) return 0
    let total = 0
    for (const name of await childFolders(folder)) {
      const child = join(folder, name)
      total += (await classify(child)) === 'group' ? await countIn(child, depth + 1) : 1
    }
    return total
  }

  async function listImages(tutorial: ItemPath): Promise<ImageFile[]> {
    const folder = await tutorialPath(tutorial)
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

  async function imagePath(tutorial: ItemPath, file: string): Promise<string> {
    if (isSafeSegment(file) && isImageFile(file)) {
      const listed = await listImages(tutorial)
      if (listed.some((image) => image.file === file)) {
        return join(await tutorialPath(tutorial), file)
      }
    }
    throw new Error(`The image "${String(file)}" no longer exists.`)
  }

  return {
    async listTree() {
      const root = await deps.getRoot()
      const projects = await newestFirst(root, await childFolders(root))
      return Promise.all(
        projects.map(async (name) => ({ name, children: await listChildren(join(root, name), 1) }))
      )
    },

    async createProject(name) {
      return create(await deps.getRoot(), name)
    },

    async createItem(parent, kind, name) {
      const folder = await containerPath(parent)
      const result = await create(folder, name)
      if (result.error || kind !== 'group') return result
      const created = join(folder, name.trim())
      try {
        await writeFile(join(created, GROUP_TAG), '')
        return OK
      } catch (err) {
        // Without its tag an empty Group would show as a Tutorial; don't leave it half made.
        await rm(created, { recursive: true, force: true })
        return { error: readableError(err) }
      }
    },

    async rename(path, to) {
      await resolve(path)
      const folder = path.length === 1 ? await deps.getRoot() : await resolve(parentOf(path))
      const current = path[path.length - 1]
      const error = validateName(to, await siblingNames(folder), current)
      if (error) return { error }
      const next = to.trim()
      if (next === current) return OK
      try {
        await rename(join(folder, current), join(folder, next))
        return OK
      } catch (err) {
        return { error: readableError(err) }
      }
    },

    async countTutorials(path) {
      const folder = await resolve(path)
      if (path.length > 1 && (await classify(folder)) === 'tutorial') return 0
      return countIn(folder, path.length)
    },

    async trash(path) {
      await deps.trash(await resolve(path))
    },

    async move(path, destination) {
      if (path.length < 2) return { error: "Projects can't be moved." }
      const source = await resolve(path)
      const target = await containerPath(destination)
      if (isWithin(destination, path)) return { error: "A Group can't go inside itself." }
      if (samePath(parentOf(path), destination)) return OK
      const name = path[path.length - 1]
      // Compared ignoring case, like validateName; the name itself is not re-checked, because a
      // folder made in Finder may hold characters the app would not accept for a new name.
      const taken = (await siblingNames(target)).some((n) => n.toLowerCase() === name.toLowerCase())
      if (taken) {
        return { error: `That name is already used in ${describe(destination)}.` }
      }
      try {
        await rename(source, join(target, name))
        return OK
      } catch (err) {
        return { error: readableError(err) }
      }
    },

    tutorialPath,
    listImages,
    imagePath,

    async trashImage(tutorial, file) {
      await deps.trash(await imagePath(tutorial, file))
    },

    async trashAllImages(tutorial) {
      const folder = await tutorialPath(tutorial)
      // One at a time, so the first failure stops the rest and is reported.
      for (const image of await listImages(tutorial)) await deps.trash(join(folder, image.file))
    }
  }
}
