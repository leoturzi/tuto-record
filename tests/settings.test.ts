import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkOutputFolder } from '../src/main/outputFolder'
import { createSettingsService, parseSettings } from '../src/main/settings'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tuto-settings-'))
})

afterEach(async () => {
  await chmod(join(dir, 'readonly'), 0o755).catch(() => {})
  await rm(dir, { recursive: true, force: true })
})

describe('parseSettings', () => {
  it('keeps a valid folder', () => {
    expect(parseSettings({ outputFolder: '/tmp/shots' })).toEqual({ outputFolder: '/tmp/shots' })
  })

  it.each([null, undefined, 'text', 42, [], {}, { outputFolder: 5 }, { outputFolder: '' }])(
    'falls back to defaults for %j',
    (raw) => {
      expect(parseSettings(raw)).toEqual({ outputFolder: null })
    }
  )
})

describe('settings service', () => {
  it('starts with no folder when the file is missing', async () => {
    const service = createSettingsService(join(dir, 'settings.json'))
    expect(await service.get()).toEqual({ outputFolder: null, outputFolderProblem: null })
  })

  it('falls back to defaults when the file is corrupt', async () => {
    const file = join(dir, 'settings.json')
    await writeFile(file, '{ not json')
    expect(await createSettingsService(file).get()).toEqual({
      outputFolder: null,
      outputFolderProblem: null
    })
  })

  it('remembers the folder across restarts', async () => {
    const file = join(dir, 'nested', 'settings.json')
    const shots = join(dir, 'shots')
    await mkdir(shots)
    await createSettingsService(file).setOutputFolder(shots)

    const afterRestart = await createSettingsService(file).get()
    expect(afterRestart).toEqual({ outputFolder: shots, outputFolderProblem: null })
  })

  it('writes valid JSON and leaves no temporary file behind', async () => {
    const file = join(dir, 'settings.json')
    await createSettingsService(file).setOutputFolder(dir)
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ outputFolder: dir })
    await expect(readFile(`${file}.tmp`)).rejects.toThrow()
  })

  it('reports a problem when the saved folder was deleted', async () => {
    const file = join(dir, 'settings.json')
    const shots = join(dir, 'shots')
    await mkdir(shots)
    const service = createSettingsService(file)
    await service.setOutputFolder(shots)
    await rm(shots, { recursive: true })

    const state = await service.get()
    expect(state.outputFolder).toBe(shots)
    expect(state.outputFolderProblem).toMatch(/no longer exists/i)
  })
})

describe('checkOutputFolder', () => {
  it('accepts a writable folder', async () => {
    expect(await checkOutputFolder(dir)).toBeNull()
  })

  it('rejects a missing folder', async () => {
    expect(await checkOutputFolder(join(dir, 'missing'))).toMatch(/no longer exists/i)
  })

  it('rejects a path that is a file', async () => {
    const file = join(dir, 'file.txt')
    await writeFile(file, 'x')
    expect(await checkOutputFolder(file)).toMatch(/not a folder/i)
  })

  it.skipIf(process.getuid?.() === 0)('rejects a folder that is not writable', async () => {
    const readonly = join(dir, 'readonly')
    await mkdir(readonly)
    await chmod(readonly, 0o555)
    expect(await checkOutputFolder(readonly)).toMatch(/cannot write/i)
  })
})
