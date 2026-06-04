import { execSync } from 'node:child_process'

/**
 * A stable build id for cache-busting + a visible version stamp. Prefers Vercel's
 * commit SHA, falls back to local git, then a timestamp (so a build never fails
 * just because git isn't available).
 */
function resolveBuildId() {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return `t${Date.now()}`
  }
}

const buildId = resolveBuildId()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exposed to the client so the dashboard can render the live build id.
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // Pin Next's build id to the same value (matches what the stamp shows).
  generateBuildId: () => buildId,

  async headers() {
    return [
      {
        // Every route EXCEPT Next's fingerprinted, already-immutable assets.
        // HTML + RSC payloads must never be cached, so a deploy is picked up
        // on the next navigation rather than served stale.
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
