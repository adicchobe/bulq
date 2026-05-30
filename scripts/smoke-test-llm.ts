/**
 * Throwaway connectivity smoke test for the LLM adapter.
 * Run with:  npm run smoke:llm
 *   (tsx --env-file=.env.local scripts/smoke-test-llm.ts)
 *
 * TEST 1 — Gemini 2.5 Flash  (priority 'standard', free tier)
 * TEST 2 — Claude Sonnet 4.6 (priority 'high_stakes', burns Anthropic balance)
 * TEST 3 — Gemini longer response, default maxTokens — proves R11 truncation
 *          fix: a multi-item answer comes back complete, finishReason 'stop'.
 */
import { llmCall } from '../src/lib/ai/adapter'

async function pong(label: string, priority: 'standard' | 'high_stakes') {
  try {
    const res = await llmCall({
      priority,
      messages: [{ role: 'user', content: 'Reply with exactly the word: PONG' }],
      // 256, not a tight cap: gemini-2.5-flash spends hidden "thinking" tokens
      // that count against maxTokens, so a small cap truncates the real answer.
      maxTokens: 256,
    })
    console.log(`${label}: PASS`)
    console.log(`  provider/model : ${res.provider} / ${res.model}`)
    console.log(`  response text  : ${JSON.stringify(res.text)}`)
    console.log(`  finishReason   : ${res.finishReason}`)
    console.log(
      `  tokens         : ${res.usage.totalTokens} (in ${res.usage.promptTokens} / out ${res.usage.completionTokens})`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${label}: FAIL`)
    console.log(`  error: ${msg}`)
  }
}

/** R11 regression guard: a longer answer must not be silently truncated. */
async function longResponse(label: string) {
  try {
    // No maxTokens override → relies on the adapter's generous default floor.
    const res = await llmCall({
      priority: 'standard',
      messages: [
        {
          role: 'user',
          content:
            'List 5 common Indian breakfast foods. Number them 1 to 5, each with one short sentence.',
        },
      ],
    })

    const text = res.text.trim()
    const numberedItems = (text.match(/^\s*\d[\.\)]/gm) ?? []).length
    const endsCleanly = /[.!?]["')]?$/.test(text)
    const notLengthCapped = res.finishReason === 'stop'
    const complete = numberedItems >= 5 && endsCleanly && notLengthCapped

    console.log(`${label}: ${complete ? 'PASS' : 'FAIL'}`)
    console.log(`  provider/model : ${res.provider} / ${res.model}`)
    console.log(`  finishReason   : ${res.finishReason} (want 'stop', not 'length')`)
    console.log(`  numbered items : ${numberedItems} (want >= 5)`)
    console.log(`  ends cleanly   : ${endsCleanly} (terminal punctuation, not cut mid-word)`)
    console.log(
      `  tokens         : ${res.usage.totalTokens} (in ${res.usage.promptTokens} / out ${res.usage.completionTokens})`,
    )
    console.log(`  --- full response ---\n${res.text}\n  ---------------------`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${label}: FAIL`)
    console.log(`  error: ${msg}`)
  }
}

async function main() {
  console.log('=== LLM adapter connectivity smoke test ===\n')
  await pong("TEST 1 (Gemini, priority 'standard')", 'standard')
  console.log()
  await pong("TEST 2 (Claude Sonnet 4.6, priority 'high_stakes')", 'high_stakes')
  console.log()
  await longResponse('TEST 3 (Gemini long response — R11 truncation fix)')
}

main()
