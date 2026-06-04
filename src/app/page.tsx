import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getProfile, profileToNutritionProfile } from "@/lib/db/profiles";
import { getWeightLogs, type WeightLogRow } from "@/lib/db/weight-logs";
import { computeNutritionTargets } from "@/lib/nutrition";
import { WeightLog } from "./weight-log";

const kcal = (n: number) => n.toLocaleString("en-US");

export default async function Home() {
  // ROUTE PROTECTION (now active): this page renders the user's real, private
  // profile data, so it requires a session. No user → /login; signed in but no
  // profile yet → /onboarding; otherwise compute targets from the saved profile.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");

  const t = computeNutritionTargets(profileToNutritionProfile(profile));

  // Initial weigh-ins for first paint (no loading flash). Fail-safe: a read error
  // must not 500 the whole dashboard — render with an empty list instead.
  let initialWeights: WeightLogRow[] = [];
  try {
    initialWeights = await getWeightLogs(user.id, 7);
  } catch (err) {
    console.error("dashboard: getWeightLogs failed (weight widget empty)", err);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12 font-[family-name:var(--font-geist-sans)]">
      <section className="w-full max-w-md rounded-3xl border border-black/[.08] bg-white/40 p-7 shadow-sm sm:p-9 dark:border-white/[.12] dark:bg-white/[.03]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
          Bulq
        </p>

        <h1 className="mt-2 text-lg font-medium text-black/70 dark:text-white/70">
          Your daily target
        </h1>

        {/* Hero number — the one figure the user acts on each day. */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-6xl font-semibold tabular-nums tracking-tight">
            {kcal(t.dailyTargetKcal)}
          </span>
          <span className="text-xl font-medium text-black/50 dark:text-white/50">
            kcal
          </span>
        </div>

        {/* Uncertainty range — pillar #2: never present a single false-precise number. */}
        <p className="mt-2 text-base text-black/55 dark:text-white/55">
          likely{" "}
          <span className="tabular-nums">
            {kcal(t.dailyTargetRangeKcal.low)}–{kcal(t.dailyTargetRangeKcal.high)}
          </span>{" "}
          kcal
        </p>

        <div className="my-7 h-px bg-black/[.07] dark:bg-white/[.1]" />

        <dl className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Protein" value={`${t.proteinTargetG} g`} />
          <Stat label="Maintenance" value={`${kcal(t.maintenanceTDEE)}`} unit="kcal" />
          <Stat label="BMR" value={`${kcal(t.bmr)}`} unit="kcal" />
        </dl>

        {/* Calm, non-shaming framing — pillar #7. Formula is the starting guess; the scale is the proof. */}
        <p className="mt-7 text-sm leading-relaxed text-black/45 dark:text-white/45">
          This is a starting estimate from your body data. Over the next couple of
          weeks Bulq will refine it from your real weight trend — the scale is the
          proof, the formula is just the opening guess.
        </p>

        <div className="my-7 h-px bg-black/[.07] dark:bg-white/[.1]" />

        <WeightLog initialLogs={initialWeights} goalDirection={profile.goal_direction} />

        <Link
          href="/chat"
          className="mt-7 block rounded-xl bg-[var(--foreground)] px-4 py-3 text-center text-base font-medium text-[var(--background)] transition-opacity hover:opacity-90"
        >
          Open chat
        </Link>

        <Link
          href="/usage"
          className="mt-4 block text-center text-sm text-black/45 underline-offset-4 hover:underline dark:text-white/45"
        >
          Usage &amp; budget
        </Link>

        <form action="/auth/signout" method="post" className="mt-4 text-center">
          <button
            type="submit"
            className="text-sm text-black/40 underline-offset-4 hover:underline dark:text-white/40"
          >
            Sign out
          </button>
        </form>

        {/* Build stamp — confirm which deploy is live without checking Vercel. */}
        <p className="mt-6 text-center text-[11px] tabular-nums text-black/30 dark:text-white/30">
          v.{process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
        </p>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-xs font-normal text-black/40 dark:text-white/40">
            {unit}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
