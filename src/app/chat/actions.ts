'use server'

import { createClient } from '@/lib/db/server'
import { setMealStatus } from '@/lib/db/meals'

async function setStatus(
  mealId: string,
  status: 'confirmed' | 'rejected',
): Promise<{ ok: boolean }> {
  if (typeof mealId !== 'string' || mealId.length === 0) return { ok: false }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    // ok ONLY if a row was actually updated (RLS + user_id scope enforce ownership).
    const updated = await setMealStatus(user.id, mealId, status)
    return { ok: updated }
  } catch (err) {
    console.error(`setStatus(${status}) failed:`, err)
    return { ok: false }
  }
}

export async function confirmMeal(mealId: string): Promise<{ ok: boolean }> {
  return setStatus(mealId, 'confirmed')
}

export async function rejectMeal(mealId: string): Promise<{ ok: boolean }> {
  return setStatus(mealId, 'rejected')
}
