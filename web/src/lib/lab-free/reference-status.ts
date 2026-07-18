import type { LabParameter } from './types'

export type LabReferenceStatus = 'unavailable' | 'normal' | 'abnormal'

/**
 * Parses a complete laboratory number without accepting partial values such as
 * "1.2 mg". Both decimal comma and decimal point are supported.
 */
export function parseLabNumber(raw: string | undefined): number | null {
  if (!raw) return null
  const normalized = raw.trim().replace(/\s+/g, '')
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
    return null
  }

  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function getLabReferenceStatus(parameter: LabParameter): LabReferenceStatus {
  const value = parseLabNumber(parameter.value)
  const minimum = parseLabNumber(parameter.refMin)
  const maximum = parseLabNumber(parameter.refMax)

  if (value === null || minimum === null || maximum === null || minimum > maximum) {
    return 'unavailable'
  }

  return value < minimum || value > maximum ? 'abnormal' : 'normal'
}
