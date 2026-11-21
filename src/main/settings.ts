import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { SettingsState, TutorialRef } from '../shared/ipc'
import { checkFolder } from './folderCheck'

interface StoredSettings {
  projectsFolder: string | null
  selectedTutorial: TutorialRef | null
  expandedProjects: string[]
}

const defaults = (): StoredSettings => ({
  projectsFolder: null,
  selectedTutorial: null,
  expandedProjects: []
})

const isName = (value: unknown): value is string => typeof value === 'string' && value !== ''

/** True when `value` has a non-empty `project` and `tutorial`. */
export function isTutorialRef(value: unknown): value is TutorialRef {
  if (typeof value !== 'object' || value === null) return false
  const { project, tutorial } = value as Record<string, unknown>
  return isName(project) && isName(tutorial)
}

/**
 * Accepts anything that was read from disk and keeps only what is valid. Each field falls back on
 * its own; a v0.1 file (`{ outputFolder }`) gives the defaults.
 */
export function parseSettings(raw: unknown): StoredSettings {
  if (typeof raw !== 'object' || raw === null) return defaults()
  const { projectsFolder, selectedTutorial, expandedProjects } = raw as Record<string, unknown>
  return {
    projectsFolder: isName(projectsFolder) ? projectsFolder : null,
    selectedTutorial: isTutorialRef(selectedTutorial)
      ? { project: selectedTutorial.project, tutorial: selectedTutorial.tutorial }
      : null,
    expandedProjects: Array.isArray(expandedProjects) ? expandedProjects.filter(isName) : []
  }
}

export interface SettingsService {
  get(): Promise<SettingsState>
  /** Saves the folder and clears the selection and the expanded list. */
  setProjectsFolder(folder: string): Promise<SettingsState>
  selectTutorial(ref: TutorialRef | null): Promise<SettingsState>
  setExpanded(projects: string[]): Promise<void>
  /** Keeps the selection and the expanded list pointing at a renamed Project. */
  followProjectRename(from: string, to: string): Promise<void>
  /** Keeps the selection pointing at a renamed Tutorial. */
  followTutorialRename(ref: TutorialRef, to: string): Promise<void>
  /** Drops the selection and the expanded entry of a trashed Project. */
  forgetProject(name: string): Promise<void>
  /** Drops the selection of a trashed Tutorial. */
  forgetTutorial(ref: TutorialRef): Promise<void>
}

const sameRef = (a: TutorialRef | null, b: TutorialRef): boolean =>
  a !== null && a.project === b.project && a.tutorial === b.tutorial

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
      (await isDirectory(join(projectsFolder, selectedTutorial.project, selectedTutorial.tutorial)))
    return {
      projectsFolder,
      projectsFolderProblem: problem,
      selectedTutorial: selectionExists ? selectedTutorial : null,
      expandedProjects: settings.expandedProjects
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

    async selectTutorial(ref) {
      const settings = { ...(await load()), selectedTutorial: ref }
      await save(settings)
      return toState(settings)
    },

    async setExpanded(projects) {
      await update((s) => ({ ...s, expandedProjects: [...new Set(projects)] }))
    },

    async followProjectRename(from, to) {
      await update((s) => ({
        ...s,
        selectedTutorial:
          s.selectedTutorial?.project === from
            ? { project: to, tutorial: s.selectedTutorial.tutorial }
            : s.selectedTutorial,
        expandedProjects: s.expandedProjects.map((name) => (name === from ? to : name))
      }))
    },

    async followTutorialRename(ref, to) {
      await update((s) => ({
        ...s,
        selectedTutorial: sameRef(s.selectedTutorial, ref)
          ? { project: ref.project, tutorial: to }
          : s.selectedTutorial
      }))
    },

    async forgetProject(name) {
      await update((s) => ({
        ...s,
        selectedTutorial: s.selectedTutorial?.project === name ? null : s.selectedTutorial,
        expandedProjects: s.expandedProjects.filter((p) => p !== name)
      }))
    },

    async forgetTutorial(ref) {
      await update((s) => ({
        ...s,
        selectedTutorial: sameRef(s.selectedTutorial, ref) ? null : s.selectedTutorial
      }))
    }
  }
}
