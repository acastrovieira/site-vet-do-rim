const RUN_ID_PATTERNS = {
  labcrud: /^labcrud-\d{14}$/,
  uploadia: /^uploadia-\d{14}$/,
}

export function assertValidCleanupRunId(runId, kind) {
  const pattern = RUN_ID_PATTERNS[kind]
  if (!pattern || typeof runId !== 'string' || !pattern.test(runId)) {
    throw new Error(
      `Invalid E2E_CLEANUP_RUN_ID for ${kind}. Expected ${kind}-YYYYMMDDhhmmss.`,
    )
  }
  return runId
}

export function matchesExactE2EUser(email, runId, kind) {
  assertValidCleanupRunId(runId, kind)
  return email === `e2e-vet-${runId}@example.test`
}

function sortedUniqueIds(ids) {
  return [...new Set(ids)].sort()
}

export function assertDeletedIds(label, expectedIds, deletedRows) {
  if (!Array.isArray(deletedRows)) {
    throw new Error(`${label} deletion did not return rows for verification.`)
  }

  const expected = sortedUniqueIds(expectedIds)
  const actual = sortedUniqueIds(deletedRows.map((row) => row?.id).filter(Boolean))

  if (expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) {
    throw new Error(
      `${label} deletion mismatch: expected ${expected.length} row(s), confirmed ${actual.length}.`,
    )
  }
}

export function assertRemovedCount(label, expectedCount, removedObjects) {
  if (!Array.isArray(removedObjects) || removedObjects.length !== expectedCount) {
    const actual = Array.isArray(removedObjects) ? removedObjects.length : 0
    throw new Error(
      `${label} removal mismatch: expected ${expectedCount} object(s), confirmed ${actual}.`,
    )
  }
}

export function assertRows(label, rows) {
  if (!Array.isArray(rows)) {
    throw new Error(`${label} query did not return a verifiable row array.`)
  }
  return rows
}

export function assertNoRows(label, rows) {
  assertRows(`${label} residue`, rows)
  if (rows.length > 0) {
    throw new Error(`${label} cleanup left ${rows.length} residue(s).`)
  }
}

export async function deleteRowsByIds(supabase, table, ids, label = table) {
  const expectedIds = sortedUniqueIds(ids)
  if (expectedIds.length === 0) return

  const { data, error } = await supabase
    .from(table)
    .delete()
    .in('id', expectedIds)
    .select('id')
  if (error) throw new Error(`Failed to delete ${label}: ${error.message}`)
  assertDeletedIds(label, expectedIds, data)
}

export async function removeStoragePaths(supabase, bucket, paths) {
  const expectedPaths = [...new Set(paths)]
  if (expectedPaths.length === 0) return

  const { data, error } = await supabase.storage.from(bucket).remove(expectedPaths)
  if (error) {
    throw new Error(`Storage cleanup failed; keeping database rows for traceability: ${error.message}`)
  }
  assertRemovedCount('Storage', expectedPaths.length, data)
}

export async function verifyTableRowsAbsent(supabase, table, ids) {
  const expectedIds = sortedUniqueIds(ids)
  if (expectedIds.length === 0) return

  const { data, error } = await supabase.from(table).select('id').in('id', expectedIds)
  if (error) throw new Error(`Failed to verify ${table} cleanup: ${error.message}`)
  assertNoRows(table, data)
}

export async function verifyStoragePathsAbsent(supabase, bucket, paths) {
  for (const path of new Set(paths)) {
    const { data: exists, error } = await supabase.storage.from(bucket).exists(path)
    if (error) throw new Error(`Failed to verify storage cleanup for ${path}: ${error.message}`)
    if (typeof exists !== 'boolean') {
      throw new Error(`Storage residue query did not return a verifiable result for ${path}.`)
    }
    if (exists) throw new Error(`Storage cleanup left residue: ${path}`)
  }
}

function toError(error) {
  return error instanceof Error ? error : new Error(String(error))
}

export async function runCleanupSteps(steps, { primaryError } = {}) {
  const failures = []

  for (const [label, step] of steps) {
    try {
      await step()
    } catch (error) {
      const cause = toError(error)
      failures.push(new Error(`Cleanup step "${label}" failed: ${cause.message}`, { cause }))
    }
  }

  if (primaryError) failures.unshift(toError(primaryError))

  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, 'E2E execution and/or cleanup failed.')
  }
}

