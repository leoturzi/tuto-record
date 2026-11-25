import { describe, expect, it, vi } from 'vitest'
import { createCapturer, type CaptureDeps, type ImageLike } from '../src/main/capture'
import { formatStamp, type DisplayGeometry } from '../src/main/naming'

function image(width: number, height: number, empty = false): ImageLike & { resized?: boolean } {
  const img: ImageLike & { resized?: boolean } = {
    width,
    height,
    isEmpty: () => empty,
    toPNG: () => Buffer.from(`png:${img.width}x${img.height}`),
    resize: (w, h) => {
      const next = image(w, h)
      next.resized = true
      return next
    }
  }
  return img
}

const display = (id: number, x: number, w = 1440, h = 900, scale = 2): DisplayGeometry => ({
  id,
  bounds: { x, y: 0, width: w, height: h },
  scaleFactor: scale
})

const click = { x: 5, y: 5, time: new Date(2026, 10, 21, 9, 15, 42, 123).getTime() }
const stamp = formatStamp(click.time)

function setup(overrides: Partial<CaptureDeps> = {}): {
  deps: CaptureDeps
  written: Map<string, string>
} {
  const written = new Map<string, string>()
  const deps: CaptureDeps = {
    getDisplays: () => [display(10, 0)],
    getPrimaryDisplayId: () => 10,
    grab: vi.fn(async () => [{ displayId: '10', image: image(2880, 1800) }]),
    getFolder: async () => '/out',
    drawOverlays: vi.fn(async (png: Buffer, _size: unknown, marker: unknown) =>
      Buffer.from(`${png.toString()}+watermark${marker ? '+marker' : ''}`)
    ),
    writeFile: vi.fn(async (path: string, data: Buffer) => {
      written.set(path, data.toString())
    }),
    removeFile: vi.fn(async (path: string) => {
      written.delete(path)
    }),
    ...overrides
  }
  return { deps, written }
}

describe('createCapturer', () => {
  it('saves one PNG for a single display', async () => {
    const { deps, written } = setup()
    const files = await createCapturer(deps)(click)
    expect(files).toEqual([`/out/${stamp}_d1.png`])
    expect(written.get(`/out/${stamp}_d1.png`)).toBe('png:2880x1800+watermark+marker')
  })

  it('saves one PNG per display, named by display number', async () => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440, 1920, 1080, 1)],
      grab: vi.fn(async () => [
        { displayId: '20', image: image(1920, 1080) },
        { displayId: '10', image: image(2880, 1800) }
      ])
    })
    const files = await createCapturer(deps)(click)
    expect(files).toEqual([`/out/${stamp}_d1.png`, `/out/${stamp}_d2.png`])
    // The click at (5, 5) is on the first display, so only its Screenshot has a Marker;
    // every Screenshot has the Watermark.
    expect(written.get(`/out/${stamp}_d1.png`)).toBe('png:2880x1800+watermark+marker')
    expect(written.get(`/out/${stamp}_d2.png`)).toBe('png:1920x1080+watermark')
  })

  it('draws the Marker on the display that was clicked, with the right position', async () => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440, 1920, 1080, 1)],
      grab: vi.fn(async () => [
        { displayId: '10', image: image(2880, 1800) },
        { displayId: '20', image: image(1920, 1080) }
      ])
    })
    await createCapturer(deps)({ ...click, x: 1540, y: 300 })
    expect(deps.drawOverlays).toHaveBeenCalledTimes(2)
    expect(deps.drawOverlays).toHaveBeenCalledWith(
      expect.anything(),
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080, scale: 1, cx: 100, cy: 300, radius: 24 }
    )
    expect(deps.drawOverlays).toHaveBeenCalledWith(
      expect.anything(),
      { width: 2880, height: 1800 },
      null
    )
    expect(written.get(`/out/${stamp}_d2.png`)).toBe('png:1920x1080+watermark+marker')
    expect(written.get(`/out/${stamp}_d1.png`)).toBe('png:2880x1800+watermark')
  })

  it.each([
    ['the clicked display', true],
    ['another display', false]
  ])('fails the Capture and removes its files when drawing on %s fails', async (_, onClicked) => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440)],
      grab: vi.fn(async () => [
        { displayId: '10', image: image(2880, 1800) },
        { displayId: '20', image: image(2880, 1800) }
      ]),
      drawOverlays: vi.fn(async (png, _size, marker) => {
        if (Boolean(marker) === onClicked) throw new Error('drawing failed')
        return png
      })
    })
    await expect(createCapturer(deps)(click)).rejects.toThrow(/drawing failed/)
    expect(written.size).toBe(0)
  })

  it('asks for a thumbnail big enough for the largest display', async () => {
    const { deps } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440, 1920, 1080, 1)],
      grab: vi.fn(async () => [
        { displayId: '10', image: image(2880, 1800) },
        { displayId: '20', image: image(1920, 1080) }
      ])
    })
    await createCapturer(deps)(click)
    expect(deps.grab).toHaveBeenCalledWith({ width: 2880, height: 1800 })
  })

  it('resizes a thumbnail that is not the display’s real pixel size', async () => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440, 1920, 1080, 1)],
      grab: vi.fn(async () => [
        { displayId: '10', image: image(2880, 1800) },
        { displayId: '20', image: image(2880, 1620) } // upscaled to fit the larger box
      ])
    })
    await createCapturer(deps)(click)
    expect(written.get(`/out/${stamp}_d2.png`)).toBe('png:1920x1080+watermark')
    // The Watermark is sized from the resized image, not the thumbnail.
    expect(deps.drawOverlays).toHaveBeenCalledWith(
      expect.anything(),
      { width: 1920, height: 1080 },
      null
    )
  })

  it('fails and removes the files of this Capture when one display is missing', async () => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440)],
      grab: vi.fn(async () => [{ displayId: '10', image: image(2880, 1800) }])
    })
    await expect(createCapturer(deps)(click)).rejects.toThrow(/display 2/)
    expect(written.size).toBe(0)
  })

  it('fails with a permission hint when a screenshot comes back empty', async () => {
    const { deps } = setup({
      grab: vi.fn(async () => [{ displayId: '10', image: image(0, 0, true) }])
    })
    await expect(createCapturer(deps)(click)).rejects.toThrow(/Screen Recording/)
  })

  it('fails when the Tutorial folder cannot be used, without capturing', async () => {
    const { deps } = setup({
      getFolder: async () => {
        throw new Error('The folder no longer exists.')
      }
    })
    await expect(createCapturer(deps)(click)).rejects.toThrow(/no longer exists/)
    expect(deps.grab).not.toHaveBeenCalled()
  })

  it('removes files already written when a later write fails', async () => {
    const { deps, written } = setup({
      getDisplays: () => [display(10, 0), display(20, 1440)],
      grab: vi.fn(async () => [
        { displayId: '10', image: image(2880, 1800) },
        { displayId: '20', image: image(2880, 1800) }
      ])
    })
    const original = vi.mocked(deps.writeFile).getMockImplementation()!
    vi.mocked(deps.writeFile).mockImplementation(async (path, data) => {
      if (path.endsWith('_d2.png')) throw new Error('Disk full')
      await original(path, data)
    })
    await expect(createCapturer(deps)(click)).rejects.toThrow(/Disk full/)
    expect(written.size).toBe(0)
  })
})
