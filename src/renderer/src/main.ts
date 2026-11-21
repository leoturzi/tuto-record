// Entry point of the main window (index.html): holds the state, polls main, and wires the modules.
import type {
  ImageItem,
  PermissionsStatus,
  ProjectNode,
  RecorderStatus,
  SettingsState
} from '../../shared/ipc'
import { validateName } from '../../shared/names'
import { pathKey, type ItemPath } from '../../shared/paths'
import { createRecorderBar } from './recorder-bar/recorderBar'
import { buildRecorderView, type TutorialState } from './recorder-bar/recorderView'
import { buildStatus } from './recorder-bar/status'
import { createSidebar } from './sidebar/sidebar'
import {
  buildSidebarRows,
  editingSiblings,
  sidebarEmptyMessage,
  type Draft,
  type Editing
} from './sidebar/treeView'
import { createPreview } from './tutorial-preview/preview'
import {
  buildPreview,
  headingVariants,
  moveSelection,
  selectionAfterRemoval
} from './tutorial-preview/previewView'
import { $, errorMessage, isTextField, setText } from './ui/dom'

const POLL_MS = 1500

interface State {
  permissions: PermissionsStatus | null
  settings: SettingsState | null
  tree: ProjectNode[]
  /** The selected Tutorial's images; null when none is selected or they could not be read. */
  images: ImageItem[] | null
  selectedFile: string | null
  recorder: RecorderStatus
  editing: Editing
  draft: Draft
  /** The last failed action, shown in the status line until the next action. */
  problem: string | null
}

const state: State = {
  permissions: null,
  settings: null,
  tree: [],
  images: null,
  selectedFile: null,
  recorder: { phase: 'idle', count: 0, error: null, shortcutOk: true },
  editing: null,
  draft: { value: '', error: null },
  problem: null
}

const headingEl = $('#heading')
const notice = $('#notice')
const noticeText = $('#notice-text')
const placeholder = $('#placeholder')
const emptyState = $('#empty-state')
const previewEl = $('#preview')
const status = $('#status')
const problem = $('#problem')

const selectedRef = (): ItemPath | null => state.settings?.selectedTutorial ?? null

function tutorialState(): TutorialState {
  if (!selectedRef() || state.images === null) return 'none'
  return state.images.length > 0 ? 'has-images' : 'empty'
}

/** Runs an action and shows its failure in the status line. */
async function attempt(action: () => Promise<unknown>): Promise<void> {
  state.problem = null
  try {
    await action()
  } catch (err) {
    state.problem = errorMessage(err)
  }
  await refresh()
}

// Sidebar

function startEditing(editing: Exclude<Editing, null>, value: string): void {
  state.problem = null
  state.editing = editing
  state.draft = { value, error: null }
  render()
}

function stopEditing(): void {
  state.editing = null
  state.draft = { value: '', error: null }
}

let committing = false

async function commit(): Promise<void> {
  const editing = state.editing
  if (!editing || committing) return
  const { siblings, current } = editingSiblings(state.tree, editing)
  const error = validateName(state.draft.value, siblings, current)
  if (error) {
    state.draft = { ...state.draft, error }
    render()
    return
  }
  const name = state.draft.value.trim()
  committing = true
  try {
    const result =
      editing.kind === 'rename'
        ? await window.api.renameItem(editing.path, name)
        : editing.what === 'project'
          ? await window.api.createProject(name)
          : await window.api.createItem(editing.parent, editing.what, name)
    if (result.error) {
      state.draft = { ...state.draft, error: result.error }
      render()
      return
    }
    stopEditing()
    if (editing.kind === 'new' && editing.what === 'tutorial') {
      state.settings = await window.api.selectTutorial([...editing.parent, name])
      state.selectedFile = null
    } else if (editing.kind === 'new' && editing.what === 'group') {
      setExpanded([...editing.parent, name], true)
    }
    await refresh()
  } catch (err) {
    stopEditing()
    state.problem = errorMessage(err)
    await refresh()
  } finally {
    committing = false
  }
}

const isExpanded = (path: ItemPath): boolean =>
  state.settings?.expanded.includes(pathKey(path)) ?? false

function setExpanded(path: ItemPath, expanded: boolean): void {
  if (!state.settings || isExpanded(path) === expanded) return
  const key = pathKey(path)
  const others = state.settings.expanded.filter((k) => k !== key)
  const next = expanded ? [...others, key] : others
  state.settings = { ...state.settings, expanded: next }
  render()
  void window.api.setExpanded(next)
}

const sidebar = createSidebar($('#sidebar'), {
  select(path) {
    if (state.recorder.phase !== 'idle') return
    void attempt(async () => {
      state.settings = await window.api.selectTutorial(path)
      state.selectedFile = null
      state.images = null
    })
  },
  toggle(path) {
    setExpanded(path, !isExpanded(path))
  },
  expand(path) {
    setExpanded(path, true)
  },
  newProject() {
    startEditing({ kind: 'new', parent: [], what: 'project' }, '')
  },
  add(row, at) {
    void window.api.showCreateActions(at).then((what) => {
      if (!what) return
      // Expand for good, so the new item stays visible once it is created.
      setExpanded(row.path, true)
      startEditing({ kind: 'new', parent: row.path, what }, '')
    })
  },
  rowMenu(row, at) {
    void window.api.showRowActions(at).then((choice) => {
      if (choice === 'rename') startEditing({ kind: 'rename', path: row.path }, row.name)
      else if (choice === 'trash') void attempt(() => window.api.trashItem(row.path))
    })
  },
  move(path, destination) {
    void attempt(async () => {
      const result = await window.api.moveItem(path, destination)
      if (result.error) throw new Error(result.error)
      setExpanded(destination, true)
    })
  },
  draftChanged(value) {
    if (!state.editing) return
    const { siblings, current } = editingSiblings(state.tree, state.editing)
    // An empty field is not an error until the user tries to commit it.
    const error = value.trim() === '' ? null : validateName(value, siblings, current)
    state.draft = { value, error }
    render()
  },
  commit() {
    void commit()
  },
  cancel() {
    stopEditing()
    render()
  },
  blur() {
    if (!state.editing || committing) return
    const { siblings, current } = editingSiblings(state.tree, state.editing)
    const value = state.draft.value.trim()
    const changed = value !== '' && value !== current
    if (changed && validateName(value, siblings, current) === null) void commit()
    else {
      stopEditing()
      render()
    }
  },
  openSettings() {
    void window.api.openSettings()
  }
})

