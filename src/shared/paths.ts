/**
 * Paths of Projects, Groups and Tutorials: the folder names from the Project down, for example
 * ['Python', 'Setup', 'Install']. A Project is a path of one name.
 */
export type ItemPath = string[]

/** The path as one string, for keys and the saved expanded list. Folder names never contain '/'. */
export const pathKey = (path: ItemPath): string => path.join('/')

/** The path without its last name. */
export const parentOf = (path: ItemPath): ItemPath => path.slice(0, -1)

/** True when `inner` is `outer` itself or anything inside it. */
export function isWithin(inner: ItemPath, outer: ItemPath): boolean {
  return outer.length <= inner.length && outer.every((name, i) => inner[i] === name)
}

/** `path` with its prefix `from` replaced by `to` (after a rename or a move); unchanged otherwise. */
export function replacePrefix(path: ItemPath, from: ItemPath, to: ItemPath): ItemPath {
  return isWithin(path, from) ? [...to, ...path.slice(from.length)] : path
}

/** True for a non-empty list of non-empty strings. Says nothing about whether the folders exist. */
export function isItemPath(value: unknown): value is ItemPath {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((name) => typeof name === 'string' && name !== '')
  )
}

/** Whether two paths name the same item. */
export const samePath = (a: ItemPath | null, b: ItemPath | null): boolean =>
  a !== null && b !== null && a.length === b.length && a.every((name, i) => b[i] === name)
