import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getUsageSummary } from "@/lib/db/usage";
import {
  ANTHROPIC_BUDGET_USD,
  BUDGET_AMBER_PCT,
  BUDGET_RED_PCT,
  GEMINI_FREE_RPD_APPROX,
} from "@/lib/ai/pricing";

export default async function UsagePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const summary = await getUsageSummary(user.id);

  const pct =
    ANTHROPIC_BUDGET_USD > 0 ? summary.anthropicSpendUsd / ANTHROPIC_BUDGET_USD : 0;
  const barWidth = Math.min(100, Math.round(pct * 100));
  const barColor =
    pct >= BUDGET_RED_PCT
      ? "bg-red-500"
      : pct >= BUDGET_AMBER_PCT
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12 font-[family-name:var(--font-geist-sans)]">
      <section className="w-full max-w-md rounded-3xl border border-black/[.08] bg-white/40 p-7 shadow-sm sm:p-9 dark:border-white/[.12] dark:bg-white/[.03]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
            Bulq
          </p>
          <Link
            href="/"
            className="text-sm text-black/55 underline-offset-4 hover:underline dark:text-white/55"
          >
            Dashboard
          </Link>
        </div>

        <h1 className="mt-2 text-lg font-medium text-black/70 dark:text-white/70">
          Usage &amp; budget
        </h1>

        {/* Anthropic budget — the primary thing to watch (R3: the $4.51 balance). */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-black/60 dark:text-white/60">
              Claude (Anthropic) spend
            </span>
            <span className="text-sm tabular-nums text-black/55 dark:text-white/55">
              ${summary.anthropicSpendUsd.toFixed(2)} of ${ANTHROPIC_BUDGET_USD.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.1]">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-black/45 dark:text-white/45">
            {barWidth}% used · auto-stop at 95%
          </p>
        </div>

        {/* Gemini — free tier; honest rolling-24h count, NOT Google's quota window. */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-black/60 dark:text-white/60">
              Gemini calls — last 24h
            </span>
            <span className="text-sm tabular-nums text-black/55 dark:text-white/55">
              {summary.geminiCalls24h} / ~{GEMINI_FREE_RPD_APPROX}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-black/45 dark:text-white/45">
            Approx — your real free-tier limit is in Google AI Studio. This is a
            rolling last-24h count, not Google&apos;s midnight-Pacific quota reset.
          </p>
        </div>

        <div className="my-7 h-px bg-black/[.07] dark:bg-white/[.1]" />

        <dl className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Total calls" value={summary.totalCalls} />
          <Stat label="Failures" value={summary.failures} />
          <Stat label="Failovers" value={summary.failovers} />
        </dl>
        <p className="mt-4 text-center text-xs text-black/40 dark:text-white/40">
          lifetime
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}
