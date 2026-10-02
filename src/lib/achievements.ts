import { EXERCISES, stats, type ClubState } from './workout.ts'

export const EXERCISE_MILESTONES = [50, 100, 200, 300, 400, 500, 1_000, 3_000, 5_000, 10_000, 30_000] as const
export const CYCLING_MILESTONES = [5, 10, 30, 50, 100, 500, 1_000] as const
export const ACHIEVEMENT_EXERCISES = EXERCISES.filter(exercise => !['walk', 'stretch'].includes(exercise.id))
export const STREAK_MILESTONES = [3, 5, 10, 20, 30, 60, 90] as const
export const STEP_MILESTONES = [1_000, 3_000, 5_000, 10_000, 30_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000] as const
// Game milestones for one confirmed set, hold, round, ride or walk; not exercise prescriptions.
export const SINGLE_MILESTONES: Record<string, readonly number[]> = {
  pushup: [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100],
  squat: [10, 15, 20, 30, 40, 50, 60, 75, 100, 125, 150],
  plank: [20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360],
  lunge: [10, 16, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  cycling: [5, 10, 20, 30, 40, 50, 60, 75, 100, 125, 150],
  rope: [20, 40, 60, 80, 100, 150, 200, 250, 300, 400, 500],
  jack: [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200],
  shadowbox: [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 600],
  pullup: [5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  dip: [3, 5, 8, 10, 12, 15, 20, 25, 30, 40, 50],
  steps: [2_000, 3_000, 5_000, 7_500, 10_000, 15_000, 20_000, 30_000, 50_000, 75_000, 100_000],
}
export type AchievementMode = 'total' | 'single'
export const RARITIES = ['Железо I', 'Железо II', 'Бронза I', 'Бронза II', 'Серебро I', 'Серебро II', 'Золото I', 'Золото II', 'Эпическое', 'Мастерское', 'Легендарное'] as const

export type Achievement = { id: string; groupId: string; name: string; target: number; total: number; unit: string; tier: number; unlocked: boolean; mode: AchievementMode }
export type AchievementCollection = { id: string; name: string; unit: string; total: number; badges: Achievement[] }

function collection(id: string, name: string, unit: string, total: number, milestones: readonly number[], mode: AchievementMode = 'total'): AchievementCollection {
  return {
    id, name, unit, total,
    badges: milestones.map((target, index) => ({
      id: `${mode === 'single' ? 'single-' : ''}${id}-${target}`, groupId: id, name, target, total, unit, mode,
      tier: Math.round(index * (RARITIES.length - 1) / (milestones.length - 1)),
      unlocked: total >= target,
    })),
  }
}

export function achievementCollections(state: ClubState, today: string, mode: AchievementMode = 'total'): AchievementCollection[] {
  const totals = new Map(EXERCISES.map(exercise => [exercise.id, 0]))
  let steps = 0
  for (const workout of state.workouts) {
    workout.picks.forEach((pick, index) => {
      if (!workout.done[index]) return
      if (totals.has(pick.exerciseId)) totals.set(pick.exerciseId, mode === 'single' ? Math.max(totals.get(pick.exerciseId)!, pick.bestSet ?? 0) : totals.get(pick.exerciseId)! + pick.amount)
      if (pick.exerciseId === 'walk') steps = mode === 'single' ? Math.max(steps, pick.steps ?? 0) : steps + (pick.steps ?? 0)
    })
  }
  return [
    ...(mode === 'total' ? [collection('streak', 'Ударная серия', 'дней', stats(state, today).best, STREAK_MILESTONES)] : []),
    ...ACHIEVEMENT_EXERCISES.map(exercise => collection(exercise.id, exercise.name, exercise.unit, totals.get(exercise.id)!, mode === 'single' ? SINGLE_MILESTONES[exercise.id] : exercise.id === 'cycling' ? CYCLING_MILESTONES : EXERCISE_MILESTONES, mode)),
    collection('steps', mode === 'single' ? 'Шаги за прогулку' : 'Пройдено шагов', 'шагов', steps, mode === 'single' ? SINGLE_MILESTONES.steps : STEP_MILESTONES, mode),
  ]
}

export function achievementSummary(collections: AchievementCollection[]) {
  const badges = collections.flatMap(group => group.badges)
  return { unlocked: badges.filter(badge => badge.unlocked).length, total: badges.length }
}
