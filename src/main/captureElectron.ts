import { mkdir, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { desktopCapturer, screen, type NativeImage } from 'electron'
import { createCapturer, type ImageLike } from './capture'
import { drawMarker } from './marker'
import type { SettingsService } from './settings'

function wrap(image: NativeImage): ImageLike {
  const { width, height } = image.getSize()
  return {
    width,
    height,
    isEmpty: () => image.isEmpty(),
    toPNG: () => image.toPNG(),
    resize: (w, h) => wrap(image.resize({ width: w, height: h, quality: 'best' }))
  }
}

export const removeFile = (path: string): Promise<void> => rm(path, { force: true })

export function createElectronCapturer(
  settings: SettingsService
): ReturnType<typeof createCapturer> {
  return createCapturer({
    getDisplays: () =>
      screen
        .getAllDisplays()
        .map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })),
    getPrimaryDisplayId: () => screen.getPrimaryDisplay().id,
    grab: async (maxSize) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: maxSize
      })
      return sources.map((s) => ({ displayId: s.display_id, image: wrap(s.thumbnail) }))
    },
    getOutputFolder: async () => {
      const state = await settings.get()
      if (!state.outputFolder) throw new Error('No output folder is chosen.')
      if (state.outputFolderProblem) throw new Error(state.outputFolderProblem)
      return state.outputFolder
    },
    drawMarker,
    writeFile: async (path, data) => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, data)
    },
    removeFile
  })
}
