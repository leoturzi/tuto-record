import { mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectsService, type ProjectsService } from '../src/main/projects'

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

const ref = { project: 'Python', tutorial: 'Install' }

describe('listTree', () => {
  it('lists Projects and Tutorials newest first', async () => {
    await mkdirs('Old', 'Old/First', 'Old/Second', 'New')
    expect(await service.listTree()).toEqual([
      { name: 'New', tutorials: [] },
      { name: 'Old', tutorials: [{ name: 'Second' }, { name: 'First' }] }
    ])
  })

  it('skips hidden folders, plain files and symbolic links', async () => {
    await mkdirs('Python/Install', '.hidden', 'Python/.cache')
    await writeFile(join(root, 'notes.txt'), 'x')
    await writeFile(join(root, 'Python', 'readme.md'), 'x')
    await mkdir(join(dir, 'outside'))
    await symlink(join(dir, 'outside'), join(root, 'Link'))
    expect(await service.listTree()).toEqual([{ name: 'Python', tutorials: [{ name: 'Install' }] }])
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
  it('creates a Project and a Tutorial, trimming the name', async () => {
    expect(await service.createProject('  Python ')).toEqual({ error: null })
    expect(await service.createTutorial('Python', 'Install')).toEqual({ error: null })
    expect(await readdir(join(root, 'Python'))).toEqual(['Install'])
  })

  it('refuses invalid and duplicate names', async () => {
    await mkdirs('Python')
    await writeFile(join(root, 'notes'), 'x')
    expect((await service.createProject('python')).error).toMatch(/already used/)
    expect((await service.createProject('NOTES')).error).toMatch(/already used/)
    expect((await service.createProject('a/b')).error).toMatch(/\/ or :/)
    expect((await service.createProject('')).error).toMatch(/enter a name/i)
  })

  it('refuses a Tutorial in a Project that does not exist', async () => {
    await expect(service.createTutorial('Missing', 'X')).rejects.toThrow(/no longer exists/)
    await expect(service.createTutorial('..', 'X')).rejects.toThrow(/no longer exists/)
  })
})

describe('rename', () => {
  it('renames a Project and a Tutorial', async () => {
    await mkdirs('Python/Install')
    expect(await service.renameTutorial(ref, 'Setup')).toEqual({ error: null })
    expect(await service.renameProject('Python', 'Py')).toEqual({ error: null })
    expect(await service.listTree()).toEqual([{ name: 'Py', tutorials: [{ name: 'Setup' }] }])
  })

  it('allows a case-only rename and an unchanged name', async () => {
    await mkdirs('git')
    expect(await service.renameProject('git', 'Git')).toEqual({ error: null })
    expect(await service.renameProject('Git', ' Git ')).toEqual({ error: null })
    expect((await service.listTree()).map((p) => p.name)).toEqual(['Git'])
  })

  it('refuses a name that is already used', async () => {
    await mkdirs('A', 'B')
    expect((await service.renameProject('A', 'b')).error).toMatch(/already used/)
  })

  it('refuses names that are not existing direct children', async () => {
    await mkdirs('Python/Install')
    await expect(service.renameProject('..', 'X')).rejects.toThrow(/no longer exists/)
    await expect(service.renameProject('Python/Install', 'X')).rejects.toThrow(/no longer exists/)
    await expect(
      service.renameTutorial({ project: 'Python', tutorial: '../Python' }, 'X')
    ).rejects.toThrow(/no longer exists/)
  })
})

describe('trash', () => {
  it('trashes a Tutorial and a Project, and counts Tutorials', async () => {
    await mkdirs('Python/Install', 'Python/Other')
    expect(await service.countTutorials('Python')).toBe(2)
    await service.trashTutorial(ref)
    expect(trashed).toEqual([join(root, 'Python', 'Install')])
    await service.trashProject('Python')
    expect(trashed[1]).toBe(join(root, 'Python'))
  })

  it('refuses to trash anything outside the Projects folder', async () => {
    await expect(service.trashProject('..')).rejects.toThrow()
    await expect(service.trashTutorial({ project: '.', tutorial: 'projects' })).rejects.toThrow()
    expect(trashed).toEqual([])
  })
})

describe('images', () => {
  beforeEach(async () => {
    await mkdirs('Python/Install/sub')
  })

  const put = (name: string): Promise<void> =>
    writeFile(join(root, 'Python', 'Install', name), name)

  it('lists image files sorted by name, ignoring other files and subfolders', async () => {
    for (const name of ['b.jpg', 'a10.png', 'a2.PNG', 'notes.txt', '.hidden.png', 'c.webp']) {
      await put(name)
    }
    await writeFile(join(root, 'Python', 'Install', 'sub', 'nested.png'), 'x')
    const files = (await service.listImages(ref)).map((i) => i.file)
    expect(files).toEqual(['a2.PNG', 'a10.png', 'b.jpg', 'c.webp'])
  })

  it('puts Screenshots in Click order, d1 before d2', async () => {
    for (const name of [
      '2026-11-21_09-15-43-001_d1.png',
      '2026-11-21_09-15-42-123_d2.png',
      '2026-11-21_09-15-42-123_d1.png'
    ]) {
      await put(name)
    }
    expect((await service.listImages(ref)).map((i) => i.file)).toEqual([
      '2026-11-21_09-15-42-123_d1.png',
      '2026-11-21_09-15-42-123_d2.png',
      '2026-11-21_09-15-43-001_d1.png'
    ])
  })

  it('gives a new version when the file changes', async () => {
    await put('a.png')
    const path = join(root, 'Python', 'Install', 'a.png')
    await utimes(path, new Date(2026, 0, 1), new Date(2026, 0, 1))
    const before = (await service.listImages(ref))[0].version
    await utimes(path, new Date(2026, 0, 2), new Date(2026, 0, 2))
    expect((await service.listImages(ref))[0].version).not.toBe(before)
  })

  it('resolves a listed image and refuses anything else', async () => {
    await put('a.png')
    await put('notes.txt')
    await writeFile(join(dir, 'secret.png'), 'x')
    await symlink(join(dir, 'secret.png'), join(root, 'Python', 'Install', 'link.png'))

    expect(await service.imagePath(ref, 'a.png')).toBe(join(root, 'Python', 'Install', 'a.png'))
    for (const file of ['notes.txt', 'missing.png', '../../../secret.png', 'sub', 'link.png']) {
      await expect(service.imagePath(ref, file)).rejects.toThrow(/no longer exists/)
    }
    expect((await service.listImages(ref)).map((i) => i.file)).toEqual(['a.png'])
  })

  it('trashes one image, or all of them', async () => {
    await put('a.png')
    await put('b.png')
    await put('keep.txt')
    await service.trashImage(ref, 'a.png')
    expect(trashed).toEqual([join(root, 'Python', 'Install', 'a.png')])
    await expect(service.trashImage(ref, 'keep.txt')).rejects.toThrow()

    await put('c.png')
    await service.trashAllImages(ref)
    expect((await readdir(join(root, 'Python', 'Install'))).sort()).toEqual(['keep.txt', 'sub'])
  })

  it('stops emptying a Tutorial at the first failure', async () => {
    await put('a.png')
    await put('b.png')
    const failing = createProjectsService({
      getRoot: async () => root,
      trash: vi.fn(async () => {
        throw new Error('Trash is not available')
      })
    })
    await expect(failing.trashAllImages(ref)).rejects.toThrow(/not available/)
  })
})
