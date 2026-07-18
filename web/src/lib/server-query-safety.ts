/**
 * Converts a provider/database error into a stable server-only failure code.
 * The original object is intentionally not logged or copied into the Error,
 * because it can contain SQL details or patient/tutor identifiers.
 */
export function assertServerQuerySucceeded(
  error: unknown,
  failureCode: string,
): asserts error is null | undefined {
  if (!error) return

  const failure = new Error(failureCode)
  failure.name = 'ServerQueryError'
  throw failure
}

export function throwServerQueryFailure(failureCode: string): never {
  const failure = new Error(failureCode)
  failure.name = 'ServerQueryError'
  throw failure
}
