import { describe, expect, it } from 'vitest'
import { isImageFile } from '../src/shared/images'
import { checkNameCharacters, validateName } from '../src/shared/names'

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('How to install Python', ['Git'])).toBeNull()
  })

  it('trims before checking', () => {
    expect(validateName('  Git  ', [])).toBeNull()
    expect(validateName('   ', [])).toMatch(/enter a name/i)
  })

  it.each([
    ['', /enter a name/i],
    ['a/b', /\/ or :/],
    ['a:b', /\/ or :/],
    ['.hidden', /dot/],
    ['x'.repeat(256), /too long/]
  ])('refuses %j', (name, message) => {
    expect(validateName(name, [])).toMatch(message)
  })

  it('counts the length in UTF-8 bytes', () => {
    expect(checkNameCharacters('é'.repeat(127))).toBeNull() // 254 bytes
    expect(checkNameCharacters('é'.repeat(128))).toMatch(/too long/) // 256 bytes
    expect(checkNameCharacters('😀'.repeat(63))).toBeNull() // 252 bytes
    expect(checkNameCharacters('😀'.repeat(64))).toMatch(/too long/) // 256 bytes
  })

  it('refuses a sibling name, ignoring case', () => {
    expect(validateName('git tutorial', ['Git Tutorial'])).toMatch(/already used/)
  })

  it('allows a rename that only changes the case', () => {
    expect(validateName('Git', ['git', 'Other'], 'git')).toBeNull()
    expect(validateName('other', ['git', 'Other'], 'git')).toMatch(/already used/)
  })
})

describe('isImageFile', () => {
  it.each(['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', '2026-11-21_09-15-42-123_d1.png'])(
    'accepts %s',
    (name) => {
      expect(isImageFile(name)).toBe(true)
    }
  )

  it.each(['notes.txt', 'png', '.png', '.hidden.png', 'a.heic', 'folder'])('refuses %s', (name) => {
    expect(isImageFile(name)).toBe(false)
  })
})
