import { describe, expect, it } from 'vitest'
import {
  buildSidebarRows,
  editingSiblings,
  sidebarEmptyMessage,
  type Draft
} from '../src/renderer/src/sidebar/treeView'
import type { ProjectNode } from '../src/shared/ipc'

const tree: ProjectNode[] = [
  { name: 'Python', tutorials: [{ name: 'Install' }, { name: 'Venv' }] },
  { name: 'Git', tutorials: [{ name: 'Basics' }] }
]
const draft: Draft = { value: 'x', error: null }
const shape = (rows: ReturnType<typeof buildSidebarRows>): string[] =>
  rows.map((r) => `${r.kind}:${r.name}${r.editing ? '*' : ''}`)

describe('buildSidebarRows', () => {
  it('keeps main’s order and shows Tutorials only under expanded Projects', () => {
    const rows = buildSidebarRows(tree, ['Python'], null, null, draft)
    expect(shape(rows)).toEqual([
      'project:Python',
      'tutorial:Install',
      'tutorial:Venv',
      'project:Git'
    ])
    expect(rows[0]).toMatchObject({ expanded: true, depth: 0 })
    expect(rows[1]).toMatchObject({ depth: 1, project: 'Python' })
    expect(rows[3].expanded).toBe(false)
  })

  it('marks the selected Tutorial', () => {
    const rows = buildSidebarRows(
      tree,
      ['Python', 'Git'],
      { project: 'Git', tutorial: 'Basics' },
      null,
      draft
    )
    expect(rows.filter((r) => r.selected).map((r) => r.key)).toEqual(['tutorial/Git/Basics'])
  })

  it('ignores expanded names that no longer exist', () => {
    expect(shape(buildSidebarRows(tree, ['Gone'], null, null, draft))).toEqual([
      'project:Python',
      'project:Git'
    ])
  })

  it('puts a new Project row first', () => {
    const rows = buildSidebarRows(tree, [], null, { kind: 'new-project' }, draft)
    expect(shape(rows)[0]).toBe('new-project:*')
    expect(rows[0].editing).toBe(draft)
  })

  it('puts a new Tutorial row first in its Project, expanding it', () => {
    const rows = buildSidebarRows(tree, [], null, { kind: 'new-tutorial', project: 'Git' }, draft)
    expect(shape(rows)).toEqual([
      'project:Python',
      'project:Git',
      'new-tutorial:*',
      'tutorial:Basics'
    ])
    expect(rows[1].expanded).toBe(true)
  })

  it('turns the renamed row into a field and keeps its key', () => {
    const project = buildSidebarRows(
      tree,
      [],
      null,
      { kind: 'rename-project', project: 'Git' },
      draft
    )
    expect(shape(project)).toEqual(['project:Python', 'project:Git*'])
    expect(project[1].key).toBe('project/Git')

    const tutorial = buildSidebarRows(
      tree,
      ['Python'],
      null,
      { kind: 'rename-tutorial', ref: { project: 'Python', tutorial: 'Venv' } },
      draft
    )
    expect(shape(tutorial)).toContain('tutorial:Venv*')
    expect(tutorial.find((r) => r.editing)?.key).toBe('tutorial/Python/Venv')
  })
})

describe('editingSiblings', () => {
  it('compares Projects with Projects and Tutorials with their Project’s Tutorials', () => {
    expect(editingSiblings(tree, { kind: 'new-project' })).toEqual({ siblings: ['Python', 'Git'] })
    expect(editingSiblings(tree, { kind: 'rename-project', project: 'Git' })).toEqual({
      siblings: ['Python', 'Git'],
      current: 'Git'
    })
    expect(editingSiblings(tree, { kind: 'new-tutorial', project: 'Python' })).toEqual({
      siblings: ['Install', 'Venv']
    })
    expect(
      editingSiblings(tree, {
        kind: 'rename-tutorial',
        ref: { project: 'Git', tutorial: 'Basics' }
      })
    ).toEqual({ siblings: ['Basics'], current: 'Basics' })
  })
})

describe('sidebarEmptyMessage', () => {
  it('explains an empty sidebar', () => {
    expect(sidebarEmptyMessage(false, 0)).toMatch(/Settings/)
    expect(sidebarEmptyMessage(true, 0)).toMatch(/No projects yet/)
    expect(sidebarEmptyMessage(true, 2)).toBeNull()
  })
})
