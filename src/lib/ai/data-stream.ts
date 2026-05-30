import { formatStreamPart } from 'ai'

/**
 * Build a 200 data-stream Response carrying `text` as a normal assistant message.
 * Mirrors toDataStreamResponse's encoding (formatStreamPart) + headers, so the
 * useChat client renders it as a reply — NOT an error state. Used for graceful
 * degradation when the model is unreachable (no raw error, no fabricated content).
 */
export function dataStreamTextResponse(text: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(formatStreamPart('text', text)))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    },
  })
}
