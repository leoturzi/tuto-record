import { buildPermissionView } from './permissionView'
import { buildRecorderView } from './recorderView'
import { buildStatus } from './status'
import type { PermissionKind, RecorderStatus, SettingsState } from '../../shared/ipc'

const POLL_MS = 1500

function $(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`Missing element: ${selector}`)
  return el
}

const panel = $('#permissions')
const status = $('#status')
const folderPath = $('#folder-path')
const folderProblem = $('#folder-problem')
const openFolder = $('#open-folder')
const relaunchBox = $('#relaunch-box')
const relaunchHint = $('#relaunch-hint')

const recordButton = $('#record') as HTMLButtonElement
const recorderSummary = $('#recorder-summary')
const recorderError = $('#recorder-error')
const shortcutWarning = $('#shortcut-warning')

let screenWasMissing = false
let ready = false
let recorderStatus: RecorderStatus = { phase: 'idle', count: 0, error: null, shortcutOk: true }
let recordAction: 'start' | 'stop' = 'start'

function renderRecorder(): void {
  const view = buildRecorderView(recorderStatus, ready)
  recordButton.textContent = view.buttonLabel
  recordButton.disabled = !view.buttonEnabled
  recordAction = view.action
  recorderSummary.hidden = view.summary === null
  recorderSummary.textContent = view.summary ?? ''
  recorderError.hidden = view.error === null
  recorderError.textContent = view.error ?? ''
  shortcutWarning.hidden = view.shortcutWarning === null
  shortcutWarning.textContent = view.shortcutWarning ?? ''
}

function renderPerm(kind: PermissionKind, state: { granted: boolean; label: string }): void {
  const row = $(`.perm[data-kind="${kind}"]`)
  const badge = row.querySelector<HTMLElement>('[data-role="badge"]')!
  badge.textContent = state.granted ? `✓ ${state.label}` : state.label
  badge.className = `badge ${state.granted ? 'ok' : 'missing'}`
  row.querySelector<HTMLElement>('[data-role="open"]')!.hidden = state.granted
}

function renderSettings(settings: SettingsState): void {
  folderPath.textContent = settings.outputFolder ?? 'No folder chosen yet'
  folderPath.classList.toggle('empty', settings.outputFolder === null)
  openFolder.hidden = settings.outputFolder === null
  folderProblem.hidden = settings.outputFolderProblem === null
  folderProblem.textContent = settings.outputFolderProblem ?? ''
}

async function refresh(): Promise<void> {
  const [permissions, settings] = await Promise.all([
    window.api.getPermissions(),
    window.api.getSettings()
  ])
  if (permissions.required && permissions.screen !== 'granted') screenWasMissing = true

  const view = buildPermissionView(permissions, screenWasMissing)
  // Keep the panel up once Screen Recording was just granted, so the relaunch hint stays visible.
  panel.hidden = !(view.showPanel || view.relaunchHint !== null)
  renderSettings(settings)
  const statusView = buildStatus(view.showReady, settings)
  status.hidden = statusView.text === null
  status.textContent = statusView.text ?? ''
  status.classList.toggle('ready', statusView.ready)
  ready = statusView.ready
  renderRecorder()
  renderPerm('accessibility', view.accessibility)
  renderPerm('screen', view.screen)
  relaunchBox.hidden = view.relaunchHint === null
  relaunchHint.textContent = view.relaunchHint ?? ''
}

for (const kind of ['accessibility', 'screen'] as const) {
  $(`.perm[data-kind="${kind}"] [data-role="open"]`).addEventListener('click', () => {
    void window.api.openPermissionSettings(kind)
  })
}
recordButton.addEventListener('click', () => {
  void (recordAction === 'start' ? window.api.startRecording() : window.api.stopRecording())
})
window.api.onRecorderStatus((next) => {
  recorderStatus = next
  renderRecorder()
})
void window.api.getRecorderStatus().then((initial) => {
  recorderStatus = initial
  renderRecorder()
})

$('#choose-folder').addEventListener('click', () => {
  void window.api.chooseOutputFolder().then(renderSettings)
})
openFolder.addEventListener('click', () => {
  void window.api.openOutputFolder()
})
$('#relaunch').addEventListener('click', () => {
  void window.api.relaunch()
})

void refresh()
setInterval(() => void refresh(), POLL_MS)
