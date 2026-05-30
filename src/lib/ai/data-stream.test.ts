import { describe, it, expect } from 'vitest'
import { formatStreamPart } from 'ai'
import { dataStreamTextResponse, dataStreamMessageResponse } from './data-stream'

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

describe('dataStreamMessageResponse', () => {
  it('returns a 200 data-stream response with BOTH a text part and a message_annotations part', async () => {
    const text = "Here's what I picked up — does this look right?"
    const annotation = { type: 'meal_proposal', mealId: 'm1', kcal_typical: 529 }
    const res = dataStreamMessageResponse(text, annotation)

    expect(res.status).toBe(200)
    expect(res.headers.get('x-vercel-ai-data-stream')).toBe('v1')
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')

    const body = await res.text()
    // text part FIRST, then the message_annotations part (array-wrapped).
    expect(body).toBe(
      formatStreamPart('text', text) +
        formatStreamPart('message_annotations', [annotation]),
    )
    // text part code is '0', message_annotations is '8'
    expect(body).toContain('0:')
    expect(body).toContain('8:')
    expect(body).toContain('meal_proposal')
  })
})
