/** Short, sortable-enough unique id for new rows (v1 ids are preserved on import). */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
