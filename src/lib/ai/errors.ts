import { APICallError, RetryError } from 'ai'

export type LlmErrorType = 'rate_limit' | 'timeout' | 'server_error' | 'auth' | 'other'

/**
 * Classify a thrown LLM error into a stable error_type + whether it's transient.
 * `transient` drives retry/failover (failover lands in a later sub-pass).
 *
 * Unwraps the SDK's RetryError to the underlying provider APICallError — the SDK
 * throws a raw APICallError on a first-attempt non-retryable failure (e.g. 401),
 * but a RetryError (with .lastError) once retries are exhausted.
 */
export function classifyLlmError(err: unknown): {
  errorType: LlmErrorType
  transient: boolean
} {
  const underlying = RetryError.isInstance(err) ? err.lastError : err

  if (APICallError.isInstance(underlying)) {
    const status = underlying.statusCode
    if (status === 429) return { errorType: 'rate_limit', transient: true }
    if (status === 408) return { errorType: 'timeout', transient: true }
    if (status !== undefined && status >= 500) {
      return { errorType: 'server_error', transient: true } // incl. 529 overloaded
    }
    if (status === 401 || status === 403) return { errorType: 'auth', transient: false }
    if (status === 400 || status === 404) return { errorType: 'other', transient: false }
  }

  const msg = (err instanceof Error ? `${err.name} ${err.message}` : String(err)).toLowerCase()
  if (/timeout|etimedout|econnreset|enotfound|econnrefused|network|fetch failed|aborted/.test(msg)) {
    return { errorType: 'timeout', transient: true }
  }
  return { errorType: 'other', transient: false }
}