const AUTH_USERS_PER_PAGE = 1000
const AUTH_MAX_VERIFICATION_PAGES = 10000

function assertAuthCleanupIdentities(users, isExpectedUser) {
  if (!Array.isArray(users)) {
    throw new Error('Auth cleanup requires a verifiable user array.')
  }
  if (typeof isExpectedUser !== 'function') {
    throw new Error('Auth cleanup requires an exact E2E identity predicate.')
  }

  const seenIds = new Set()
  const seenEmails = new Set()

  for (const user of users) {
    const normalizedEmail = typeof user?.email === 'string'
      ? user.email.trim().toLowerCase()
      : ''

    if (
      typeof user?.id !== 'string'
      || user.id.length === 0
      || normalizedEmail.length === 0
      || !isExpectedUser({ ...user, email: normalizedEmail })
    ) {
      throw new Error('Auth cleanup refused an unexpected E2E identity.')
    }
    if (seenIds.has(user.id) || seenEmails.has(normalizedEmail)) {
      throw new Error('Auth cleanup refused duplicate E2E identities.')
    }

    seenIds.add(user.id)
    seenEmails.add(normalizedEmail)
  }

  return users.map((user) => ({
    ...user,
    email: user.email.trim().toLowerCase(),
  }))
}

export async function verifyAuthUsersAbsent(authAdmin, users) {
  const expectedIds = new Set(users.map((user) => user.id))
  const expectedEmails = new Set(users.map((user) => user.email.toLowerCase()))
  const residueIds = new Set()
  const residueEmails = new Set()
  const visitedPages = new Set()
  let page = 1

  while (true) {
    if (
      !Number.isSafeInteger(page)
      || page < 1
      || visitedPages.has(page)
      || visitedPages.size >= AUTH_MAX_VERIFICATION_PAGES
    ) {
      throw new Error('Auth cleanup verification received invalid pagination.')
    }
    visitedPages.add(page)

    const { data, error } = await authAdmin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    })
    if (error) throw new Error('Auth cleanup verification query failed.')
    if (!Array.isArray(data?.users)) {
      throw new Error('Auth cleanup verification did not return a user array.')
    }

    for (const user of data.users) {
      if (expectedIds.has(user?.id)) residueIds.add(user.id)
      if (
        typeof user?.email === 'string'
        && expectedEmails.has(user.email.toLowerCase())
      ) {
        residueEmails.add(user.email.toLowerCase())
      }
    }

    if (data.nextPage === null || data.nextPage === undefined) {
      if (data.users.length < AUTH_USERS_PER_PAGE) break
      page += 1
      continue
    }
    if (!Number.isSafeInteger(data.nextPage) || data.nextPage < 1) {
      throw new Error('Auth cleanup verification received invalid next-page metadata.')
    }
    page = data.nextPage
  }

  if (residueIds.size > 0 || residueEmails.size > 0) {
    throw new Error(
      `Auth cleanup left ${residueIds.size} matching ID(s) and ${residueEmails.size} matching email(s).`,
    )
  }
}

export async function deleteAuthUsersAndVerify(
  authAdmin,
  users,
  options,
) {
  const isExpectedUser = options?.isExpectedUser
  const onDeleted = options?.onDeleted ?? (() => {})
  const identities = assertAuthCleanupIdentities(users, isExpectedUser)
  const failures = []

  if (identities.length === 0) return

  for (const [index, user] of identities.entries()) {
    try {
      const { error } = await authAdmin.deleteUser(user.id)
      if (error) {
        throw new Error('Provider rejected deleteUser.')
      }
      onDeleted(user)
    } catch {
      const label = typeof user.role === 'string' ? user.role : `index ${index}`
      failures.push(new Error(`Auth deleteUser failed for E2E ${label}.`))
    }
  }

  try {
    await verifyAuthUsersAbsent(authAdmin, identities)
  } catch (error) {
    const cause = toError(error)
    failures.push(new Error(`Auth residue verification failed: ${cause.message}`))
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Auth E2E cleanup failed.')
  }
}
