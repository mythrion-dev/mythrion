/**
 * Shared helpers for the accent-insensitive, tokenized search used by the
 * public campaign and public template listings. Both services must apply
 * exactly the same tokenization and escaping so the two pages behave
 * identically.
 */

/**
 * Split a raw search query into non-empty tokens (whitespace-separated).
 * Every token must match at least one searchable field (AND semantics).
 */
export function splitSearchTokens(search: string): string[] {
  return search
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Escape LIKE wildcards so user input is matched literally instead of
 * acting as pattern characters. Postgres uses backslash as the LIKE
 * escape character.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`)
}
