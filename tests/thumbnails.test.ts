import { describe, expect, it, vi } from 'vitest'
import { createThumbnailer } from '../src/main/thumbnails'

function fakeRender(): {
  render: ReturnType<typeof vi.fn<(path: string, width: number) => Promise<Buffer>>>
} {
  return { render: vi.fn(async (path: string, width: number) => Buffer.from(`${path}@${width}`)) }
}

describe('createThumbnailer', () => {
  it('renders each size at its width', async () => {
    const deps = fakeRender()
    const thumb = createThumbnailer(deps)
    expect((await thumb('/a.png', 1, 'thumb')).toString()).toBe('/a.png@320')
    expect((await thumb('/a.png', 1, 'preview')).toString()).toBe('/a.png@1600')
  })

  it('serves a repeated request from the cache', async () => {
    const deps = fakeRender()
    const thumb = createThumbnailer(deps)
    await thumb('/a.png', 1, 'thumb')
    await thumb('/a.png', 1, 'thumb')
    expect(deps.render).toHaveBeenCalledTimes(1)
  })

  it('renders a new version again', async () => {
    const deps = fakeRender()
    const thumb = createThumbnailer(deps)
    await thumb('/a.png', 1, 'thumb')
    await thumb('/a.png', 2, 'thumb')
    expect(deps.render).toHaveBeenCalledTimes(2)
  })

  it('drops the least recently used entry beyond the limit', async () => {
    const deps = fakeRender()
    const thumb = createThumbnailer(deps, { maxEntries: 2 })
    await thumb('/a.png', 1, 'thumb')
    await thumb('/b.png', 1, 'thumb')
    await thumb('/a.png', 1, 'thumb') // a is now the most recent
    await thumb('/c.png', 1, 'thumb') // evicts b
    await thumb('/a.png', 1, 'thumb')
    expect(deps.render).toHaveBeenCalledTimes(3)
    await thumb('/b.png', 1, 'thumb')
    expect(deps.render).toHaveBeenCalledTimes(4)
  })

  it('shares a render that is still running', async () => {
    const deps = fakeRender()
    const thumb = createThumbnailer(deps)
    const [one, two] = await Promise.all([thumb('/a.png', 1, 'thumb'), thumb('/a.png', 1, 'thumb')])
    expect(one).toBe(two)
    expect(deps.render).toHaveBeenCalledTimes(1)
  })

  it('runs at most `concurrency` renders at once', async () => {
    let running = 0
    let peak = 0
    const release: Array<() => void> = []
    const render = vi.fn(async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise<void>((resolve) => release.push(resolve))
      running--
      return Buffer.from('x')
    })
    const thumb = createThumbnailer({ render }, { concurrency: 2 })
    const all = Promise.all([1, 2, 3, 4, 5].map((n) => thumb(`/${n}.png`, 1, 'thumb')))
    for (let i = 0; i < 5; i++) {
      await vi.waitFor(() => expect(release.length).toBeGreaterThan(0))
      release.shift()!()
    }
    await all
    expect(peak).toBe(2)
    expect(render).toHaveBeenCalledTimes(5)
  })

  it('does not cache a failed render', async () => {
    const render = vi
      .fn<(path: string, width: number) => Promise<Buffer>>()
      .mockRejectedValueOnce(new Error('broken'))
      .mockResolvedValue(Buffer.from('ok'))
    const thumb = createThumbnailer({ render })
    await expect(thumb('/a.png', 1, 'thumb')).rejects.toThrow('broken')
    expect((await thumb('/a.png', 1, 'thumb')).toString()).toBe('ok')
  })
})
