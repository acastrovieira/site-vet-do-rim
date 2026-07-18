const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Validates a calendar date without assigning it a local time zone.
 * Timestamps must use a different contract.
 */
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = CIVIL_DATE_RE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export function assertCivilDate(value: unknown): asserts value is string {
  if (!isCivilDate(value)) throw new Error('Invalid civil date.')
}

export function formatCivilDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'pt-BR',
) {
  assertCivilDate(value)
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

export function compareCivilDatesDescending(a: string, b: string) {
  assertCivilDate(a)
  assertCivilDate(b)
  return b.localeCompare(a)
}

export function formatSaoPauloTimestampDate(value: string, locale = 'pt-BR') {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid timestamp.')
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(timestamp))
}
