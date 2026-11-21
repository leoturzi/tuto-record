import { describe, expect, it } from 'vitest'
import {
  buildSidebarRows,
  canDrop,
  editingSiblings,
  sidebarEmptyMessage,
  type Draft,
  type SidebarRow
} from '../src/renderer/src/sidebar/treeView'
import type { ProjectNode } from '../src/shared/ipc'

const tree: ProjectNode[] = [
  {
    name: 'Python',
    children: [
      {
        kind: 'group',
        name: 'Setup',
        children: [
          { kind: 'group', name: 'macOS', children: [{ kind: 'tutorial', name: 'Install' }] },
          { kind: 'tutorial', name: 'Venv' }
        ]
      },
      { kind: 'tutorial', name: 'Quick start' }
    ]
  },
  { name: 'Git', children: [{ kind: 'tutorial', name: 'Basics' }] }
]
const draft: Draft = { value: 'x', error: null }
const shape = (rows: SidebarRow[]): string[] =>
  rows.map((r) => `${'  '.repeat(r.depth)}${r.kind}:${r.name}${r.editing ? '*' : ''}`)
const all = ['Python', 'Python/Setup', 'Python/Setup/macOS', 'Git']

describe('buildSidebarRows', () => {
  it('keeps main’s order and shows children only under expanded Projects and Groups', () => {
    expect(shape(buildSidebarRows(tree, ['Python'], null, null, draft))).toEqual([
      'project:Python',
      '  group:Setup',
      '  tutorial:Quick start',
      'project:Git'
    ])
    const rows = buildSidebarRows(tree, all, null, null, draft)
    expect(shape(rows)).toEqual([
      'project:Python',
      '  group:Setup',
      '    group:macOS',
      '      tutorial:Install',
      '    tutorial:Venv',
      '  tutorial:Quick start',
      'project:Git',
      '  tutorial:Basics'
    ])
    expect(rows[3]).toMatchObject({
      key: 'Python/Setup/macOS/Install',
      path: ['Python', 'Setup', 'macOS', 'Install'],
      depth: 3
    })
    expect(rows[1].expanded).toBe(true)
  })

  it('does not open a Group just because its Project is open', () => {
    expect(shape(buildSidebarRows(tree, ['Python', 'Python/Setup'], null, null, draft))).toContain(
      '    group:macOS'
    )
    expect(
      shape(buildSidebarRows(tree, ['Python', 'Python/Setup'], null, null, draft))
    ).not.toContain('      tutorial:Install')
  })

  it('marks the selected Tutorial at any depth', () => {
    const rows = buildSidebarRows(tree, all, ['Python', 'Setup', 'macOS', 'Install'], null, draft)
    expect(rows.filter((r) => r.selected).map((r) => r.key)).toEqual(['Python/Setup/macOS/Install'])
  })

  it('ignores expanded keys that no longer exist', () => {
    expect(shape(buildSidebarRows(tree, ['Gone', 'Python/Gone'], null, null, draft))).toEqual([
      'project:Python',
      'project:Git'
    ])
  })

  it('puts a new Project row first', () => {
    const rows = buildSidebarRows(
      tree,
      [],
      null,
      { kind: 'new', parent: [], what: 'project' },
      draft
    )
    expect(shape(rows)[0]).toBe('new:*')
    expect(rows[0]).toMatchObject({ creating: 'project', path: [], depth: 0, editing: draft })
  })

  it('puts a new row first inside its Group, showing the Group expanded', () => {
    const rows = buildSidebarRows(
      tree,
      ['Python'],
      null,
      { kind: 'new', parent: ['Python', 'Setup'], what: 'group' },
      draft
    )
    expect(shape(rows)).toEqual([
      'project:Python',
      '  group:Setup',
      '    new:*',
      '    group:macOS',
      '    tutorial:Venv',
      '  tutorial:Quick start',
      'project:Git'
    ])
    expect(rows[2]).toMatchObject({ creating: 'group', path: ['Python', 'Setup'] })
  })

  it('turns the renamed row into a field and keeps its key', () => {
    const rows = buildSidebarRows(
      tree,
      all,
      null,
      { kind: 'rename', path: ['Python', 'Setup', 'macOS'] },
      draft
    )
    const editing = rows.filter((r) => r.editing)
    expect(editing.map((r) => r.key)).toEqual(['Python/Setup/macOS'])
  })
})

describe('editingSiblings', () => {
  it('compares a name with the other names at its level', () => {
    expect(editingSiblings(tree, { kind: 'new', parent: [], what: 'project' })).toEqual({
      siblings: ['Python', 'Git']
    })
    expect(editingSiblings(tree, { kind: 'new', parent: ['Python'], what: 'group' })).toEqual({
      siblings: ['Setup', 'Quick start']
    })
    expect(
      editingSiblings(tree, { kind: 'new', parent: ['Python', 'Setup', 'macOS'], what: 'tutorial' })
    ).toEqual({ siblings: ['Install'] })
    expect(editingSiblings(tree, { kind: 'rename', path: ['Git'] })).toEqual({
      siblings: ['Python', 'Git'],
      current: 'Git'
    })
    expect(editingSiblings(tree, { kind: 'rename', path: ['Python', 'Setup', 'Venv'] })).toEqual({
      siblings: ['macOS', 'Venv'],
      current: 'Venv'
    })
  })
})

describe('canDrop', () => {
  const rows = buildSidebarRows(tree, all, null, null, draft)
  const row = (key: string): SidebarRow => rows.find((r) => r.key === key)!

  it('accepts a Tutorial or Group onto another Project or Group', () => {
    expect(canDrop(row('Python/Quick start'), row('Python/Setup'))).toBe(true)
    expect(canDrop(row('Python/Quick start'), row('Git'))).toBe(true)
    expect(canDrop(row('Python/Setup/macOS'), row('Git'))).toBe(true)
    expect(canDrop(row('Python/Setup/macOS'), row('Python'))).toBe(true)
  })

  it('refuses Projects, Tutorials as targets, a Group into itself, and the current parent', () => {
    expect(canDrop(row('Python'), row('Git'))).toBe(false)
    expect(canDrop(row('Python/Quick start'), row('Git/Basics'))).toBe(false)
    expect(canDrop(row('Python/Setup'), row('Python/Setup'))).toBe(false)
    expect(canDrop(row('Python/Setup'), row('Python/Setup/macOS'))).toBe(false)
    expect(canDrop(row('Python/Quick start'), row('Python'))).toBe(false)
    expect(canDrop(row('Python/Setup/macOS/Install'), row('Python/Setup/macOS'))).toBe(false)
  })

  it('refuses rows that are being edited', () => {
    const editing = { ...row('Python/Quick start'), editing: draft }
    expect(canDrop(editing, row('Git'))).toBe(false)
  })
})

describe('sidebarEmptyMessage', () => {
  it('explains an empty sidebar', () => {
    expect(sidebarEmptyMessage(false, 0)).toMatch(/Settings/)
    expect(sidebarEmptyMessage(true, 0)).toMatch(/No projects yet/)
    expect(sidebarEmptyMessage(true, 2)).toBeNull()
  })
})
