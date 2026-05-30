import { describe, it, expect } from 'vitest'
import { formatStreamPart } from 'ai'
import { dataStreamTextResponse } from './data-stream'

describe('dataStreamTextResponse', () => {
  it('returns a 200 data-stream response with the text as a normal message part', async () => {
    const text = 'I am a calm fallback message.'
    const res = dataStreamTextResponse(text)

    expect(res.status).toBe(200)
    expect(res.headers.get('x-vercel-ai-data-stream')).toBe('v1')
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')

    const body = await res.text()
    expect(body).toBe(formatStreamPart('text', text)) // encodes via the data-stream text part
    expect(body).toContain(text)
  })
})
