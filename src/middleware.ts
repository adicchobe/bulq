import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/db/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on every request path except static assets and image files, which
     * never carry an auth session and would only waste invocations.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
