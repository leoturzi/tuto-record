import { describe, expect, it } from 'vitest'
import {
  buildPreview,
  headingVariants,
  moveSelection,
  sameImages,
  selectionAfterRemoval
} from '../src/renderer/src/tutorial-preview/previewView'
import type { ImageItem, SettingsState } from '../src/shared/ipc'

const item = (file: string, version = 1): ImageItem => ({
  file,
  thumbUrl: `tuto-image://thumb/P/T/${file}?v=${version}`,
  previewUrl: `tuto-image://preview/P/T/${file}?v=${version}`
})
const images = ['a.png', 'b.png', 'c.png'].map((f) => item(f))

const settings: SettingsState = {
  projectsFolder: '/p',
  projectsFolderProblem: null,
  selectedTutorial: ['Python', 'How to install Python'],
  expanded: []
}

describe('headingVariants', () => {
  it('shows Project › Tutorial as it is', () => {
    expect(headingVariants(settings.selectedTutorial!)).toEqual(['Python › How to install Python'])
  })

  it('collapses the Groups in the middle one at a time, keeping the Project and the Tutorial', () => {
    expect(headingVariants(['Python', 'Setup', 'macOS', 'Install'])).toEqual([
      'Python › Setup › macOS › Install',
      'Python › … › macOS › Install',
      'Python › … › Install'
    ])
    expect(headingVariants(['Python', 'Setup', 'Install'])).toEqual([
      'Python › Setup › Install',
      'Python › … › Install'
    ])
  })
})

describe('buildPreview', () => {
  it('tells no Tutorial, an empty one and one with images apart', () => {
    expect(buildPreview(null, null).state).toBe('none')
    expect(buildPreview([], null).state).toBe('empty')
    expect(buildPreview(images, null)).toEqual({
      state: 'images',
      selectedIndex: 0,
      large: images[0]
    })
  })

  it('shows the selected image, or the first when it is gone', () => {
    expect(buildPreview(images, 'b.png').selectedIndex).toBe(1)
    expect(buildPreview(images, 'missing.png').selectedIndex).toBe(0)
  })
})

describe('moveSelection', () => {
  it('moves left and right and stops at both ends', () => {
    expect(moveSelection(images, 'a.png', 'right')).toBe('b.png')
    expect(moveSelection(images, 'b.png', 'left')).toBe('a.png')
    expect(moveSelection(images, 'a.png', 'left')).toBe('a.png')
    expect(moveSelection(images, 'c.png', 'right')).toBe('c.png')
    expect(moveSelection(images, null, 'right')).toBe('b.png')
    expect(moveSelection([], null, 'right')).toBeNull()
  })
})

describe('selectionAfterRemoval', () => {
  it('selects the next image, the previous one at the end, or nothing', () => {
    expect(selectionAfterRemoval(images, 'b.png')).toBe('c.png')
    expect(selectionAfterRemoval(images, 'c.png')).toBe('b.png')
    expect(selectionAfterRemoval([item('a.png')], 'a.png')).toBeNull()
  })
})

describe('sameImages', () => {
  it('compares files and versions', () => {
    expect(
      sameImages(
        images,
        images.map((i) => ({ ...i }))
      )
    ).toBe(true)
    expect(sameImages(images, [item('a.png', 2), images[1], images[2]])).toBe(false)
    expect(sameImages(images, images.slice(1))).toBe(false)
    expect(sameImages(null, null)).toBe(true)
    expect(sameImages(null, [])).toBe(false)
  })
})
