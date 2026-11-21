import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { SettingsState } from '../shared/ipc'
import { isItemPath, isWithin, pathKey, replacePrefix, type ItemPath } from '../shared/paths'
import { checkFolder } from './folderCheck'

interface StoredSettings {
  projectsFolder: string | null
  selectedTutorial: ItemPath | null
  /** Keys (`pathKey`) of the expanded Projects and Groups. */
  expanded: string[]
}

const defaults = (): StoredSettings => ({
  projectsFolder: null,
  selectedTutorial: null,
  expanded: []
})

const isName = (value: unknown): value is string => typeof value === 'string' && value !== ''

/** The selection from a v0.3 file (a path) or a v0.2 file (`{ project, tutorial }`). */
function parseSelection(value: unknown): ItemPath | null {
  if (isItemPath(value)) return value.length >= 2 ? [...value] : null
  if (typeof value !== 'object' || value === null) return null
  const { project, tutorial } = value as Record<string, unknown>
  return isName(project) && isName(tutorial) ? [project, tutorial] : null
}

/**
 * Accepts anything that was read from disk and keeps only what is valid. Each field falls back on
 * its own. A v0.2 file (`selectedTutorial: { project, tutorial }`, `expandedProjects`) is read
 * into the current shape; a v0.1 file (`{ outputFolder }`) gives the defaults.
 */
export function parseSettings(raw: unknown): StoredSettings {
  if (typeof raw !== 'object' || raw === null) return defaults()
  const { projectsFolder, selectedTutorial, expanded, expandedProjects } = raw as Record<
    string,
    unknown
  >
  const keys = Array.isArray(expanded)
    ? expanded
    : Array.isArray(expandedProjects)
      ? expandedProjects
      : []
  return {
    projectsFolder: isName(projectsFolder) ? projectsFolder : null,
    selectedTutorial: parseSelection(selectedTutorial),
    expanded: [...new Set(keys.filter(isName))]
  }
}

export interface SettingsService {
  get(): Promise<SettingsState>
  /** Saves the folder and clears the selection and the expanded list. */
  setProjectsFolder(folder: string): Promise<SettingsState>
  selectTutorial(path: ItemPath | null): Promise<SettingsState>
  setExpanded(keys: string[]): Promise<void>
  /**
   * A Project, Group or Tutorial was renamed or moved from `from` to `to`: the selection and the
   * expanded keys inside it follow.
   */
  followMove(from: ItemPath, to: ItemPath): Promise<void>
  /** A Project, Group or Tutorial went to the Trash: drop the selection and expanded keys inside it. */
  forget(path: ItemPath): Promise<void>
}

/** Maps every expanded key inside `from` to the same place inside `to`. */
function moveKeys(keys: string[], from: ItemPath, to: ItemPath): string[] {
  const moved = keys.map((key) => pathKey(replacePrefix(key.split('/'), from, to)))
  return [...new Set(moved)]
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Settings live in one small JSON file. A missing or corrupt file means defaults. */
export function createSettingsService(filePath: string): SettingsService {
  async function load(): Promise<StoredSettings> {
    try {
      return parseSettings(JSON.parse(await readFile(filePath, 'utf8')))
    } catch {
      return defaults()
    }
  }

  async function save(settings: StoredSettings): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    // Write to a temporary file first so a crash never leaves a half-written settings file.
    const tmp = `${filePath}.tmp`
    await writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
    await rename(tmp, filePath)
  }

  async function update(change: (settings: StoredSettings) => StoredSettings): Promise<void> {
    await save(change(await load()))
  }

  async function toState(settings: StoredSettings): Promise<SettingsState> {
    const { projectsFolder, selectedTutorial } = settings
    const problem = projectsFolder ? await checkFolder(projectsFolder) : null
    const selectionExists =
      projectsFolder !== null &&
      problem === null &&
      selectedTutorial !== null &&
      (await isDirectory(join(projectsFolder, ...selectedTutorial)))
    return {
      projectsFolder,
      projectsFolderProblem: problem,
      selectedTutorial: selectionExists ? selectedTutorial : null,
      expanded: settings.expanded
    }
  }

  return {
    async get() {
      return toState(await load())
    },

    async setProjectsFolder(folder) {
      const settings = { ...defaults(), projectsFolder: folder }
      await save(settings)
      return toState(settings)
    },

    async selectTutorial(path) {
      const settings = { ...(await load()), selectedTutorial: path ? [...path] : null }
      await save(settings)
      return toState(settings)
    },

    async setExpanded(keys) {
      await update((s) => ({ ...s, expanded: [...new Set(keys)] }))
    },

    async followMove(from, to) {
      await update((s) => ({
        ...s,
        selectedTutorial: s.selectedTutorial && replacePrefix(s.selectedTutorial, from, to),
        expanded: moveKeys(s.expanded, from, to)
      }))
    },

    async forget(path) {
      await update((s) => ({
        ...s,
        selectedTutorial:
          s.selectedTutorial && isWithin(s.selectedTutorial, path) ? null : s.selectedTutorial,
        expanded: s.expanded.filter((key) => !isWithin(key.split('/'), path))
      }))
    }
  }
}
