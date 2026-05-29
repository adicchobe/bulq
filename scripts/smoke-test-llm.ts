/**
 * Throwaway connectivity smoke test for the LLM adapter.
 * Run with:  npx tsx --env-file=.env.local scripts/smoke-test-llm.ts
 *
 * TEST 1 — Gemini 2.5 Flash  (priority 'standard', free tier)
 * TEST 2 — Claude Haiku 4.5  (priority 'high_stakes', burns Anthropic balance)
 *
 * Prompts are kept to a single tiny instruction to spend as little as possible.
 */
import { llmCall } from '../src/lib/ai/adapter'

const PROMPT = 'Reply with exactly the word: PONG'

async function run(label: string, priority: 'standard' | 'high_stakes') {
  try {
    const res = await llmCall({
      priority,
      messages: [{ role: 'user', content: PROMPT }],
      // 256, not a tight cap: gemini-2.5-flash spends hidden "thinking" tokens
      // that count against maxTokens, so a small cap truncates the real answer.
      maxTokens: 256,
    })
    console.log(`${label}: PASS`)
    console.log(`  provider/model : ${res.provider} / ${res.model}`)
    console.log(`  response text  : ${JSON.stringify(res.text)}`)
    console.log(
      `  tokens         : ${res.usage.totalTokens} (in ${res.usage.promptTokens} / out ${res.usage.completionTokens})`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`${label}: FAIL`)
    console.log(`  error: ${msg}`)
  }
}

async function main() {
  console.log('=== LLM adapter connectivity smoke test ===\n')
  await run("TEST 1 (Gemini, priority 'standard')", 'standard')
  console.log()
  await run("TEST 2 (Claude Haiku, priority 'high_stakes')", 'high_stakes')
}

main()
