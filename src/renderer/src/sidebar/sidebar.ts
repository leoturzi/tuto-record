import type { ItemPath } from '../../../shared/paths'
import { $, el, setText } from '../ui/dom'
import { canDrop, type SidebarRow } from './treeView'

export interface SidebarHandlers {
  select(tutorial: ItemPath): void
  toggle(path: ItemPath): void
  /** Expand a collapsed Project or Group (used while dragging over it). */
  expand(path: ItemPath): void
  newProject(): void
  /** The + on a Project or Group row was pressed; `at` is where its menu should open. */
  add(row: SidebarRow, at: { x: number; y: number }): void
  /** The ⋯ button was pressed; `at` is where the menu should open, in window coordinates. */
  rowMenu(row: SidebarRow, at: { x: number; y: number }): void
  draftChanged(value: string): void
  commit(): void
  cancel(): void
  /** The name field lost focus (commit a valid change, otherwise cancel). */
  blur(): void
  /** A Tutorial or Group was dropped onto a Project or Group. */
  move(path: ItemPath, destination: ItemPath): void
  openSettings(): void
}

export interface Sidebar {
  /**
   * `canCreate` is false while there is no usable Projects folder; `canDrag` is false while
   * something else is going on (a name is being edited, a Recording runs).
   */
  render(
    rows: SidebarRow[],
    emptyMessage: string | null,
    canCreate: boolean,
    canDrag: boolean
  ): void
}

/** The drag data type. Only drags the sidebar started carry it, so drops from Finder are ignored. */
const DRAG_TYPE = 'application/x-tuto-item'
/** How long the pointer rests on a collapsed Project or Group, while dragging, before it opens. */
const HOVER_EXPAND_MS = 600

const point = (button: HTMLElement): { x: number; y: number } => {
  const box = button.getBoundingClientRect()
  return { x: box.left, y: box.bottom + 2 }
}

/**
 * The sidebar: the tree of Projects, Groups and Tutorials, the + and ⋯ buttons, the inline name
 * fields, drag and drop, and the Settings button. Rows are reused by key between renders, and a row
 * being edited is never rebuilt, so the 1.5 s poll never takes away what the user is typing.
 */
