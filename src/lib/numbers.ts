/**
 * Parse user-typed decimals accepting both '68.4' and '68,4' (EU keyboards).
 * Grouped triplets read as thousands separators — '1,200' is 1200 (not 1.2)
 * and '1.234,56' is 1234.56 — because the money fields here see four-digit
 * amounts far more often than three-decimal fractions. A '0' head stays a
 * decimal ('0,500' → 0.5). Returns NaN for ambiguous or non-finite input —
 * callers must check.
 */
export function parseDecimal(value: string): number {
  let s = value.trim().replace(/\s/g, '')
  if (s === '') return NaN
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: the last one is the decimal point, the other groups.
    const decimal = lastDot > lastComma ? '.' : ','
    const grouping = decimal === '.' ? ',' : '.'
    s = s.split(grouping).join('').replace(decimal, '.')
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ','
    const parts = s.split(sep)
    const grouped =
      parts.length > 1 &&
      parts[0] !== '' &&
      parts[0] !== '0' &&
      parts.slice(1).every((p) => /^\d{3}$/.test(p))
    if (grouped) s = parts.join('')
    else if (parts.length > 2) return NaN
    else s = parts.join('.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}
