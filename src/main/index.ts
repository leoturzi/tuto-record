import { app, BrowserWindow, Notification } from 'electron'
import { IPC, type RecorderPhase } from '../shared/ipc'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { createSettingsService } from './settings'
import { createElectronPermissionService } from './permissionsElectron'
import { createClickListener } from './clickListener'
import { createElectronCapturer, removeFile } from './captureElectron'
import { createRecorder } from './recorder'
import { registerToggleShortcut, unregisterShortcuts } from './shortcut'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 560,
    height: 860,
    title: 'tuto-record',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  // The UI has no links; never let it open new windows.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function sendToWindow(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.tuto-record.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const permissions = createElectronPermissionService()
  const settings = createSettingsService(join(app.getPath('userData'), 'settings.json'))

  const capturer = createElectronCapturer(settings)
  let previousPhase: RecorderPhase = 'idle'

  const recorder = createRecorder({
    checkReady: async () => {
      if (!permissions.getStatus().allGranted) return 'Grant both permissions first.'
      const state = await settings.get()
      if (!state.outputFolder) return 'Choose an output folder first.'
      return state.outputFolderProblem
    },
    clicks: createClickListener(),
    hideWindow: () => mainWindow?.hide(),
    showWindow: showMainWindow,
    setBadge: (text) => app.dock?.setBadge(text),
    capture: async (click) => {
      const files = await capturer(click)
      if (process.env['TUTO_DEBUG'] === '1')
        console.log(`CAPTURE ${click.x},${click.y} ${files.join(' ')}`)
      return files
    },
    deleteFiles: async (paths) => {
      await Promise.all(paths.map(removeFile))
    },
    now: () => Date.now(),
    onChange: (status) => {
      sendToWindow(IPC.recorderState, status)
      if (status.error && previousPhase === 'recording' && status.phase === 'idle') {
        new Notification({ title: 'tuto-record stopped recording', body: status.error }).show()
      }
      previousPhase = status.phase
    }
  })
  registerIpc(permissions, settings, recorder)
  recorder.setShortcutOk(registerToggleShortcut(() => void recorder.toggle()))

  createWindow()

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
    if (recorder.getStatus().phase === 'idle') showMainWindow()
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
