'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat, type Message } from 'ai/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MealProposal } from '@/lib/meals/proposal'
import { MealProposalCard, type MealCardStatus, type TeachFormInput } from './meal-card'
import { confirmMeal, rejectMeal, teachFood } from './actions'

/** Pull a meal proposal off an assistant message's annotations, if present. */
function getMealProposal(annotations: unknown): MealProposal | null {
  if (!Array.isArray(annotations)) return null
  for (const a of annotations) {
    if (
      a &&
      typeof a === 'object' &&
      'mealId' in a &&
      'items' in a &&
      Array.isArray((a as { items: unknown }).items)
    ) {
      return a as MealProposal
    }
  }
  return null
}

export function ChatThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string
  initialMessages: Message[]
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
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

  // Live-session card state, keyed by mealId (reload-rehydration deferred).
  const [mealStatus, setMealStatus] = useState<Map<string, MealCardStatus>>(new Map())
  const handleConfirm = useCallback(async (mealId: string) => {
    const res = await confirmMeal(mealId)
    if (res.ok) setMealStatus((prev) => new Map(prev).set(mealId, 'confirmed'))
  }, [])
  const handleDismiss = useCallback(async (mealId: string) => {
    const res = await rejectMeal(mealId)
    if (res.ok) setMealStatus((prev) => new Map(prev).set(mealId, 'dismissed'))
  }, [])

  // Teach a food from a proposal item. The card handles the optimistic per-item
  // display on success; we just relay ok/failure so it knows whether to update.
  const handleTeach = useCallback(
    async (mealId: string, foodNameRaw: string, input: TeachFormInput): Promise<boolean> => {
      const res = await teachFood({
        name: input.name,
        proteinPerServing: input.proteinPerServing,
        kcalPerServing: input.kcalPerServing,
        servingGrams: input.servingGrams,
        mealId,
        foodNameRaw,
      })
      return res.ok
    },
    [],
  )

  // ── Voice input (Web Speech API) — additive; typing is always available. ──
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const baselineRef = useRef('') // input value when listening started (append, don't overwrite)
  const inputRef = useRef(input)
  useEffect(() => {
    inputRef.current = input
  }, [input])

  useEffect(() => {
    setVoiceSupported(
      typeof window !== 'undefined' &&
        Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    )
    return () => recognitionRef.current?.abort() // stop on unmount
  }, [])

  const startListening = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = false // single utterance; auto-finalizes on pause
    baselineRef.current = inputRef.current

    rec.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript
        if (result.isFinal) final += transcript
        else interim += transcript
      }
      const base = baselineRef.current
      const sep = base && !base.endsWith(' ') ? ' ' : ''
      if (final) {
        baselineRef.current = base + sep + final // append final to baseline
        setInput(baselineRef.current)
      } else {
        setInput(base + sep + interim) // live interim preview
      }
    }
    rec.onerror = () => setListening(false) // no-speech / not-allowed / network → idle
    rec.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
      recognitionRef.current = null
    }
  }, [setInput])

  const toggleListening = useCallback(() => {
    if (listening) recognitionRef.current?.stop()
    else startListening()
  }, [listening, startListening])

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

        {messages.map((m) => {
          const proposal =
            m.role === 'assistant' ? getMealProposal(m.annotations) : null
          return (
            <div key={m.id} className="flex flex-col gap-2">
              <MessageBubble role={m.role} content={m.content} />
              {proposal ? (
                <MealProposalCard
                  proposal={proposal}
                  status={mealStatus.get(proposal.mealId) ?? 'pending'}
                  onConfirm={() => handleConfirm(proposal.mealId)}
                  onDismiss={() => handleDismiss(proposal.mealId)}
                  onTeach={(foodNameRaw, input) =>
                    handleTeach(proposal.mealId, foodNameRaw, input)
                  }
                />
              ) : null}
            </div>
          )
        })}
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
            placeholder={listening ? 'Listening…' : 'Message Bulq…'}
            className="flex-1 rounded-xl border border-black/[.12] bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40"
          />
          {voiceSupported ? (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={listening}
              className={`rounded-xl border px-3 py-3 text-base transition-colors ${
                listening
                  ? 'animate-pulse border-red-400 bg-red-500/10 text-red-500'
                  : 'border-black/[.12] text-black/55 hover:bg-black/[.04] dark:border-white/[.15] dark:text-white/55 dark:hover:bg-white/[.06]'
              }`}
            >
              {/* mic glyph */}
              <span aria-hidden>🎤</span>
            </button>
          ) : null}
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
