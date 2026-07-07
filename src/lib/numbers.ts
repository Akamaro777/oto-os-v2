/** Parse user-typed decimals accepting both '68.4' and '68,4' (EU keyboards). */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  return normalized === '' ? NaN : Number(normalized)
}
