// scripts/ingest-knowledge.ts
// One-time (re-runnable) seeding of the trusted knowledge library (Sprint 3.3).
//
// Run with:  npx tsx --env-file=.env.local scripts/ingest-knowledge.ts
//
// - Chunk text = Bulq's OWN-WORDS summaries (copyright-clean, approved).
// - Provenance label = "Summarized from: <source>" (approved).
// - Embeds each chunk via the 3.2 embed() helper (text-embedding-004, 768d,
//   normalized, RETRIEVAL_DOCUMENT). FREE tier — $0.
// - Paces calls (free-tier RPM) and is IDEMPOTENT: deletes existing SYSTEM
//   chunks (user_id IS NULL) before reinserting, so re-running never duplicates.
// - Writes with the SERVICE ROLE key (bypasses RLS by design, like the foods
//   seed). Server-side only; never bundled to the client.
//
// ⚠️ Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
//    (loaded via the --env-file flag above; NOT committed).

import { createClient } from '@supabase/supabase-js'
import { embed, toPgVector } from '../src/lib/ai/embed'

// tier: 1 = ICMR-NIN, 2 = Examine/PMC study, 3 = neutral health media
type SeedChunk = {
  content: string
  source_title: string // already prefixed "Summarized from: ..."
  source_ref: string
  source_tier: 1 | 2 | 3
  evidence_grade: string
  topic: string
}

