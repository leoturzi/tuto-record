/** Finds one element; throws when it is missing, so a broken page fails loudly. */
export function $<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document
): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

/** Creates an element with an optional class and text. Text always goes through `textContent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

/** Shows `text` in `element`, or hides the element when `text` is null. */
export function setText(element: HTMLElement, text: string | null): void {
  element.hidden = text === null
  element.textContent = text ?? ''
}

/** True while the user is typing in a text field, when keyboard shortcuts must stay out of the way. */
export function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/** The message of a rejected IPC call, without Electron's "Error invoking remote method" prefix. */
export function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
