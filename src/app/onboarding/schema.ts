import { z } from 'zod'

/**
 * Onboarding input contract. Lives in a plain module (not the 'use server'
 * action file) so both the client form and the server action can import it.
 */
export const OnboardingSchema = z.object({
  sex: z.enum(['male', 'female']),
  ageYears: z.number().int().min(1).max(120),
  heightCm: z.number().positive().max(300),
  currentWeightKg: z.number().positive().max(500),
  goalWeightKg: z.number().positive().max(500),
  goalDirection: z.enum(['gain', 'lose', 'maintain']),
  goalRatePctPerWeek: z.number().min(0).max(5),
  activityLevel: z.enum([
    'sedentary',
    'light',
    'moderate',
    'moderate_plus',
    'active',
    'very_active',
  ]),
  trainingDaysPerWeek: z.number().int().min(0).max(7),
  dietaryPattern: z.string().min(1).max(100),
  chickenMaxPerWeek: z.number().int().min(0).max(21),
  sleepAvgHours: z.number().min(0).max(24),
})

export type OnboardingInput = z.infer<typeof OnboardingSchema>
