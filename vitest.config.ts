import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Resolve the '@/...' path alias in tests (mirrors tsconfig paths). Needed so the
// adapter's `@/lib/db/usage` import resolves under vitest. No new dependency.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
