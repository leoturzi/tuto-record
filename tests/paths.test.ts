import { describe, expect, it } from 'vitest'
import {
  isItemPath,
  isWithin,
  parentOf,
  pathKey,
  replacePrefix,
  samePath
} from '../src/shared/paths'

describe('paths', () => {
  it('joins a path into a key and finds its parent', () => {
    expect(pathKey(['Python', 'Setup', 'Install'])).toBe('Python/Setup/Install')
    expect(parentOf(['Python', 'Setup', 'Install'])).toEqual(['Python', 'Setup'])
    expect(parentOf(['Python'])).toEqual([])
  })

  it('tells whether one path is inside another', () => {
    expect(isWithin(['Python', 'Setup'], ['Python', 'Setup'])).toBe(true)
    expect(isWithin(['Python', 'Setup', 'Install'], ['Python'])).toBe(true)
    expect(isWithin(['Python'], ['Python', 'Setup'])).toBe(false)
    expect(isWithin(['Pythonic'], ['Python'])).toBe(false)
    expect(isWithin(['Py', 'Setup'], ['Python'])).toBe(false)
  })

  it('replaces a prefix after a rename or move, and leaves other paths alone', () => {
    expect(
      replacePrefix(['Python', 'Setup', 'Install'], ['Python', 'Setup'], ['Git', 'X'])
    ).toEqual(['Git', 'X', 'Install'])
    expect(replacePrefix(['Python', 'Other'], ['Python', 'Setup'], ['Git'])).toEqual([
      'Python',
      'Other'
    ])
  })

  it('recognises a path', () => {
    expect(isItemPath(['Python'])).toBe(true)
    expect(isItemPath(['Python', 'Setup'])).toBe(true)
    for (const value of [[], [''], ['a', 3], 'Python', null, { project: 'a' }]) {
      expect(isItemPath(value)).toBe(false)
    }
  })

  it('compares paths', () => {
    expect(samePath(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(samePath(['a', 'b'], ['a'])).toBe(false)
    expect(samePath(null, ['a'])).toBe(false)
  })
})
