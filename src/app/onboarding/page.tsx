import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { getProfile } from '@/lib/db/profiles'
import { OnboardingForm } from './onboarding-form'

// Server guard: must be signed in, and can't re-onboard if a profile exists.
export default async function OnboardingPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getProfile(user.id)
  if (profile) redirect('/') // already onboarded — no second pass

  return <OnboardingForm />
}
