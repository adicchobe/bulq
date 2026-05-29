import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Refreshes the Supabase auth session on every request and writes the rotated
 * cookies onto the outgoing response. Without this, an expired access token is
 * never renewed and the user is silently signed out between page loads.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not insert logic between client creation and getUser(): this call is what
  // performs the token refresh, and reordering it can desync the cookie writes.
  await supabase.auth.getUser()

  // Route protection (redirect unauthenticated users to a sign-in page) gets
  // wired in here once the auth pages land in Sprint 1. For now we only refresh.

  return supabaseResponse
}
