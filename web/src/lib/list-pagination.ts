export type ListPageParam = string | string[] | undefined
export const MAX_LIST_PAGE = 10_000

export function parseListPage(value: ListPageParam, pageSize: number) {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) return 1

  // Repeated query parameters are ambiguous and can be interpreted
  // differently by intermediaries. Normalize them to the safe first page.
  if (Array.isArray(value)) return 1
  const raw = value
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1

  const parsed = Number(raw)
  const maxSafePage = Math.min(
    MAX_LIST_PAGE,
    Math.floor(Number.MAX_SAFE_INTEGER / pageSize),
  )
  return Number.isSafeInteger(parsed) && parsed <= maxSafePage ? parsed : 1
}

export function listPageRange(page: number, pageSize: number) {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    return { firstRow: 0, lastRow: 0 }
  }
  if (
    !Number.isSafeInteger(page) ||
    page <= 0 ||
    page > Math.min(MAX_LIST_PAGE, Math.floor(Number.MAX_SAFE_INTEGER / pageSize))
  ) {
    return { firstRow: 0, lastRow: Math.max(0, pageSize - 1) }
  }

  const firstRow = (page - 1) * pageSize
  return { firstRow, lastRow: firstRow + pageSize - 1 }
}

export function boundedTotalPages(totalItems: number, pageSize: number) {
  if (
    !Number.isSafeInteger(totalItems) ||
    totalItems < 0 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize <= 0
  ) return 1

  return Math.min(MAX_LIST_PAGE, Math.max(1, Math.ceil(totalItems / pageSize)))
}