export function createSidebar(root: HTMLElement, handlers: SidebarHandlers): Sidebar {
  const list = $('#tree', root)
  const empty = $('#sidebar-empty', root)
  const newProject = $<HTMLButtonElement>('#new-project', root)
  const elements = new Map<string, HTMLLIElement>()
  const current = new Map<string, SidebarRow>()

  let dragging: string | null = null
  let dropTarget: string | null = null
  let hoverTimer: ReturnType<typeof setTimeout> | null = null

  newProject.addEventListener('click', () => handlers.newProject())
  $('#open-settings', root).addEventListener('click', () => handlers.openSettings())

  function clearDropTarget(): void {
    if (hoverTimer) clearTimeout(hoverTimer)
    hoverTimer = null
    if (dropTarget) elements.get(dropTarget)?.classList.remove('drop-target')
    dropTarget = null
  }

  function endDrag(): void {
    clearDropTarget()
    if (dragging) elements.get(dragging)?.classList.remove('dragging')
    dragging = null
  }

  function wireDrag(item: HTMLLIElement, key: string): void {
    item.addEventListener('dragstart', (event) => {
      const row = current.get(key)
      if (!row || !event.dataTransfer || !item.draggable) return
      dragging = key
      event.dataTransfer.setData(DRAG_TYPE, key)
      event.dataTransfer.effectAllowed = 'move'
      item.classList.add('dragging')
    })
    item.addEventListener('dragend', endDrag)

    item.addEventListener('dragover', (event) => {
      if (!dragging || !event.dataTransfer?.types.includes(DRAG_TYPE)) return
      const source = current.get(dragging)
      const target = current.get(key)
      if (!source || !target || !canDrop(source, target)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (dropTarget === key) return
      clearDropTarget()
      dropTarget = key
      item.classList.add('drop-target')
      if (!target.expanded) {
        hoverTimer = setTimeout(() => handlers.expand(target.path), HOVER_EXPAND_MS)
      }
    })
    item.addEventListener('dragleave', (event) => {
      // Moving onto one of the row's own children is not leaving it.
      if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) return
      if (dropTarget === key) clearDropTarget()
    })
    item.addEventListener('drop', (event) => {
      if (!dragging || !event.dataTransfer?.types.includes(DRAG_TYPE)) return
      event.preventDefault()
      const source = current.get(dragging)
      const target = current.get(key)
      endDrag()
      if (source && target && canDrop(source, target)) handlers.move(source.path, target.path)
    })
  }

  function buildView(item: HTMLLIElement, key: string): void {
    item.dataset.mode = 'view'
    item.replaceChildren()
    const main = el('div', 'row-main')
    main.append(el('span', 'chevron'), el('span', 'icon'), el('span', 'name'))
    main.addEventListener('click', () => {
      const row = current.get(key)
      if (!row) return
      if (row.kind === 'tutorial') handlers.select(row.path)
      else handlers.toggle(row.path)
    })

    const actions = el('div', 'row-actions')
    const add = el('button', 'row-button add', '+')
    add.type = 'button'
    add.title = 'New Tutorial or Group'
    add.setAttribute('aria-label', 'New Tutorial or Group')
    add.addEventListener('click', (event) => {
      event.stopPropagation()
      const row = current.get(key)
      if (row) handlers.add(row, point(add))
    })
    const more = el('button', 'row-button more', '⋯')
    more.type = 'button'
    more.title = 'More'
    more.setAttribute('aria-label', 'More actions')
    more.addEventListener('click', (event) => {
      event.stopPropagation()
      const row = current.get(key)
      if (row) handlers.rowMenu(row, point(more))
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
    input.value = row.kind === 'new' ? '' : row.name
    const what = row.kind === 'new' ? row.creating : row.kind
    input.placeholder =
      what === 'project' ? 'Project name' : what === 'group' ? 'Group name' : 'Tutorial name'
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
    main.append(el('span', 'chevron'), el('span', 'icon'), input)
    item.append(main, el('p', 'row-error'))
    return input
  }

  function update(item: HTMLLIElement, row: SidebarRow, canDrag: boolean): void {
    // What the row looks like: a 'new' row looks like the thing being created.
    const look = row.kind === 'new' ? row.creating : row.kind
    item.className = `row ${look}`
    item.classList.toggle('expanded', row.expanded === true)
    item.classList.toggle('selected', row.selected === true)
    item.classList.toggle('editing', row.editing !== undefined)
    item.classList.toggle('drop-target', dropTarget === row.key)
    item.classList.toggle('dragging', dragging === row.key)
    // The CSSOM is allowed by the CSP (`style-src 'self'`); a `style` attribute in markup is not.
    item.style.setProperty('--depth', String(row.depth))
    item.draggable = canDrag && (row.kind === 'tutorial' || row.kind === 'group') && !row.editing
    item.setAttribute('role', 'treeitem')
    item.setAttribute('aria-level', String(row.depth + 1))
    if (row.kind === 'project' || row.kind === 'group') {
      item.setAttribute('aria-expanded', String(row.expanded === true))
    } else item.removeAttribute('aria-expanded')
    item.setAttribute('aria-selected', String(row.selected === true))
    const icon = item.querySelector<HTMLElement>('.icon')
    if (icon) icon.className = `icon icon-${look === 'group' ? 'group' : 'folder'}`
    if (row.editing) {
      const error = item.querySelector<HTMLElement>('.row-error')
      if (error) setText(error, row.editing.error)
      item.querySelector('.name-input')?.classList.toggle('invalid', row.editing.error !== null)
    } else {
      $('.name', item).textContent = row.name
      item.title = row.path.join(' › ')
    }
  }

  return {
    render(rows, emptyMessage, canCreate, canDrag) {
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
          wireDrag(item, row.key)
          elements.set(row.key, item)
        }
        const mode = row.editing ? 'edit' : 'view'
        if (item.dataset.mode !== mode) {
          if (mode === 'edit') focus = buildEdit(item, row)
          else buildView(item, row.key)
        }
        update(item, row, canDrag)
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
