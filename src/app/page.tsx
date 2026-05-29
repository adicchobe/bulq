import { computeNutritionTargets, type NutritionProfile } from "@/lib/nutrition";

// HARDCODED for Sprint 1B — replaced by real profile + onboarding in 1C/1E.
const PRIMARY_USER: NutritionProfile = {
  sex: "male",
  ageYears: 26,
  heightCm: 180,
  weightKg: 54,
  activityLevel: "moderate_plus",
  goalDirection: "gain",
  ectomorphAdjustmentPct: 7,
  deltaKcal: 300,
  proteinPerKg: 1.8,
};

const kcal = (n: number) => n.toLocaleString("en-US");

export default function Home() {
  // ROUTE PROTECTION (deferred): once this page reads the real signed-in user's
  // profile (Sprint 1C/1E), gate it here — redirect to /login if no session —
  // or enable the check in src/lib/db/middleware.ts. Safe to stay public now
  // because it only renders hardcoded, non-private demo data.
  const t = computeNutritionTargets(PRIMARY_USER);

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
