import type { TutoApi } from '../shared/ipc'

declare global {
  interface Window {
    api: TutoApi
  }
}
