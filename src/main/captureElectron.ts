import { readFile, rm, writeFile } from 'fs/promises'
import { desktopCapturer, screen, type NativeImage } from 'electron'
import watermarkLogo from '../../resources/watermark-logo.png?asset'
import { createCapturer, type ImageLike } from './capture'
import { createOverlays } from './overlays'
import type { ProjectsService } from './projects'
import type { SettingsService } from './settings'
import { createWatermark } from './watermark'

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
  settings: SettingsService,
  projects: ProjectsService
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
    // Resolved for every Capture, so a Tutorial renamed or deleted in Finder mid-Recording
    // fails the next Capture (and stops the Recording) instead of saving somewhere else.
    getFolder: async () => {
      const state = await settings.get()
      if (state.projectsFolderProblem) throw new Error(state.projectsFolderProblem)
      if (!state.selectedTutorial) throw new Error('The selected Tutorial no longer exists.')
      return projects.tutorialPath(state.selectedTutorial)
    },
    // readFile, not a path given to sharp: Node can read inside app.asar, native code cannot.
    drawOverlays: createOverlays({
      watermark: createWatermark({ loadLogo: () => readFile(watermarkLogo) })
    }),
    // No mkdir: the folder was just checked, and re-creating a Tutorial the user deleted would be wrong.
    writeFile: (path, data) => writeFile(path, data),
    removeFile
  })
}
