/** A Click: a left-button press, with its position in global screen points and when it happened. */
export interface ClickEvent {
  x: number
  y: number
  /** Milliseconds, from the system clock. */
  time: number
}

/** The only fields of a mouse event that we read (a subset of uiohook's event). */
export interface RawMouseEvent {
  x: number
  y: number
  button: unknown
}

/** libuiohook numbers the left button 1, right 2 and middle 3. */
const LEFT_BUTTON = 1

/** Returns a Click for a left-button press, and null for any other button. */
export function toClick(event: RawMouseEvent, time: number): ClickEvent | null {
  if (event.button !== LEFT_BUTTON) return null
  return { x: event.x, y: event.y, time }
}

export interface ClickSource {
  /** Starts calling `onClick` for every Click. Throws if the system hook cannot start. */
  start(onClick: (click: ClickEvent) => void): void
  stop(): void
}
