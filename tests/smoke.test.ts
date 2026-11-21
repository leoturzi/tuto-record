import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

describe('smoke', () => {
  it('sharp can render a PNG', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 4, background: '#ff0000' }
    })
      .png()
      .toBuffer()
    expect((await sharp(png).metadata()).format).toBe('png')
  })
})
