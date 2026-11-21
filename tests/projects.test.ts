import { mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classify,
  createProjectsService,
  GROUP_TAG,
  type ProjectsService
} from '../src/main/projects'

let dir: string
let root: string
let trashed: string[]
let service: ProjectsService

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Creates folders in order, far enough apart that their creation times differ. */
async function mkdirs(...paths: string[]): Promise<void> {
  for (const path of paths) {
    await mkdir(join(root, path), { recursive: true })
    await wait(15)
  }
}

const put = (path: string, content = 'x'): Promise<void> => writeFile(join(root, path), content)
const tag = (path: string): Promise<void> => put(join(path, GROUP_TAG), '')

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tuto-projects-'))
  root = join(dir, 'projects')
  await mkdir(root)
  trashed = []
  service = createProjectsService({
    getRoot: async () => root,
    trash: vi.fn(async (path: string) => {
      trashed.push(path)
      await rm(path, { recursive: true })
    })
  })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const tutorial = ['Python', 'Install']

describe('classify', () => {
  it('follows the rules in order', async () => {
    await mkdirs('tagged/sub', 'images/sub', 'nested/sub', 'empty', 'files', 'hiddenSub/.git')
    await tag('tagged')
    await put('tagged/a.png')
    await put('images/a.PNG')
    await put('files/notes.txt')
    await mkdir(join(dir, 'outside'))
    await mkdirs('linked')
    await symlink(join(dir, 'outside'), join(root, 'linked', 'link'))

    expect(await classify(join(root, 'tagged'))).toBe('group') // tag beats images
    expect(await classify(join(root, 'images'))).toBe('tutorial') // images beat subfolders
    expect(await classify(join(root, 'nested'))).toBe('group')
    expect(await classify(join(root, 'empty'))).toBe('tutorial')
    expect(await classify(join(root, 'files'))).toBe('tutorial')
    expect(await classify(join(root, 'hiddenSub'))).toBe('tutorial') // hidden folders don't count
    expect(await classify(join(root, 'linked'))).toBe('tutorial') // a link is not a subfolder
  })
})

describe('listTree', () => {
  it('lists a v0.2 layout unchanged: Projects with Tutorials, newest first', async () => {
    await mkdirs('Old', 'Old/First', 'Old/Second', 'New')
    expect(await service.listTree()).toEqual([
      { name: 'New', children: [] },
      {
        name: 'Old',
        children: [
          { kind: 'tutorial', name: 'Second' },
          { kind: 'tutorial', name: 'First' }
        ]
      }
    ])
  })

  it('nests Groups at any depth, Groups first, then Tutorials, each newest first', async () => {
    await mkdirs(
      'Python/Quick start',
      'Python/Setup/macOS/Install',
      'Python/Setup/Windows',
      'Python/Later',
      'Python/Empty group'
    )
    await tag('Python/Setup/Windows')
    await tag('Python/Empty group')
    await put('Python/Setup/macOS/Install/a.png')
    expect(await service.listTree()).toEqual([
      {
        name: 'Python',
        children: [
          { kind: 'group', name: 'Empty group', children: [] },
          {
            kind: 'group',
            name: 'Setup',
            children: [
              { kind: 'group', name: 'Windows', children: [] },
              {
                kind: 'group',
                name: 'macOS',
                children: [{ kind: 'tutorial', name: 'Install' }]
              }
            ]
          },
          { kind: 'tutorial', name: 'Later' },
          { kind: 'tutorial', name: 'Quick start' }
        ]
      }
    ])
  })

  it('ignores the subfolders of a Tutorial, hidden folders, files and links', async () => {
    await mkdirs('Python/Install/sub', '.hidden', 'Python/.cache')
    await put('Python/Install/a.png')
    await put('notes.txt')
    await mkdir(join(dir, 'outside'))
    await symlink(join(dir, 'outside'), join(root, 'Link'))
    expect(await service.listTree()).toEqual([
      { name: 'Python', children: [{ kind: 'tutorial', name: 'Install' }] }
    ])
  })

  it('fails with the root problem when there is no usable Projects folder', async () => {
    const broken = createProjectsService({
      getRoot: async () => {
        throw new Error('The folder no longer exists.')
      },
      trash: vi.fn()
    })
    await expect(broken.listTree()).rejects.toThrow(/no longer exists/)
  })
})

