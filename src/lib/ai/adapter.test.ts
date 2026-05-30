import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { APICallError } from 'ai'

// Mock the usage logger (server-only; otherwise hits next/headers cookies()).
vi.mock('@/lib/db/usage', () => ({
  logApiUsage: vi.fn().mockResolvedValue(undefined),
  getAnthropicSpendUsd: vi.fn().mockResolvedValue(0),
}))

// Partially mock 'ai': stub generateText/streamText, KEEP the real error classes
// (errors.ts + this test rely on the real APICallError / RetryError).
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn(), streamText: vi.fn() }
})

import { generateText } from 'ai'
import { llmCall } from './adapter'
import { logApiUsage, getAnthropicSpendUsd } from '@/lib/db/usage'

const genMock = generateText as unknown as Mock // loose: lets us resolve partial results
const logMock = vi.mocked(logApiUsage)
const spendMock = vi.mocked(getAnthropicSpendUsd)

const transient = () =>
  new APICallError({
    message: 'overloaded',
    url: 'https://x',
    requestBodyValues: {},
    statusCode: 503,
    isRetryable: true,
  })
const permanent = () =>
  new APICallError({
    message: 'unauthorized',
    url: 'https://x',
    requestBodyValues: {},
    statusCode: 401,
    isRetryable: false,
  })
const ok = () => ({
  text: 'ok',
  finishReason: 'stop',
  usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
})

const options = {
  messages: [{ role: 'user' as const, content: 'hi' }],
  priority: 'standard' as const,
  userId: 'u1',
  operation: 'test',
}

beforeEach(() => {
  genMock.mockReset()
  logMock.mockClear()
  spendMock.mockReset()
  spendMock.mockResolvedValue(0) // default: under budget (existing tests unaffected)
})

describe('llmCall failover (mocked providers)', () => {
  it('transient primary failure → one failover → succeeds on the alternate', async () => {
    genMock.mockRejectedValueOnce(transient()).mockResolvedValueOnce(ok())
    const res = await llmCall(options)
    expect(genMock).toHaveBeenCalledTimes(2) // primary + exactly one failover
    expect(res.provider).toBe('anthropic') // gemini → Claude failover
    expect(res.model).toBe('claude-haiku-4-5-20251001') // cheap failover model
    expect(logMock).toHaveBeenCalledTimes(2)
    expect(logMock.mock.calls[0][0]).toMatchObject({ success: false, failedOver: false, provider: 'gemini' })
    expect(logMock.mock.calls[1][0]).toMatchObject({ success: true, failedOver: true, provider: 'anthropic' })
  })

  it('both providers fail → rejects; two failure rows (primary + failover)', async () => {
    genMock.mockRejectedValue(transient())
    await expect(llmCall(options)).rejects.toBeInstanceOf(APICallError)
    expect(genMock).toHaveBeenCalledTimes(2)
    expect(logMock).toHaveBeenCalledTimes(2)
    expect(logMock.mock.calls[0][0]).toMatchObject({ success: false, failedOver: false })
    expect(logMock.mock.calls[1][0]).toMatchObject({ success: false, failedOver: true })
  })

  it('permanent error → NO failover (one attempt only); one failure row', async () => {
    genMock.mockRejectedValueOnce(permanent())
    await expect(llmCall(options)).rejects.toBeInstanceOf(APICallError)
    expect(genMock).toHaveBeenCalledTimes(1) // proves failover did NOT fire
    expect(logMock).toHaveBeenCalledTimes(1)
    expect(logMock.mock.calls[0][0]).toMatchObject({ success: false, failedOver: false, errorType: 'auth' })
  })
})

describe('llmCall budget guard (hard-stop = 95% of $4.51 ≈ $4.2845)', () => {
  const highStakes = { ...options, priority: 'high_stakes' as const }

  it('over hard-stop + high-stakes → downgrades to Gemini, no Claude call', async () => {
    spendMock.mockResolvedValue(5) // over
    genMock.mockResolvedValueOnce(ok())
    const res = await llmCall(highStakes)
    expect(res.provider).toBe('gemini') // downgraded
    expect(res.model).toBe('gemini-2.5-flash')
    expect(genMock).toHaveBeenCalledTimes(1)
    expect(logMock.mock.calls[0][0]).toMatchObject({ success: true, provider: 'gemini' })
  })

  it('over hard-stop + Gemini primary fails → NO Claude failover, degrades (throws)', async () => {
    spendMock.mockResolvedValue(5) // over
    genMock.mockRejectedValue(transient()) // standard → gemini primary fails
    await expect(llmCall(options)).rejects.toBeInstanceOf(APICallError)
    expect(genMock).toHaveBeenCalledTimes(1) // failover skipped (no 2nd attempt)
    expect(logMock).toHaveBeenCalledTimes(1) // only the primary failure row
  })

  it('under hard-stop + high-stakes → uses Claude normally', async () => {
    spendMock.mockResolvedValue(0) // under
    genMock.mockResolvedValueOnce(ok())
    const res = await llmCall(highStakes)
    expect(res.provider).toBe('anthropic')
    expect(res.model).toBe('claude-haiku-4-5-20251001')
    expect(genMock).toHaveBeenCalledTimes(1)
  })
})
