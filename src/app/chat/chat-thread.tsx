'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useChat, type Message } from 'ai/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string
  initialMessages: Message[]
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    id: conversationId,
    initialMessages,
    // Send only { conversationId, message } — the server loads history from the
    // DB rather than trusting the client's message array.
    experimental_prepareRequestBody: ({ messages }) => ({
      conversationId,
      message: messages[messages.length - 1]?.content ?? '',
    }),
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] font-[family-name:var(--font-geist-sans)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.06] bg-[var(--background)]/80 px-5 py-3 backdrop-blur dark:border-white/[.08]">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
          Bulq
        </span>
        <Link
          href="/"
          className="text-sm text-black/55 underline-offset-4 hover:underline dark:text-white/55"
        >
          Dashboard
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm leading-relaxed text-black/45 dark:text-white/45">
            Ask Bulq anything about your eating, training, or goal. Precise meal
            logging is coming soon — for now, let&apos;s talk it through.
          </p>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t border-black/[.06] bg-[var(--background)]/80 px-5 py-3 backdrop-blur dark:border-white/[.08]"
      >
        <div className="mx-auto flex w-full max-w-md items-end gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Message Bulq…"
            className="flex-1 rounded-xl border border-black/[.12] bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            className="rounded-xl bg-[var(--foreground)] px-4 py-3 text-base font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isLoading ? '…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Markdown → Tailwind. Tight spacing and constrained heading sizes so nothing
// blows out a chat bubble; break-words keeps long tokens/URLs from overflowing.
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <p className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mb-1 mt-2 font-semibold first:mt-0">{children}</p>,
  code: ({ children }) => (
    <code className="rounded bg-black/[.06] px-1 py-0.5 text-[0.9em] dark:bg-white/[.1]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-black/[.06] p-3 text-sm last:mb-0 dark:bg-white/[.08]">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-black/15 pl-3 text-black/70 dark:border-white/20 dark:text-white/70">
      {children}
    </blockquote>
  ),
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-[var(--foreground)] px-4 py-2.5 text-base text-[var(--background)]">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] break-words rounded-2xl rounded-bl-sm border border-black/[.08] bg-white/40 px-4 py-2.5 text-base dark:border-white/[.12] dark:bg-white/[.04]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
