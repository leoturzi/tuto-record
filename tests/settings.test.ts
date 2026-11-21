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

const defaults = { projectsFolder: null, selectedTutorial: null, expanded: [] }
const emptyState = { ...defaults, projectsFolderProblem: null }
const tutorial = ['Python', 'Install']
const deep = ['Python', 'Setup', 'macOS', 'Install']

/** A Projects folder with `Python/Install` and `Python/Setup/macOS/Install`, and a service for it. */
async function withTutorials(): Promise<{
  service: ReturnType<typeof createSettingsService>
  root: string
  file: string
}> {
  const root = join(dir, 'projects')
  await mkdir(join(root, ...tutorial), { recursive: true })
  await mkdir(join(root, ...deep), { recursive: true })
  const file = join(dir, 'settings.json')
  const service = createSettingsService(file)
  await service.setProjectsFolder(root)
  return { service, root, file }
}

describe('parseSettings', () => {
  it('keeps valid fields', () => {
    const raw = {
      projectsFolder: '/p',
      selectedTutorial: deep,
      expanded: ['Python', 'Python/Setup']
    }
    expect(parseSettings(raw)).toEqual(raw)
  })

  it.each([null, undefined, 'text', 42, [], {}])('falls back to defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(defaults)
  })

  it('ignores a v0.1 settings file', () => {
    expect(parseSettings({ outputFolder: '/tmp/shots' })).toEqual(defaults)
  })

  it('reads a v0.2 settings file', () => {
    expect(
      parseSettings({
        projectsFolder: '/p',
        selectedTutorial: { project: 'Python', tutorial: 'Install' },
        expandedProjects: ['Python', 'Git']
      })
    ).toEqual({ projectsFolder: '/p', selectedTutorial: tutorial, expanded: ['Python', 'Git'] })
  })

  it('drops each malformed field on its own', () => {
    expect(
      parseSettings({ projectsFolder: '', selectedTutorial: tutorial, expanded: ['A'] })
    ).toEqual({ projectsFolder: null, selectedTutorial: tutorial, expanded: ['A'] })
    for (const selection of [['Python'], ['Python', ''], [3, 'a'], { project: 'A' }, 'Python']) {
      expect(parseSettings({ selectedTutorial: selection }).selectedTutorial).toBeNull()
    }
    expect(parseSettings({ expanded: ['A', 3, '', null, 'B', 'A'] }).expanded).toEqual(['A', 'B'])
    expect(parseSettings({ expanded: 'A' })).toEqual(defaults)
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

  it('remembers the folder, the selection and the expanded keys across restarts', async () => {
    const { service, root, file } = await withTutorials()
    await service.selectTutorial(deep)
    await service.setExpanded(['Python', 'Python/Setup', 'Python'])

    expect(await createSettingsService(file).get()).toEqual({
      projectsFolder: root,
      projectsFolderProblem: null,
      selectedTutorial: deep,
      expanded: ['Python', 'Python/Setup']
    })
  })

  it('opens a v0.2 file on the same Tutorial with the same Projects expanded', async () => {
    const { root, file } = await withTutorials()
    await writeFile(
      file,
      JSON.stringify({
        projectsFolder: root,
        selectedTutorial: { project: 'Python', tutorial: 'Install' },
        expandedProjects: ['Python']
      })
    )
    const state = await createSettingsService(file).get()
    expect(state.selectedTutorial).toEqual(tutorial)
    expect(state.expanded).toEqual(['Python'])
  })

  it('writes valid JSON and leaves no temporary file behind', async () => {
    const file = join(dir, 'nested', 'settings.json')
    await createSettingsService(file).setProjectsFolder(dir)
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ ...defaults, projectsFolder: dir })
    await expect(readFile(`${file}.tmp`)).rejects.toThrow()
  })

  it('clears the selection and the expanded list when the folder changes', async () => {
    const { service } = await withTutorials()
    await service.selectTutorial(tutorial)
    await service.setExpanded(['Python'])
    expect(await service.setProjectsFolder(dir)).toEqual({ ...emptyState, projectsFolder: dir })
  })

  it('reports a problem when the folder was deleted', async () => {
    const { service, root } = await withTutorials()
    await rm(root, { recursive: true })
    const state = await service.get()
    expect(state.projectsFolder).toBe(root)
    expect(state.projectsFolderProblem).toMatch(/no longer exists/i)
    expect(state.selectedTutorial).toBeNull()
  })

  it('reports no selection when the selected Tutorial folder is gone', async () => {
    const { service, root } = await withTutorials()
    await service.selectTutorial(deep)
    await rm(join(root, ...deep), { recursive: true })
    expect((await service.get()).selectedTutorial).toBeNull()
  })

  it('follows a renamed or moved Group in the selection and the expanded keys', async () => {
    const { service, root } = await withTutorials()
    await service.selectTutorial(deep)
    await service.setExpanded(['Python', 'Python/Setup', 'Python/Setup/macOS', 'Git'])
    await service.followMove(['Python', 'Setup'], ['Git', 'Setup'])
    await mkdir(join(root, 'Git', 'Setup', 'macOS', 'Install'), { recursive: true })

    const state = await service.get()
    expect(state.selectedTutorial).toEqual(['Git', 'Setup', 'macOS', 'Install'])
    expect(state.expanded).toEqual(['Python', 'Git/Setup', 'Git/Setup/macOS', 'Git'])
  })

  it('follows a renamed Tutorial only when it is the selected one', async () => {
    const { service, root } = await withTutorials()
    await mkdir(join(root, 'Python', 'Setup2'))
    await service.selectTutorial(tutorial)
    await service.followMove(['Python', 'Other'], ['Python', 'X'])
    expect((await service.get()).selectedTutorial).toEqual(tutorial)
    await service.followMove(tutorial, ['Python', 'Setup2'])
    expect((await service.get()).selectedTutorial).toEqual(['Python', 'Setup2'])
  })

  it('forgets what was trashed, at any depth', async () => {
    const { service } = await withTutorials()
    await service.selectTutorial(deep)
    await service.setExpanded(['Python', 'Python/Setup', 'Python/Setup/macOS', 'Git'])

    await service.forget(['Python', 'Other'])
    expect((await service.get()).selectedTutorial).toEqual(deep)

    await service.forget(['Python', 'Setup'])
    const state = await service.get()
    expect(state.selectedTutorial).toBeNull()
    expect(state.expanded).toEqual(['Python', 'Git'])

    await service.forget(['Python'])
    expect((await service.get()).expanded).toEqual(['Git'])
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
