import { uIOhook, type UiohookMouseEvent } from 'uiohook-napi'
import { toClick, type ClickEvent, type ClickSource } from './click'

/** Global mouse hook. Only start it once Accessibility is granted. */
export function createClickListener(): ClickSource {
  let handler: ((event: UiohookMouseEvent) => void) | null = null

  return {
    start(onClick: (click: ClickEvent) => void) {
      if (handler) return
      handler = (event) => {
        const click = toClick(event, Date.now())
        if (click) onClick(click)
      }
      uIOhook.on('mousedown', handler)
      uIOhook.start()
    },
    stop() {
      if (!handler) return
      uIOhook.off('mousedown', handler)
      handler = null
      uIOhook.stop()
    }
  }
}
