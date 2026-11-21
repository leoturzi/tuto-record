import { describe, expect, it } from 'vitest'
import { toClick } from '../src/main/click'

describe('toClick', () => {
  it('turns a left-button press into a Click', () => {
    expect(toClick({ x: 10, y: 20, button: 1 }, 1234)).toEqual({ x: 10, y: 20, time: 1234 })
  })

  it.each([2, 3, 4, 5, 0, undefined, null, '1'])('ignores button %j', (button) => {
    expect(toClick({ x: 1, y: 1, button }, 0)).toBeNull()
  })
})
