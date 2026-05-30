import { describe, it, expect } from 'vitest'
import { APICallError, RetryError } from 'ai'
import { classifyLlmError } from './errors'

function apiError(statusCode: number, isRetryable: boolean): APICallError {
  return new APICallError({
    message: `status ${statusCode}`,
    url: 'https://example.test/v1',
    requestBodyValues: {},
    statusCode,
    isRetryable,
  })
}

describe('classifyLlmError', () => {
  it('raw APICallError 429 → rate_limit / transient', () => {
    expect(classifyLlmError(apiError(429, true))).toEqual({
      errorType: 'rate_limit',
      transient: true,
    })
  })

  it('RetryError wrapping a 401 → auth / not transient (proves unwrap)', () => {
    const wrapped = new RetryError({
      message: 'Failed after attempts',
      reason: 'maxRetriesExceeded',
      errors: [apiError(401, false)],
    })
    expect(classifyLlmError(wrapped)).toEqual({
      errorType: 'auth',
      transient: false,
    })
  })

  it('>= 500 → server_error / transient (incl. 529 overloaded)', () => {
    expect(classifyLlmError(apiError(503, true))).toEqual({
      errorType: 'server_error',
      transient: true,
    })
    expect(classifyLlmError(apiError(529, true))).toEqual({
      errorType: 'server_error',
      transient: true,
    })
  })

  it('network/timeout-string error → timeout / transient', () => {
    expect(classifyLlmError(new Error('fetch failed: ETIMEDOUT'))).toEqual({
      errorType: 'timeout',
      transient: true,
    })
  })

  it('unknown error → other / not transient', () => {
    expect(classifyLlmError(new Error('something weird'))).toEqual({
      errorType: 'other',
      transient: false,
    })
  })
})
