import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

/**
 * Sign-out endpoint. POST to clear the Supabase session cookies and bounce to
 * /login. POST (not GET) so a stray link prefetch can't sign the user out.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303, // See Other — turns the POST into a GET for the redirect.
  });
}
