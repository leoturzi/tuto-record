import { describe, expect, it } from 'vitest'
import { imageUrl, parseImageUrl } from '../src/main/imageUrl'

describe('imageUrl', () => {
  it('builds an encoded URL with the version', () => {
    expect(imageUrl('thumb', ['My Project', 'Step #1'], 'a b.png', 42)).toBe(
      'tuto-image://thumb/My%20Project/Step%20%231/a%20b.png?v=42'
    )
  })

  it.each([
    ['plain', 'Tutorial', 'a.png'],
    ['spaces and #', 'Step #1 ? 100%', 'a b.png'],
    ['emoji 😀', 'é à ü', '2026-11-21_09-15-42-123_d1.png'],
    ['a:b', 'x\\y', 'c&d=e.jpg']
  ])('round-trips %j / %j / %j', (project, tutorial, file) => {
    const url = imageUrl('preview', [project, tutorial], file, 7)
    expect(parseImageUrl(url)).toEqual({ size: 'preview', tutorial: [project, tutorial], file })
  })

  it('round-trips a Tutorial deep inside Groups', () => {
    const deep = ['Python', 'Setup #1', 'macOS', 'Homebrew', 'Install']
    const url = imageUrl('thumb', deep, 'a.png', 1)
    expect(url).toBe('tuto-image://thumb/Python/Setup%20%231/macOS/Homebrew/Install/a.png?v=1')
    expect(parseImageUrl(url)).toEqual({ size: 'thumb', tutorial: deep, file: 'a.png' })
  })
})

describe('parseImageUrl', () => {
  it.each([
    'not a url',
    'https://thumb/a/b/c.png',
    'tuto-image://huge/a/b/c.png',
    'tuto-image://thumb/a/b',
    'tuto-image://thumb/a//c.png',
    'tuto-image://thumb/a/..%2F..%2Fetc/passwd',
    'tuto-image://thumb/%2E%2E/b/c.png',
    'tuto-image://thumb/a/b/..',
    'tuto-image://thumb/a/b/%E0%A4%A.png',
    'tuto-image://thumb/a/b/x%00.png'
  ])('rejects %s', (url) => {
    expect(parseImageUrl(url)).toBeNull()
  })
})
