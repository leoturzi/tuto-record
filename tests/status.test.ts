import { describe, expect, it } from 'vitest'
import { buildStatus } from '../src/renderer/src/recorder-bar/status'
import type { SettingsState } from '../src/shared/ipc'

const good: SettingsState = {
  projectsFolder: '/p',
  projectsFolderProblem: null,
  selectedTutorial: { project: 'Python', tutorial: 'Install' },
  expandedProjects: []
}

describe('buildStatus', () => {
  it('sends the user to Settings while permissions are missing', () => {
    expect(buildStatus(false, good, 'empty', 0)).toMatchObject({
      ready: false,
      needsSettings: true,
      text: expect.stringMatching(/permissions/)
    })
  })

  it('sends the user to Settings without a usable Projects folder', () => {
    const none = buildStatus(true, { ...good, projectsFolder: null }, 'none', 0)
    expect(none).toMatchObject({ ready: false, needsSettings: true })
    expect(none.text).toMatch(/choose a projects folder/i)

    const broken = buildStatus(true, { ...good, projectsFolderProblem: 'Gone.' }, 'none', 0)
    expect(broken).toMatchObject({ ready: false, needsSettings: true })
    expect(broken.text).toMatch(/^Gone\./)
  })

  it('asks for a Tutorial when none is selected', () => {
    expect(buildStatus(true, { ...good, selectedTutorial: null }, 'none', 0)).toMatchObject({
      ready: false,
      needsSettings: false,
      text: expect.stringMatching(/select a tutorial/i)
    })
  })

  it('is ready to record an empty Tutorial', () => {
    expect(buildStatus(true, good, 'empty', 0)).toEqual({
      text: 'Ready to record.',
      ready: true,
      needsSettings: false
    })
  })

  it('counts the screenshots of a recorded Tutorial', () => {
    expect(buildStatus(true, good, 'has-images', 1).text).toMatch(/^1 screenshot\./)
    expect(buildStatus(true, good, 'has-images', 12)).toMatchObject({
      ready: true,
      text: expect.stringMatching(/^12 screenshots\. Record again/)
    })
  })
})
