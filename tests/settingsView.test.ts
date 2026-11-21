import { describe, expect, it } from 'vitest'
import { buildSettingsView } from '../src/renderer/src/settings-window/settingsView'
import type { SettingsState } from '../src/shared/ipc'

const settings: SettingsState = {
  projectsFolder: '/p',
  projectsFolderProblem: null,
  selectedTutorial: null,
  expandedProjects: []
}

describe('buildSettingsView', () => {
  it('shows the folder, its problem and the right buttons', () => {
    expect(buildSettingsView({ ...settings, projectsFolder: null })).toMatchObject({
      pathText: 'No folder chosen yet',
      pathEmpty: true,
      showOpen: false,
      chooseLabel: 'Choose folder…'
    })
    expect(buildSettingsView(settings)).toMatchObject({
      pathText: '/p',
      showOpen: true,
      chooseLabel: 'Change…'
    })
    expect(buildSettingsView({ ...settings, projectsFolderProblem: 'Gone.' })).toMatchObject({
      problem: 'Gone.',
      showOpen: false
    })
  })
})
