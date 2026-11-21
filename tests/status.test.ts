import { describe, expect, it } from 'vitest'
import { buildStatus } from '../src/renderer/src/status'

const none = { outputFolder: null, outputFolderProblem: null }
const good = { outputFolder: '/tmp/shots', outputFolderProblem: null }
const broken = { outputFolder: '/tmp/shots', outputFolderProblem: 'The folder no longer exists.' }

describe('buildStatus', () => {
  it('shows nothing while permissions need attention', () => {
    expect(buildStatus(false, good)).toEqual({ text: null, ready: false })
  })

  it('asks for a folder when none is chosen', () => {
    const status = buildStatus(true, none)
    expect(status.ready).toBe(false)
    expect(status.text).toMatch(/choose an output folder/i)
  })

  it('asks to fix a folder that has a problem', () => {
    const status = buildStatus(true, broken)
    expect(status.ready).toBe(false)
    expect(status.text).toMatch(/fix the output folder/i)
  })

  it('is ready only with permissions and a usable folder', () => {
    expect(buildStatus(true, good)).toEqual({ text: 'Ready to record.', ready: true })
  })
})
