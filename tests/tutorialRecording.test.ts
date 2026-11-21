import { describe, expect, it, vi } from 'vitest'
import type { SettingsState } from '../src/shared/ipc'
import { createTutorialRecording, type TutorialRecordingDeps } from '../src/main/tutorialRecording'

const ref = { project: 'Python', tutorial: 'Install' }
const ready: SettingsState = {
  projectsFolder: '/p',
  projectsFolderProblem: null,
  selectedTutorial: ref,
  expandedProjects: []
}

function setup(overrides: Partial<TutorialRecordingDeps> = {}): {
  deps: TutorialRecordingDeps
  calls: string[]
} {
  const calls: string[] = []
  const deps: TutorialRecordingDeps = {
    permissionsGranted: () => true,
    getSettings: async () => ready,
    countImages: async () => 0,
    trashAllImages: vi.fn(async () => {
      calls.push('trash')
    }),
    confirm: vi.fn(async () => true),
    startRecorder: vi.fn(async () => {
      calls.push('start')
    }),
    ...overrides
  }
  return { deps, calls }
}

describe('checkReady', () => {
  it.each([
    [{ permissionsGranted: () => false }, /permissions/],
    [
      { getSettings: async () => ({ ...ready, projectsFolder: null }) },
      /choose a projects folder/i
    ],
    [
      { getSettings: async () => ({ ...ready, projectsFolderProblem: 'The folder is gone.' }) },
      /folder is gone/
    ],
    [{ getSettings: async () => ({ ...ready, selectedTutorial: null }) }, /select a tutorial/i],
    [{ countImages: async () => 3 }, /already has screenshots/]
  ] as Array<[Partial<TutorialRecordingDeps>, RegExp]>)('refuses (%#)', async (overrides, why) => {
    expect(await createTutorialRecording(setup(overrides).deps).checkReady()).toMatch(why)
  })

  it('is ready for an empty selected Tutorial', async () => {
    expect(await createTutorialRecording(setup().deps).checkReady()).toBeNull()
  })
})

describe('recordAgain', () => {
  it('asks, trashes, then starts', async () => {
    const { deps, calls } = setup({ countImages: async () => 12 })
    expect(await createTutorialRecording(deps).recordAgain()).toBe(true)
    expect(deps.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Move 12 images to the Trash and record again?' })
    )
    expect(deps.trashAllImages).toHaveBeenCalledWith(ref)
    expect(calls).toEqual(['trash', 'start'])
  })

  it('changes nothing when cancelled', async () => {
    const { deps, calls } = setup({ countImages: async () => 1, confirm: vi.fn(async () => false) })
    expect(await createTutorialRecording(deps).recordAgain()).toBe(false)
    expect(calls).toEqual([])
  })

  it('does not start when trashing fails', async () => {
    const { deps } = setup({
      countImages: async () => 1,
      trashAllImages: vi.fn(async () => {
        throw new Error('Trash is not available')
      })
    })
    await expect(createTutorialRecording(deps).recordAgain()).rejects.toThrow(/not available/)
    expect(deps.startRecorder).not.toHaveBeenCalled()
  })

  it('starts without asking when the Tutorial is already empty', async () => {
    const { deps, calls } = setup()
    expect(await createTutorialRecording(deps).recordAgain()).toBe(true)
    expect(deps.confirm).not.toHaveBeenCalled()
    expect(calls).toEqual(['start'])
  })

  it('lets the recorder report a missing selection', async () => {
    const { deps } = setup({ getSettings: async () => ({ ...ready, selectedTutorial: null }) })
    expect(await createTutorialRecording(deps).recordAgain()).toBe(false)
    expect(deps.confirm).not.toHaveBeenCalled()
    expect(deps.startRecorder).toHaveBeenCalledTimes(1)
  })
})
