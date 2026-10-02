import { EXERCISES, stats, type ClubState } from './workout.ts'

export const EXERCISE_MILESTONES = [50, 100, 200, 300, 400, 500, 1_000, 3_000, 5_000, 10_000, 30_000] as const
export const CYCLING_MILESTONES = [5, 10, 30, 50, 100, 500, 1_000] as const
export const ACHIEVEMENT_EXERCISES = EXERCISES.filter(exercise => !['walk', 'stretch'].includes(exercise.id))
export const STREAK_MILESTONES = [3, 5, 10, 20, 30, 60, 90] as const
export const STEP_MILESTONES = [1_000, 3_000, 5_000, 10_000, 30_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000] as const
export const RARITIES = ['Железо I', 'Железо II', 'Бронза I', 'Бронза II', 'Серебро I', 'Серебро II', 'Золото I', 'Золото II', 'Эпическое', 'Мастерское', 'Легендарное'] as const

export type Achievement = { id: string; groupId: string; name: string; target: number; total: number; unit: string; tier: number; unlocked: boolean }
export type AchievementCollection = { id: string; name: string; unit: string; total: number; badges: Achievement[] }

function collection(id: string, name: string, unit: string, total: number, milestones: readonly number[]): AchievementCollection {
  return {
    id, name, unit, total,
    badges: milestones.map((target, index) => ({
      id: `${id}-${target}`, groupId: id, name, target, total, unit,
      tier: Math.round(index * (RARITIES.length - 1) / (milestones.length - 1)),
      unlocked: total >= target,
    })),
  }
}

export function achievementCollections(state: ClubState, today: string): AchievementCollection[] {
  const totals = new Map(EXERCISES.map(exercise => [exercise.id, 0]))
  let steps = 0
  for (const workout of state.workouts) {
    workout.picks.forEach((pick, index) => {
      if (!workout.done[index]) return
      if (totals.has(pick.exerciseId)) totals.set(pick.exerciseId, totals.get(pick.exerciseId)! + pick.amount)
      if (pick.exerciseId === 'walk') steps += pick.steps ?? 0
    })
  }
  return [
    ...ACHIEVEMENT_EXERCISES.map(exercise => collection(exercise.id, exercise.name, exercise.unit, totals.get(exercise.id)!, exercise.id === 'cycling' ? CYCLING_MILESTONES : EXERCISE_MILESTONES)),
    collection('streak', 'Ударная серия', 'дней', stats(state, today).best, STREAK_MILESTONES),
    collection('steps', 'Пройдено шагов', 'шагов', steps, STEP_MILESTONES),
  ]
}

export function achievementSummary(collections: AchievementCollection[]) {
  const badges = collections.flatMap(group => group.badges)
  return { unlocked: badges.filter(badge => badge.unlocked).length, total: badges.length }
}
