import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkFolder } from '../src/main/folderCheck'
import { createSettingsService, parseSettings } from '../src/main/settings'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tuto-settings-'))
})

afterEach(async () => {
  await chmod(join(dir, 'readonly'), 0o755).catch(() => {})
  await rm(dir, { recursive: true, force: true })
})

const defaults = { projectsFolder: null, selectedTutorial: null, expandedProjects: [] }
const emptyState = { ...defaults, projectsFolderProblem: null }
const ref = { project: 'Python', tutorial: 'Install' }

/** A Projects folder with `Python/Install` inside, and a settings service pointing at it. */
async function withTutorial(): Promise<{
  service: ReturnType<typeof createSettingsService>
  root: string
  file: string
}> {
  const root = join(dir, 'projects')
  await mkdir(join(root, 'Python', 'Install'), { recursive: true })
  const file = join(dir, 'settings.json')
  const service = createSettingsService(file)
  await service.setProjectsFolder(root)
  return { service, root, file }
}

describe('parseSettings', () => {
  it('keeps valid fields', () => {
    const raw = { projectsFolder: '/p', selectedTutorial: ref, expandedProjects: ['A', 'B'] }
    expect(parseSettings(raw)).toEqual(raw)
  })

  it.each([null, undefined, 'text', 42, [], {}])('falls back to defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(defaults)
  })

  it('ignores a v0.1 settings file', () => {
    expect(parseSettings({ outputFolder: '/tmp/shots' })).toEqual(defaults)
  })

  it('drops each malformed field on its own', () => {
    expect(
      parseSettings({ projectsFolder: '', selectedTutorial: ref, expandedProjects: ['A'] })
    ).toEqual({ projectsFolder: null, selectedTutorial: ref, expandedProjects: ['A'] })
    expect(parseSettings({ projectsFolder: '/p', selectedTutorial: { project: 'A' } })).toEqual({
      ...defaults,
      projectsFolder: '/p'
    })
    expect(parseSettings({ expandedProjects: ['A', 3, '', null, 'B'] })).toEqual({
      ...defaults,
      expandedProjects: ['A', 'B']
    })
    expect(parseSettings({ expandedProjects: 'A' })).toEqual(defaults)
  })

  it('keeps only the two fields of a selection', () => {
    expect(parseSettings({ selectedTutorial: { ...ref, extra: true } }).selectedTutorial).toEqual(
      ref
    )
  })
})

describe('settings service', () => {
  it('starts with defaults when the file is missing', async () => {
    expect(await createSettingsService(join(dir, 'settings.json')).get()).toEqual(emptyState)
  })

  it('falls back to defaults when the file is corrupt', async () => {
    const file = join(dir, 'settings.json')
    await writeFile(file, '{ not json')
    expect(await createSettingsService(file).get()).toEqual(emptyState)
  })

  it('remembers the folder, the selection and the expanded Projects across restarts', async () => {
    const { service, root, file } = await withTutorial()
    await service.selectTutorial(ref)
    await service.setExpanded(['Python', 'Python'])

    expect(await createSettingsService(file).get()).toEqual({
      projectsFolder: root,
      projectsFolderProblem: null,
      selectedTutorial: ref,
      expandedProjects: ['Python']
    })
  })

  it('writes valid JSON and leaves no temporary file behind', async () => {
    const file = join(dir, 'nested', 'settings.json')
    await createSettingsService(file).setProjectsFolder(dir)
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ ...defaults, projectsFolder: dir })
    await expect(readFile(`${file}.tmp`)).rejects.toThrow()
  })

  it('clears the selection and the expanded list when the folder changes', async () => {
    const { service } = await withTutorial()
    await service.selectTutorial(ref)
    await service.setExpanded(['Python'])

    const state = await service.setProjectsFolder(dir)
    expect(state).toEqual({ ...emptyState, projectsFolder: dir })
  })

  it('reports a problem when the folder was deleted', async () => {
    const { service, root } = await withTutorial()
    await rm(root, { recursive: true })

    const state = await service.get()
    expect(state.projectsFolder).toBe(root)
    expect(state.projectsFolderProblem).toMatch(/no longer exists/i)
    expect(state.selectedTutorial).toBeNull()
  })

  it('reports no selection when the selected Tutorial folder is gone', async () => {
    const { service, root } = await withTutorial()
    await service.selectTutorial(ref)
    await rm(join(root, 'Python', 'Install'), { recursive: true })
    expect((await service.get()).selectedTutorial).toBeNull()
  })

  it('follows a renamed Project in the selection and the expanded list', async () => {
    const { service, root } = await withTutorial()
    await service.selectTutorial(ref)
    await service.setExpanded(['Python', 'Other'])
    await service.followProjectRename('Python', 'Py')
    await mkdir(join(root, 'Py', 'Install'), { recursive: true })

    const state = await service.get()
    expect(state.selectedTutorial).toEqual({ project: 'Py', tutorial: 'Install' })
    expect(state.expandedProjects).toEqual(['Py', 'Other'])
  })

  it('follows a renamed Tutorial only when it is the selected one', async () => {
    const { service, root } = await withTutorial()
    await mkdir(join(root, 'Python', 'Setup'))
    await service.selectTutorial(ref)

    await service.followTutorialRename({ project: 'Python', tutorial: 'Other' }, 'X')
    expect((await service.get()).selectedTutorial).toEqual(ref)

    await service.followTutorialRename(ref, 'Setup')
    expect((await service.get()).selectedTutorial).toEqual({ project: 'Python', tutorial: 'Setup' })
  })

  it('forgets a trashed Project or Tutorial', async () => {
    const { service } = await withTutorial()
    await service.selectTutorial(ref)
    await service.setExpanded(['Python', 'Other'])

    await service.forgetTutorial({ project: 'Python', tutorial: 'Other' })
    expect((await service.get()).selectedTutorial).toEqual(ref)
    await service.forgetTutorial(ref)
    expect((await service.get()).selectedTutorial).toBeNull()

    await service.selectTutorial(ref)
    await service.forgetProject('Python')
    const state = await service.get()
    expect(state.selectedTutorial).toBeNull()
    expect(state.expandedProjects).toEqual(['Other'])
  })
})

describe('checkFolder', () => {
  it('accepts a writable folder', async () => {
    expect(await checkFolder(dir)).toBeNull()
  })

  it('rejects a missing folder', async () => {
    expect(await checkFolder(join(dir, 'missing'))).toMatch(/no longer exists/i)
  })

  it('rejects a path that is a file', async () => {
    const file = join(dir, 'file.txt')
    await writeFile(file, 'x')
    expect(await checkFolder(file)).toMatch(/not a folder/i)
  })

  it.skipIf(process.getuid?.() === 0)('rejects a folder that is not writable', async () => {
    const readonly = join(dir, 'readonly')
    await mkdir(readonly)
    await chmod(readonly, 0o555)
    expect(await checkFolder(readonly)).toMatch(/cannot write/i)
  })
})
