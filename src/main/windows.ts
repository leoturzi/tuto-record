import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

type Page = 'index' | 'settings'

export interface Windows {
  /** Creates the main window if needed, then shows and focuses it. */
  showMain(): void
  /** Creates the Settings window if needed, then shows and focuses it. There is never more than one. */
  openSettings(): void
  /** Hides every app window (used when a Recording starts, so none appears in a Screenshot). */
  hideAll(): void
  sendToMain(channel: string, payload: unknown): void
}

// In dev mode the titles say so, to tell the windows apart from the installed app.
const title = (name: string): string => (is.dev ? `${name} (Development)` : name)

function createWindow(page: Page, options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    // macOS takes the icon from the app bundle; the other platforms need it on the window.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    ...options,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // The page's own <title> would otherwise replace the dev title once it loads.
  if (is.dev) window.on('page-title-updated', (event) => event.preventDefault())

  window.on('ready-to-show', () => window.show())

  // The UI has no links; never let it open new windows.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // In dev, load from the electron-vite dev server (with HMR); otherwise load the built file.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${page}.html`)
  } else {
    void window.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
  return window
}

const alive = (window: BrowserWindow | null): window is BrowserWindow =>
  window !== null && !window.isDestroyed()

export function createWindows(): Windows {
  let main: BrowserWindow | null = null
  let settings: BrowserWindow | null = null

  function bringUp(window: BrowserWindow): void {
    // A window that is still loading shows itself on `ready-to-show`.
    if (window.webContents.isLoading()) return
    window.show()
    window.focus()
  }

  return {
    showMain() {
      if (alive(main)) return bringUp(main)
      const window = createWindow('index', {
        width: 1000,
        height: 680,
        minWidth: 760,
        minHeight: 520,
        title: title('Tuto-Record')
      })
      window.on('closed', () => {
        if (main === window) main = null
      })
      main = window
    },

    openSettings() {
      if (alive(settings)) return bringUp(settings)
      const window = createWindow('settings', {
        width: 520,
        height: 640,
        resizable: false,
        fullscreenable: false,
        title: title('Settings')
      })
      window.on('closed', () => {
        if (settings === window) settings = null
      })
      settings = window
    },

    hideAll() {
      for (const window of [main, settings]) if (alive(window)) window.hide()
    },

    sendToMain(channel, payload) {
      if (alive(main)) main.webContents.send(channel, payload)
    }
  }
}
