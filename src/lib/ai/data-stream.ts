import { formatStreamPart } from 'ai'
import type { JSONValue } from 'ai'

const DATA_STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'x-vercel-ai-data-stream': 'v1',
} as const

function streamResponse(body: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: DATA_STREAM_HEADERS })
}

/**
 * Build a 200 data-stream Response carrying `text` as a normal assistant message.
 * Mirrors toDataStreamResponse's encoding (formatStreamPart) + headers, so the
 * useChat client renders it as a reply — NOT an error state. Used for graceful
 * degradation when the model is unreachable (no raw error, no fabricated content).
 */
export function dataStreamTextResponse(text: string): Response {
  return streamResponse(formatStreamPart('text', text))
}

/**
 * Build a 200 data-stream Response carrying `text` (the assistant reply) PLUS a
 * message_annotation. useChat attaches the annotation to the assistant message
 * (message.annotations), which the client uses to render the meal confirm card.
 * Text part first, then the annotation part.
 */
export function dataStreamMessageResponse(
  text: string,
  annotation: JSONValue,
): Response {
  return streamResponse(
    formatStreamPart('text', text) +
      formatStreamPart('message_annotations', [annotation]),
  )
}
