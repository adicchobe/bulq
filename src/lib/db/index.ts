// Prefer importing from './client' or './server' directly at call sites.
// Pulling both through this barrel from a client component will trip the
// server-only check in `next/headers` that `./server` depends on.
export { createClient as createBrowserSupabaseClient } from './client'
export { createClient as createServerSupabaseClient } from './server'
