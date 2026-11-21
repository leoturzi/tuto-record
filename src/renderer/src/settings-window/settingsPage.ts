import type { SettingsState } from '../../../shared/ipc'
import { $, setText } from '../ui/dom'
import { buildSettingsView } from './settingsView'

export interface SettingsPage {
  render(settings: SettingsState): void
}

/** The Projects folder section of the Settings window. Expects the markup in `settings.html`. */
export function createSettingsPage(root: HTMLElement): SettingsPage {
  const path = $('#folder-path', root)
  const problem = $('#folder-problem', root)
  const choose = $<HTMLButtonElement>('#choose-folder', root)
  const open = $<HTMLButtonElement>('#open-folder', root)

  const page: SettingsPage = {
    render(settings) {
      const view = buildSettingsView(settings)
      path.textContent = view.pathText
      path.classList.toggle('empty', view.pathEmpty)
      setText(problem, view.problem)
      choose.textContent = view.chooseLabel
      open.hidden = !view.showOpen
    }
  }

  choose.addEventListener('click', () => {
    void window.api.chooseProjectsFolder().then(page.render)
  })
  open.addEventListener('click', () => {
    void window.api.openProjectsFolder()
  })
  return page
}