describe('create', () => {
  it('creates a Project, a Tutorial and a tagged Group, trimming the name', async () => {
    expect(await service.createProject('  Python ')).toEqual({ error: null })
    expect(await service.createItem(['Python'], 'group', 'Setup')).toEqual({ error: null })
    expect(await service.createItem(['Python', 'Setup'], 'tutorial', 'Install')).toEqual({
      error: null
    })
    expect((await readdir(join(root, 'Python', 'Setup'))).sort()).toEqual([GROUP_TAG, 'Install'])
    // An empty new Group is a Group, not a Tutorial.
    await service.createItem(['Python'], 'group', 'Later')
    expect(await classify(join(root, 'Python', 'Later'))).toBe('group')
  })

  it('refuses invalid and duplicate names', async () => {
    await mkdirs('Python/Setup')
    await put('notes')
    expect((await service.createProject('python')).error).toMatch(/already used/)
    expect((await service.createProject('NOTES')).error).toMatch(/already used/)
    expect((await service.createProject('a/b')).error).toMatch(/\/ or :/)
    expect((await service.createItem(['Python'], 'group', 'setup')).error).toMatch(/already used/)
  })

  it('creates only inside a Project or a Group', async () => {
    await mkdirs('Python/Install')
    await expect(service.createItem(['Missing'], 'tutorial', 'X')).rejects.toThrow(
      /no longer exists/
    )
    await expect(service.createItem(['..'], 'tutorial', 'X')).rejects.toThrow(/no longer exists/)
    await expect(service.createItem(['Python', 'Install'], 'tutorial', 'X')).rejects.toThrow(
      /not a Group/
    )
  })
})

describe('rename', () => {
  it('renames at any depth, Projects included', async () => {
    await mkdirs('Python/Setup/Install')
    expect(await service.rename(['Python', 'Setup', 'Install'], 'Setup steps')).toEqual({
      error: null
    })
    expect(await service.rename(['Python', 'Setup'], 'Getting started')).toEqual({ error: null })
    expect(await service.rename(['Python'], 'Py')).toEqual({ error: null })
    expect(await readdir(join(root, 'Py', 'Getting started'))).toEqual(['Setup steps'])
  })

  it('allows a case-only rename and an unchanged name, and refuses a used one', async () => {
    await mkdirs('git', 'Other')
    expect(await service.rename(['git'], 'Git')).toEqual({ error: null })
    expect(await service.rename(['Git'], ' Git ')).toEqual({ error: null })
    expect((await service.rename(['Git'], 'other')).error).toMatch(/already used/)
  })

  it('refuses paths that are not existing folders', async () => {
    await mkdirs('Python/Install')
    await expect(service.rename(['..'], 'X')).rejects.toThrow(/no longer exists/)
    await expect(service.rename(['Python/Install'], 'X')).rejects.toThrow(/no longer exists/)
    await expect(service.rename(['Python', '../Python'], 'X')).rejects.toThrow(/no longer exists/)
  })
})

describe('trash and count', () => {
  it('counts Tutorials at any depth', async () => {
    await mkdirs('Python/A', 'Python/Setup/B', 'Python/Setup/macOS/C', 'Python/Setup/macOS/D')
    expect(await service.countTutorials(['Python'])).toBe(4)
    expect(await service.countTutorials(['Python', 'Setup'])).toBe(3)
    expect(await service.countTutorials(['Python', 'A'])).toBe(0)
  })

  it('trashes at any depth and nothing outside the Projects folder', async () => {
    await mkdirs('Python/Setup/Install')
    await service.trash(['Python', 'Setup', 'Install'])
    expect(trashed).toEqual([join(root, 'Python', 'Setup', 'Install')])
    await expect(service.trash(['..'])).rejects.toThrow()
    await expect(service.trash(['.', 'projects'])).rejects.toThrow()
    expect(trashed).toHaveLength(1)
  })
})

