"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/client";

type Mode = "signin" | "signup";

/** Maps raw Supabase auth errors to calm, non-shaming copy (pillar #7). */
function friendlyError(message: string, mode: Mode): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Give it another try.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "An account with this email already exists — try signing in instead.";
  if (m.includes("password") && m.includes("at least"))
    return "Please use a password with at least 6 characters.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "That doesn't look like a valid email address.";
  // Fall back to the raw message rather than inventing one.
  return mode === "signup"
    ? `Couldn't create your account: ${message}`
    : `Couldn't sign you in: ${message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(friendlyError(error.message, mode));
          return;
        }
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(friendlyError(error.message, mode));
          return;
        }
        // With email confirmation ON, no session is returned until the user
        // confirms. With it OFF (POC setting), a session arrives immediately.
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfo("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const isSignin = mode === "signin";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12 font-[family-name:var(--font-geist-sans)]">
      <section className="w-full max-w-md rounded-3xl border border-black/[.08] bg-white/40 p-7 shadow-sm sm:p-9 dark:border-white/[.12] dark:bg-white/[.03]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
          Bulq
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {isSignin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {isSignin
            ? "Sign in to pick up where you left off."
            : "A couple of details and you're in."}
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-black/60 dark:text-white/60">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-black/[.12] bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-black/60 dark:text-white/60">
              Password
            </span>
            <input
              type="password"
              autoComplete={isSignin ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-black/[.12] bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          {info ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-[var(--foreground)] px-4 py-3 text-base font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Just a moment…"
              : isSignin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignin ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
          className="mt-5 w-full text-center text-sm text-black/55 underline-offset-4 hover:underline dark:text-white/55"
        >
          {isSignin
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
