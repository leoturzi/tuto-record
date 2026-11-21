import type { TutorialRef } from '../../../shared/ipc'
import { $, el, setText } from '../ui/dom'
import type { SidebarRow } from './treeView'

export interface SidebarHandlers {
  select(ref: TutorialRef): void
  toggle(project: string): void
  newProject(): void
  newTutorial(project: string): void
  /** The ⋯ button was pressed; `at` is where the menu should open, in window coordinates. */
  rowMenu(row: SidebarRow, at: { x: number; y: number }): void
  draftChanged(value: string): void
  commit(): void
  cancel(): void
  /** The name field lost focus (commit a valid change, otherwise cancel). */
  blur(): void
  openSettings(): void
}

export interface Sidebar {
  /** `canCreate` is false while there is no usable Projects folder. */
  render(rows: SidebarRow[], emptyMessage: string | null, canCreate: boolean): void
}

/**
 * The sidebar: the Projects tree, the + and ⋯ buttons, the inline name fields and the Settings
 * button. Rows are reused by key between renders, and a row being edited is never rebuilt, so the
 * 1.5 s poll never takes away what the user is typing.
 */
export function createSidebar(root: HTMLElement, handlers: SidebarHandlers): Sidebar {
  const list = $('#tree', root)
  const empty = $('#sidebar-empty', root)
  const newProject = $<HTMLButtonElement>('#new-project', root)
  const elements = new Map<string, HTMLLIElement>()
  const current = new Map<string, SidebarRow>()

  newProject.addEventListener('click', () => handlers.newProject())
  $('#open-settings', root).addEventListener('click', () => handlers.openSettings())

  function buildView(item: HTMLLIElement, key: string): void {
    item.dataset.mode = 'view'
    item.replaceChildren()
    const main = el('div', 'row-main')
    main.append(el('span', 'chevron'), el('span', 'icon-folder'), el('span', 'name'))
    main.addEventListener('click', () => {
      const row = current.get(key)
      if (!row) return
      if (row.kind === 'project') handlers.toggle(row.project)
      else handlers.select({ project: row.project, tutorial: row.name })
    })

    const actions = el('div', 'row-actions')
    const add = el('button', 'row-button add', '+')
    add.type = 'button'
    add.title = 'New Tutorial'
    add.setAttribute('aria-label', 'New Tutorial')
    add.addEventListener('click', (event) => {
      event.stopPropagation()
      const row = current.get(key)
      if (row) handlers.newTutorial(row.project)
    })
    const more = el('button', 'row-button more', '⋯')
    more.type = 'button'
    more.title = 'More'
    more.setAttribute('aria-label', 'More actions')
    more.addEventListener('click', (event) => {
      event.stopPropagation()
      const row = current.get(key)
      const box = more.getBoundingClientRect()
      if (row) handlers.rowMenu(row, { x: box.left, y: box.bottom + 2 })
    })
    actions.append(add, more)
    item.append(main, actions)
  }

  function buildEdit(item: HTMLLIElement, row: SidebarRow): HTMLInputElement {
    item.dataset.mode = 'edit'
    item.replaceChildren()
    const main = el('div', 'row-main')
    const input = el('input', 'name-input')
    input.type = 'text'
    input.spellcheck = false
    input.value = row.kind === 'project' || row.kind === 'tutorial' ? row.name : ''
    input.placeholder = row.depth === 0 ? 'Project name' : 'Tutorial name'
    input.setAttribute('aria-label', input.placeholder)
    input.addEventListener('input', () => handlers.draftChanged(input.value))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handlers.commit()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        handlers.cancel()
      }
    })
    input.addEventListener('blur', () => handlers.blur())
    main.append(el('span', 'chevron'), el('span', 'icon-folder'), input)
    item.append(main, el('p', 'row-error'))
    return input
  }

  function update(item: HTMLLIElement, row: SidebarRow): void {
    item.className = `row ${row.kind === 'project' || row.kind === 'new-project' ? 'project' : 'tutorial'}`
    item.classList.toggle('expanded', row.expanded === true)
    item.classList.toggle('selected', row.selected === true)
    item.classList.toggle('editing', row.editing !== undefined)
    item.setAttribute('role', 'treeitem')
    item.setAttribute('aria-level', String(row.depth + 1))
    if (row.kind === 'project') item.setAttribute('aria-expanded', String(row.expanded === true))
    else item.removeAttribute('aria-expanded')
    item.setAttribute('aria-selected', String(row.selected === true))
    if (row.editing) {
      const error = item.querySelector<HTMLElement>('.row-error')
      if (error) setText(error, row.editing.error)
      item.querySelector('.name-input')?.classList.toggle('invalid', row.editing.error !== null)
    } else {
      $('.name', item).textContent = row.name
      item.title = row.name
    }
  }

  return {
    render(rows, emptyMessage, canCreate) {
      newProject.disabled = !canCreate
      setText(empty, emptyMessage)

      const keys = new Set(rows.map((row) => row.key))
      for (const [key, item] of elements) {
        if (!keys.has(key)) {
          item.remove()
          elements.delete(key)
        }
      }
      current.clear()

      let focus: HTMLInputElement | null = null
      rows.forEach((row, index) => {
        current.set(row.key, row)
        let item = elements.get(row.key)
        if (!item) {
          item = el('li')
          elements.set(row.key, item)
        }
        const mode = row.editing ? 'edit' : 'view'
        if (item.dataset.mode !== mode) {
          if (mode === 'edit') focus = buildEdit(item, row)
          else buildView(item, row.key)
        }
        update(item, row)
        // Only move a row that is out of place, so the row being edited keeps its focus.
        if (list.children[index] !== item) list.insertBefore(item, list.children[index] ?? null)
      })

      if (focus) {
        const input: HTMLInputElement = focus
        input.focus()
        input.select()
      }
    }
  }
}