describe('move', () => {
  beforeEach(async () => {
    await mkdirs('Python/Quick start', 'Python/Setup/Install', 'Git/Basics')
    await put('Python/Setup/Install/a.png')
    await put('Git/Basics/b.png')
  })

  it('moves a Tutorial into a Group, and a Group into another Project', async () => {
    expect(await service.move(['Python', 'Quick start'], ['Python', 'Setup'])).toEqual({
      error: null
    })
    expect(await service.move(['Python', 'Setup'], ['Git'])).toEqual({ error: null })
    expect((await readdir(join(root, 'Git', 'Setup'))).sort()).toEqual(['Install', 'Quick start'])
    expect(await readdir(join(root, 'Git', 'Setup', 'Install'))).toEqual(['a.png'])
  })

  it('does nothing when dropped onto its current parent', async () => {
    expect(await service.move(['Python', 'Quick start'], ['Python'])).toEqual({ error: null })
    expect(await readdir(join(root, 'Python'))).toContain('Quick start')
  })

  it('refuses what cannot be moved', async () => {
    expect((await service.move(['Python'], ['Git'])).error).toMatch(/Projects can't be moved/)
    expect((await service.move(['Python', 'Setup'], ['Python', 'Setup'])).error).toMatch(/itself/)
    await mkdirs('Python/Setup/Deeper/Step')
    expect((await service.move(['Python', 'Setup'], ['Python', 'Setup', 'Deeper'])).error).toMatch(
      /itself/
    )
    await expect(service.move(['Python', 'Quick start'], ['Git', 'Basics'])).rejects.toThrow(
      /not a Group/
    )
    await expect(service.move(['Python', 'Missing'], ['Git'])).rejects.toThrow(/no longer exists/)
  })

  it('refuses a name already used at the destination, ignoring case', async () => {
    await mkdirs('Git/quick START')
    expect((await service.move(['Python', 'Quick start'], ['Git'])).error).toMatch(
      /already used in "Git"/
    )
    expect(await readdir(join(root, 'Python'))).toContain('Quick start')
  })
})

describe('images', () => {
  beforeEach(async () => {
    await mkdirs('Python/Install/sub')
  })

  const putImage = (name: string): Promise<void> => put(join('Python', 'Install', name), name)

  it('lists image files sorted by name, ignoring other files and subfolders', async () => {
    for (const name of ['b.jpg', 'a10.png', 'a2.PNG', 'notes.txt', '.hidden.png', 'c.webp']) {
      await putImage(name)
    }
    await put('Python/Install/sub/nested.png')
    const files = (await service.listImages(tutorial)).map((i) => i.file)
    expect(files).toEqual(['a2.PNG', 'a10.png', 'b.jpg', 'c.webp'])
  })

  it('works for a Tutorial deep inside Groups', async () => {
    await mkdirs('Python/Setup/macOS/Install')
    await put('Python/Setup/macOS/Install/a.png')
    const deep = ['Python', 'Setup', 'macOS', 'Install']
    expect((await service.listImages(deep)).map((i) => i.file)).toEqual(['a.png'])
    expect(await service.tutorialPath(deep)).toBe(join(root, ...deep))
  })

  it('refuses a Group or a Project as a Tutorial', async () => {
    await mkdirs('Python/Setup/macOS')
    await expect(service.tutorialPath(['Python', 'Setup'])).rejects.toThrow(/not a Tutorial/)
    await expect(service.tutorialPath(['Python'])).rejects.toThrow(/not a Tutorial/)
  })

  it('puts Screenshots in Click order, d1 before d2', async () => {
    for (const name of [
      '2026-11-21_09-15-43-001_d1.png',
      '2026-11-21_09-15-42-123_d2.png',
      '2026-11-21_09-15-42-123_d1.png'
    ]) {
      await putImage(name)
    }
    expect((await service.listImages(tutorial)).map((i) => i.file)).toEqual([
      '2026-11-21_09-15-42-123_d1.png',
      '2026-11-21_09-15-42-123_d2.png',
      '2026-11-21_09-15-43-001_d1.png'
    ])
  })

  it('gives a new version when the file changes', async () => {
    await putImage('a.png')
    const path = join(root, 'Python', 'Install', 'a.png')
    await utimes(path, new Date(2026, 0, 1), new Date(2026, 0, 1))
    const before = (await service.listImages(tutorial))[0].version
    await utimes(path, new Date(2026, 0, 2), new Date(2026, 0, 2))
    expect((await service.listImages(tutorial))[0].version).not.toBe(before)
  })

  it('resolves a listed image and refuses anything else', async () => {
    await putImage('a.png')
    await putImage('notes.txt')
    await writeFile(join(dir, 'secret.png'), 'x')
    await symlink(join(dir, 'secret.png'), join(root, 'Python', 'Install', 'link.png'))

    expect(await service.imagePath(tutorial, 'a.png')).toBe(
      join(root, 'Python', 'Install', 'a.png')
    )
    for (const file of ['notes.txt', 'missing.png', '../../../secret.png', 'sub', 'link.png']) {
      await expect(service.imagePath(tutorial, file)).rejects.toThrow(/no longer exists/)
    }
  })

  it('trashes one image, or all of them', async () => {
    await putImage('a.png')
    await putImage('b.png')
    await putImage('keep.txt')
    await service.trashImage(tutorial, 'a.png')
    expect(trashed).toEqual([join(root, 'Python', 'Install', 'a.png')])
    await expect(service.trashImage(tutorial, 'keep.txt')).rejects.toThrow()

    await putImage('c.png')
    await service.trashAllImages(tutorial)
    expect((await readdir(join(root, 'Python', 'Install'))).sort()).toEqual(['keep.txt', 'sub'])
  })

  it('stops emptying a Tutorial at the first failure', async () => {
    await putImage('a.png')
    const failing = createProjectsService({
      getRoot: async () => root,
      trash: vi.fn(async () => {
        throw new Error('Trash is not available')
      })
    })
    await expect(failing.trashAllImages(tutorial)).rejects.toThrow(/not available/)
  })
})
