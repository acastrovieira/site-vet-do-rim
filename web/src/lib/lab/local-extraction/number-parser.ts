export interface ParsedLocalNumber {
  value: number | null
  qualifier: '<' | '<=' | '>' | '>=' | null
  ambiguous: boolean
  raw: string
}

const NUMBER_TOKEN = /(?:<=|>=|<|>|≤|≥)?\s*[+-]?\d[\d.,]*/g

export function findLocalNumberTokens(value: string) {
  return value.match(NUMBER_TOKEN)?.map((token) => token.trim()) ?? []
}

export function parseLocalNumber(rawToken: string): ParsedLocalNumber {
  const compact = rawToken.replace(/\s+/g, '')
  const qualifierMatch = compact.match(/^(<=|>=|<|>|≤|≥)/)
  const qualifier = qualifierMatch?.[1]
    ?.replace('≤', '<=')
    .replace('≥', '>=') as ParsedLocalNumber['qualifier'] | undefined
  const numeric = compact.replace(/^(?:<=|>=|<|>|≤|≥)/, '')

  if (!/^[+-]?\d[\d.,]*$/.test(numeric)) {
    return { value: null, qualifier: qualifier ?? null, ambiguous: true, raw: rawToken }
  }

  const unsigned = numeric.replace(/^[+-]/, '')
  const commaIndex = unsigned.lastIndexOf(',')
  const dotIndex = unsigned.lastIndexOf('.')
  let normalized = numeric
  let ambiguous = false

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = numeric.split(thousandsSeparator).join('').replace(decimalSeparator, '.')
  } else {
    const separator = commaIndex >= 0 ? ',' : dotIndex >= 0 ? '.' : null
    if (separator) {
      const parts = unsigned.split(separator)
      if (parts.length > 2) {
        const groups = parts.slice(1)
        if (groups.every((part) => part.length === 3)) {
          normalized = numeric.split(separator).join('')
        } else {
          ambiguous = true
        }
      } else if (parts[1]?.length === 3 && parts[0] !== '0') {
        ambiguous = true
      } else {
        normalized = numeric.replace(separator, '.')
      }
    }
  }

  const value = ambiguous ? null : Number(normalized)
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000) {
    return { value: null, qualifier: qualifier ?? null, ambiguous: true, raw: rawToken }
  }

  return {
    value: qualifier ? null : value,
    qualifier: qualifier ?? null,
    ambiguous,
    raw: rawToken,
  }
}
