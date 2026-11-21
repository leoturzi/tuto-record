# UI helpers (`src/renderer/src/ui`)

Small DOM helpers shared by the renderer modules. No state and no `window.api`.

[`dom.ts`](dom.ts):

- `$(selector, root?)`: one element; **throws when it is missing**, so a page whose markup and script drifted apart fails loudly at start-up instead of silently doing nothing.
- `el(tag, className?, text?)`: creates an element; text goes through `textContent`, never `innerHTML`.
- `setText(element, text | null)`: shows the text, or hides the element when it is null.
- `isTextField(target)`: true for inputs, text areas and editable content, where page shortcuts must stay out of the way.
- `errorMessage(err)`: the message of a rejected `window.api` call without Electron's "Error invoking remote method …" prefix.

Not unit-tested: the tests run in Node without a DOM.
