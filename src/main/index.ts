import { app, Notification, shell } from 'electron'
import { IPC, type RecorderPhase } from '../shared/ipc'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import macIcon from '../../resources/icon-mac.png?asset'
import { registerIpc } from './ipc'
import { createSettingsService } from './settings'
import { createElectronPermissionService } from './permissionsElectron'
import { createClickListener } from './clickListener'
import { createElectronCapturer, removeFile } from './captureElectron'
import { createRecorder } from './recorder'
import { registerStopShortcut, unregisterShortcuts } from './shortcut'
import { createWindows } from './windows'
import { installMenu } from './menu'
import { confirm } from './confirmElectron'
import { createProjectsService } from './projects'
import { createTutorialRecording } from './tutorialRecording'
import { handleImages, registerImageScheme } from './imageProtocol'

// Must happen before the app is ready.
registerImageScheme()

const debug = process.env['TUTO_DEBUG'] === '1'

app.whenReady().then(async () => {
  // In dev mode the Dock would show Electron's icon; packaged builds use build/icon.icns.
  if (is.dev) app.dock?.setIcon(macIcon)

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.tuto-record.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const windows = createWindows()
  installMenu(windows.openSettings)

  const permissions = createElectronPermissionService()
  if (debug) {
    console.log(`PERMISSIONS ${JSON.stringify(permissions.getStatus())} exe=${process.execPath}`)
  }
  const settings = createSettingsService(join(app.getPath('userData'), 'settings.json'))
  const projects = createProjectsService({
    getRoot: async () => {
      const state = await settings.get()
      if (!state.projectsFolder) throw new Error('No Projects folder is chosen.')
      if (state.projectsFolderProblem) throw new Error(state.projectsFolderProblem)
      return state.projectsFolder
    },
    trash: (path) => shell.trashItem(path)
  })
  handleImages(projects)

  const capturer = createElectronCapturer(settings, projects)
  let previousPhase: RecorderPhase = 'idle'

  const tutorialRecording = createTutorialRecording({
    permissionsGranted: () => permissions.getStatus().allGranted,
    getSettings: () => settings.get(),
    countImages: async (ref) => (await projects.listImages(ref)).length,
    trashAllImages: (ref) => projects.trashAllImages(ref),
    confirm,
    startRecorder: () => recorder.start()
  })

  const recorder = createRecorder({
    checkReady: () => tutorialRecording.checkReady(),
    clicks: createClickListener(),
    hideWindow: () => windows.hideAll(),
    showWindow: () => windows.showMain(),
    setBadge: (text) => app.dock?.setBadge(text),
    capture: async (click) => {
      const files = await capturer(click)
      if (debug) console.log(`CAPTURE ${click.x},${click.y} ${files.join(' ')}`)
      return files
    },
    deleteFiles: async (paths) => {
      await Promise.all(paths.map(removeFile))
    },
    now: () => Date.now(),
    onChange: (status) => {
      windows.sendToMain(IPC.recorderState, status)
      if (status.error && previousPhase === 'recording' && status.phase === 'idle') {
        new Notification({ title: 'tuto-record stopped recording', body: status.error }).show()
      }
      previousPhase = status.phase
    }
  })
  registerIpc({
    permissions,
    settings,
    projects,
    recorder,
    tutorialRecording,
    confirm,
    openSettings: windows.openSettings
  })
  recorder.setShortcutOk(registerStopShortcut(() => recorder.handleShortcut()))

  windows.showMain()

  // Settings opens by itself while something needed for recording is missing.
  const state = await settings.get()
  if (!permissions.getStatus().allGranted || !state.projectsFolder || state.projectsFolderProblem) {
    windows.openSettings()
  }

  // Shows the system prompts one after another, which also adds the app to the Privacy &
  // Security lists. Retries on a timer because the next prompt waits for the previous grant.
  const onboarding = setInterval(() => {
    void permissions.requestNext().then((done) => {
      if (done) clearInterval(onboarding)
    })
  }, 1500)
  app.on('before-quit', () => clearInterval(onboarding))

  // A Dock icon click while recording stops the Recording; otherwise it just shows the window.
  app.on('activate', () => {
    if (recorder.getStatus().phase === 'idle') windows.showMain()
    else void recorder.handleDockActivate()
  })

  app.on('before-quit', () => recorder.dispose())
  app.on('will-quit', unregisterShortcuts)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
