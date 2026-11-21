import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { SettingsState } from '../shared/ipc'
import { checkOutputFolder } from './outputFolder'

interface StoredSettings {
  outputFolder: string | null
}

const DEFAULTS: StoredSettings = { outputFolder: null }

/** Accepts anything that was read from disk and keeps only what is valid. */
export function parseSettings(raw: unknown): StoredSettings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS }
  const { outputFolder } = raw as Record<string, unknown>
  return {
    outputFolder: typeof outputFolder === 'string' && outputFolder !== '' ? outputFolder : null
  }
}

export interface SettingsService {
  get(): Promise<SettingsState>
  setOutputFolder(folder: string): Promise<SettingsState>
}

/** Settings live in one small JSON file. A missing or corrupt file means defaults. */
export function createSettingsService(filePath: string): SettingsService {
  async function load(): Promise<StoredSettings> {
    try {
      return parseSettings(JSON.parse(await readFile(filePath, 'utf8')))
    } catch {
      return { ...DEFAULTS }
    }
  }

  async function save(settings: StoredSettings): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true })
    // Write to a temporary file first so a crash never leaves a half-written settings file.
    const tmp = `${filePath}.tmp`
    await writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
    await rename(tmp, filePath)
  }

  async function toState(settings: StoredSettings): Promise<SettingsState> {
    return {
      outputFolder: settings.outputFolder,
      outputFolderProblem: settings.outputFolder
        ? await checkOutputFolder(settings.outputFolder)
        : null
    }
  }

  return {
    async get() {
      return toState(await load())
    },
    async setOutputFolder(folder) {
      const settings = { ...(await load()), outputFolder: folder }
      await save(settings)
      return toState(settings)
    }
  }
}