const CHUNKS: SeedChunk[] = [
  // --- Topic 1: official Indian protein baseline (ICMR-NIN) ---
  {
    content:
      "India's official protein recommendation (ICMR-NIN) for healthy adults is an RDA of 0.83 g per kg of body weight per day, with an estimated average requirement of 0.66 g/kg/day. This figure is the amount needed to prevent deficiency in a generally sedentary adult — it is a minimum for health, not a target for building muscle.",
    source_title: 'Summarized from: ICMR-NIN, Nutrient Requirements for Indians (RDA/EAR 2020)',
    source_ref: 'https://www.nin.res.in/rdabook/brief_note.pdf',
    source_tier: 1,
    evidence_grade: 'national guideline',
    topic: 'protein',
  },
  {
    content:
      "The ICMR-NIN Dietary Guidelines for Indians (2024) emphasise obtaining good-quality protein from a varied combination of everyday foods — cereals, legumes, dairy, eggs — and advise against relying on regular protein supplements to build muscle mass. The guidance favours a food-first approach to protein quality.",
    source_title: 'Summarized from: ICMR-NIN, Dietary Guidelines for Indians (2024)',
    source_ref: 'https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf',
    source_tier: 1,
    evidence_grade: 'national guideline',
    topic: 'protein',
  },

  // --- Topic 2: protein for muscle gain (Examine / Morton) ---
  {
    content:
      "Sports-nutrition research indicates that a total daily protein intake of about 1.6 to 2.2 g per kg of body weight per day is best for maximising gains in muscle size and strength during resistance training. Beyond roughly 1.6 g/kg the additional benefit diminishes, and beyond about 2.2 g/kg there is little further gain. This is a performance target for people training to build muscle, which is a different goal from the deficiency-prevention RDA.",
    source_title: 'Summarized from: Examine.com, Protein Intake guide (citing Morton et al. 2018 meta-analysis)',
    source_ref: 'https://examine.com/guides/protein-intake/',
    source_tier: 2,
    evidence_grade: 'meta-analysis / evidence review',
    topic: 'protein',
  },
  {
    content:
      "In the context of a high-protein diet (at least 1.6 g/kg/day), the source of the protein does not materially change muscle-building results: people eating vegetarian or plant-based diets do not need more total protein than meat-eaters to build muscle, provided total intake is adequate and amino-acid sources are varied across the day.",
    source_title: 'Summarized from: Examine.com, Protein Intake guide',
    source_ref: 'https://examine.com/guides/protein-intake/',
    source_tier: 2,
    evidence_grade: 'evidence review',
    topic: 'protein',
  },

  // --- Topic 3: caloric surplus for lean gain (PMC / Helms) ---
  {
    content:
      "For lean muscle gain, the evidence supports a moderate caloric surplus of roughly 200 to 500 kcal per day above maintenance. A surplus in this range supports muscle growth while limiting fat gain; substantially larger surpluses mainly add body fat rather than building muscle any faster. More experienced trainees generally do better at the lower end of this range.",
    source_title: 'Summarized from: Iraki et al. 2019, Nutrition Recommendations for Bodybuilders (Sports)',
    source_ref: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10620361/',
    source_tier: 2,
    evidence_grade: 'review / randomized trial',
    topic: 'surplus',
  },
  {
    content:
      "A sustainable rate of lean weight gain is roughly 0.25 to 0.5 percent of body weight per week. Faster gain tends to come with a higher proportion of fat. Because individual maintenance calories are only an estimate, the surplus should be adjusted based on the actual weight trend over two to three weeks rather than treated as fixed.",
    source_title: 'Summarized from: Iraki et al. 2019, Nutrition Recommendations for Bodybuilders (Sports)',
    source_ref: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10620361/',
    source_tier: 2,
    evidence_grade: 'review',
    topic: 'surplus',
  },

  // --- Topic 4: B12 & vitamin D for Indian vegetarians (PMC / SAGE) ---
  {
    content:
      "Vitamin B12 deficiency is very common among Indian vegetarians. In a study of healthy vegetarian Indian adults, around half showed biochemical B12 deficiency, and many had no outward symptoms — a 'subclinical' deficiency. Because the liver stores several years' worth of B12, the shortfall can build up silently over years before causing problems.",
    source_title: 'Summarized from: Hannibal et al. 2024, Vitamin B12 Status in Plant-Based Diets',
    source_ref: 'https://journals.sagepub.com/doi/10.1177/03795721241227233',
    source_tier: 2,
    evidence_grade: 'review of human studies',
    topic: 'b12',
  },
  {
    content:
      "B12 in a vegetarian diet comes mainly from dairy and eggs; plant foods are not a reliable source. For vegetarians who include milk, regular dairy intake can help maintain B12 status. However, because deficiency is common and often silent, the appropriate step for an individual is a blood test and, if needed, supplementation guided by a doctor — not self-prescribed dosing.",
    source_title: 'Summarized from: intervention trial on milk and B12 status in vegetarian Indians (PMC)',
    source_ref: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3851996/',
    source_tier: 2,
    evidence_grade: 'intervention trial',
    topic: 'b12',
  },
  {
    content:
      "Vitamin D deficiency is also widespread in India despite plentiful sun, partly because skin pigmentation reduces vitamin D synthesis and time outdoors is often limited. As with B12, an existing deficiency usually needs to be identified by a blood test and corrected under medical guidance rather than through diet or sun exposure alone.",
    source_title: 'Summarized from: clinical overview of vitamin D and B12 deficiency in India',
    source_ref: 'https://www.business-standard.com/health/vitamin-b12-d-deficiency-india-silent-epidemic-risks-causes-125080700963_1.html',
    source_tier: 3,
    evidence_grade: 'clinical commentary',
    topic: 'vitamin_d',
  },

  // --- Topic 5: whey concentrate vs isolate & lactose (WebMD / AND) ---
  {
    content:
      "Whey protein isolate is filtered more than whey concentrate, leaving it with under about 1 percent lactose and less fat, versus a higher lactose content in concentrate. For someone who experiences digestive discomfort with whey concentrate, isolate is the more easily tolerated option because of its lower lactose.",
    source_title: 'Summarized from: WebMD, Whey and Whey Isolate, and Academy of Nutrition and Dietetics',
    source_ref: 'https://www.webmd.com/diet/difference-whey-and-whey-isolate',
    source_tier: 3,
    evidence_grade: 'expert/clinical summary',
    topic: 'whey',
  },
  {
    content:
      "Both whey concentrate and isolate are complete proteins and, for building muscle, the difference between them is minor — total daily protein matters far more than which form is used. The practical reason to prefer isolate is digestive comfort (lower lactose), not a meaningfully better muscle result. Trying isolate, or shifting a shake to earlier in the day, is a reasonable thing to test for someone with night-time discomfort from concentrate.",
    source_title: 'Summarized from: WebMD and dietitian guidance on whey isolate vs concentrate',
    source_ref: 'https://www.webmd.com/diet/difference-whey-and-whey-isolate',
    source_tier: 3,
    evidence_grade: 'expert/clinical summary',
    topic: 'whey',
  },
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// crude pacing: free-tier RPM is small; one embed call every ~1.5s is safe.
const DELAY_MS = 1500
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    )
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  // Idempotent: clear existing SYSTEM chunks (user_id IS NULL) before reseeding.
  console.log('Clearing existing system knowledge chunks...')
  const { error: delErr } = await db.from('knowledge_chunks').delete().is('user_id', null)
  if (delErr) throw delErr

  console.log(`Embedding + inserting ${CHUNKS.length} chunks...`)
  let ok = 0
  for (let i = 0; i < CHUNKS.length; i++) {
    const chunk = CHUNKS[i]
    const vector = await embed(chunk.content, 'RETRIEVAL_DOCUMENT', chunk.source_title)
    const { error: insErr } = await db.from('knowledge_chunks').insert({
      user_id: null, // system row
      content: chunk.content,
      embedding: toPgVector(vector),
      source_title: chunk.source_title,
      source_ref: chunk.source_ref,
      source_tier: chunk.source_tier,
      evidence_grade: chunk.evidence_grade,
      topic: chunk.topic,
      token_count: Math.round(chunk.content.length / 4), // rough estimate
    })
    if (insErr) throw insErr
    ok += 1
    console.log(`  [${i + 1}/${CHUNKS.length}] ${chunk.topic} — inserted`)
    if (i < CHUNKS.length - 1) await sleep(DELAY_MS)
  }

  // Verify
  const { count } = await db
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .is('user_id', null)
  console.log(`Done. ${ok} embedded; ${count} system chunks now in the table.`)
}

main().catch((e) => {
  console.error('Ingestion failed:', e)
  process.exit(1)
})
