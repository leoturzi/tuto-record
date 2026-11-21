import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {},
  preload: {},
  // Two pages: the main window and the Settings window. Each is its own entry.
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        }
      }
    }
  }
})
