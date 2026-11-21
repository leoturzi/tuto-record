/** Longest name APFS accepts for one folder, in UTF-8 bytes. */
export const MAX_NAME_BYTES = 255

function utf8Length(text: string): number {
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0)!
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

/**
 * Checks the characters of a Project or Tutorial name, without looking at other names.
 * Null when it can be a folder name, otherwise a short message.
 */
export function checkNameCharacters(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'Enter a name.'
  if (/[/:]/.test(trimmed)) return "Names can't contain / or :."
  if (trimmed.startsWith('.')) return "Names can't start with a dot."
  if (utf8Length(trimmed) > MAX_NAME_BYTES) return 'That name is too long.'
  return null
}

/**
 * Null when `name` (trimmed) can be used for a folder among `siblings`, otherwise a short message.
 * Names are compared ignoring case, because APFS is case-insensitive by default.
 * `current` is the item's own name when renaming, so a case-only change ("git" → "Git") is allowed.
 */
export function validateName(name: string, siblings: string[], current?: string): string | null {
  const problem = checkNameCharacters(name)
  if (problem) return problem
  const wanted = name.trim().toLowerCase()
  const own = current?.toLowerCase()
  const taken = siblings.some((sibling) => {
    const lower = sibling.toLowerCase()
    return lower === wanted && lower !== own
  })
  return taken ? 'That name is already used.' : null
}