// Preview

const preview = createPreview(previewEl, {
  select(file) {
    state.selectedFile = file
    render()
  },
  trash(file) {
    void trashImage(file)
  }
})

async function trashImage(file: string): Promise<void> {
  const ref = selectedRef()
  if (!ref || !state.images) return
  const images = state.images
  await attempt(async () => {
    if (await window.api.trashImage(ref, file)) {
      state.selectedFile = selectionAfterRemoval(images, file)
    }
  })
}

document.addEventListener('keydown', (event) => {
  if (isTextField(event.target) || state.recorder.phase !== 'idle' || !state.images) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    state.selectedFile = moveSelection(
      state.images,
      state.selectedFile,
      event.key === 'ArrowLeft' ? 'left' : 'right'
    )
    render()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    const { large } = buildPreview(state.images, state.selectedFile)
    if (large) {
      event.preventDefault()
      void trashImage(large.file)
    }
  }
})

// Recorder

const recorderBar = createRecorderBar({
  act(action) {
    void attempt(() =>
      action === 'start'
        ? window.api.startRecording()
        : action === 'record-again'
          ? window.api.recordAgain()
          : window.api.stopRecording()
    )
  },
  openInFinder() {
    const ref = selectedRef()
    if (ref) void attempt(() => window.api.openTutorialInFinder(ref))
  }
})

window.api.onRecorderStatus((next) => {
  const finished = state.recorder.phase !== 'idle' && next.phase === 'idle'
  state.recorder = next
  if (finished) {
    // Show the new Screenshots right away, starting from the first one.
    state.selectedFile = null
    void refresh()
  } else render()
})
void window.api.getRecorderStatus().then((initial) => {
  state.recorder = initial
  render()
})

$('#notice-settings').addEventListener('click', () => {
  void window.api.openSettings()
})

// Rendering and polling

function render(): void {
  const settings = state.settings
  const permissionsGranted = state.permissions?.allGranted ?? false
  const hasFolder = settings?.projectsFolder != null && settings.projectsFolderProblem === null

  const rows = buildSidebarRows(
    state.tree,
    settings?.expanded ?? [],
    selectedRef(),
    state.editing,
    state.draft
  )
  const canDrag = state.editing === null && state.recorder.phase === 'idle'
  sidebar.render(rows, sidebarEmptyMessage(hasFolder, rows.length), hasFolder, canDrag)

  if (!settings) return
  const tutorial = tutorialState()
  const statusView = buildStatus(permissionsGranted, settings, tutorial, state.images?.length ?? 0)
  const view = buildPreview(tutorial === 'none' ? null : state.images, state.selectedFile)

  notice.hidden = !statusView.needsSettings
  noticeText.textContent = statusView.text
  placeholder.hidden = statusView.needsSettings || view.state !== 'none'
  emptyState.hidden = statusView.needsSettings || view.state !== 'empty'
  previewEl.hidden = statusView.needsSettings || view.state !== 'images'
  if (view.state === 'images' && state.images) preview.render(state.images, view)

  status.textContent = statusView.text
  status.classList.toggle('ready', statusView.ready && tutorial === 'empty')
  setText(problem, state.problem)

  recorderBar.render(
    buildRecorderView(state.recorder, statusView.ready, tutorial),
    selectedRef() !== null
  )
  // Last, so the header buttons are in place when the heading measures the space it has.
  showHeading(selectedRef())
}

/** The longest form of the Tutorial's path that fits the header; the full path is the tooltip. */
function showHeading(path: ItemPath | null): void {
  if (!path) {
    setText(headingEl, 'tuto-record')
    headingEl.title = ''
    return
  }
  const variants = headingVariants(path)
  headingEl.hidden = false
  headingEl.title = variants[0]
  for (const text of variants) {
    headingEl.textContent = text
    if (headingEl.scrollWidth <= headingEl.clientWidth) break
  }
}

window.addEventListener('resize', () => showHeading(selectedRef()))

let refreshing: Promise<void> | null = null
let refreshAgain = false

async function load(): Promise<void> {
  const [permissions, settings, tree] = await Promise.all([
    window.api.getPermissions(),
    window.api.getSettings(),
    window.api.listProjects().catch(() => [] as ProjectNode[])
  ])
  const ref = settings.selectedTutorial
  const images = ref ? await window.api.listImages(ref).catch(() => null) : null
  Object.assign(state, { permissions, settings, tree, images })
}

/** Reloads everything from main and renders. A call during a reload runs once more after it. */
async function refresh(): Promise<void> {
  if (refreshing) {
    refreshAgain = true
    return refreshing
  }
  refreshing = (async () => {
    do {
      refreshAgain = false
      try {
        await load()
      } catch (err) {
        state.problem = errorMessage(err)
      }
    } while (refreshAgain)
    render()
  })()
  try {
    await refreshing
  } finally {
    refreshing = null
  }
}

void refresh()
setInterval(() => void refresh(), POLL_MS)
