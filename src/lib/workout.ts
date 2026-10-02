export type Category = 'strength' | 'cardio' | 'mobility'
export type Exercise = { id: string; name: string; unit: string; min: number; max: number; step: number; category: Category; equipment?: string; tip: string }
export type Pick = { exerciseId: string; amount: number }
export type Workout = { date: string; picks: Pick[]; done: boolean[] }
export type Range = { min: number; max: number }
export type Settings = { enabled: string[]; ranges: Record<string, Range>; sound: boolean }
export type ClubState = { version: 1; name: string; joined: string; settings: Settings; workouts: Workout[] }

export const EXERCISES: Exercise[] = [
  { id: 'squat', name: 'Приседания', unit: 'раз', min: 10, max: 30, step: 5, category: 'strength', tip: 'Стопы устойчиво на полу. Двигайся плавно, в комфортной амплитуде.' },
  { id: 'pushup', name: 'Отжимания', unit: 'раз', min: 5, max: 20, step: 5, category: 'strength', tip: 'Держи корпус ровно. Можно выполнять с колен или от стены.' },
  { id: 'plank', name: 'Планка', unit: 'сек', min: 20, max: 60, step: 10, category: 'strength', tip: 'Опирайся на предплечья. Дыши спокойно и не прогибай поясницу.' },
  { id: 'walk', name: 'Ходьба', unit: 'мин', min: 10, max: 30, step: 5, category: 'cardio', tip: 'Выбери приятный маршрут и удобный темп. Можно ходить на месте.' },
  { id: 'lunge', name: 'Выпады', unit: 'раз', min: 10, max: 24, step: 2, category: 'strength', tip: 'Чередуй ноги. Число на карточке — общее количество повторений.' },
  { id: 'bicycle', name: 'Велосипед', unit: 'сек', min: 20, max: 60, step: 10, category: 'strength', tip: 'Лёжа на спине, плавно чередуй ноги. Не тяни голову руками.' },
  { id: 'stretch', name: 'Растяжка', unit: 'мин', min: 2, max: 5, step: 1, category: 'mobility', tip: 'Мягко потяни основные группы мышц без рывков и боли.' },
  { id: 'bridge', name: 'Ягодичный мост', unit: 'раз', min: 10, max: 30, step: 5, category: 'strength', tip: 'Лёжа на спине, поставь стопы на пол и плавно поднимай таз.' },
  { id: 'jack', name: 'Джампинг-джек', unit: 'раз', min: 10, max: 30, step: 5, category: 'cardio', tip: 'Приземляйся мягко. Прыжки можно заменить шагами в стороны.' },
  { id: 'climber', name: 'Скалолаз', unit: 'сек', min: 20, max: 40, step: 10, category: 'cardio', tip: 'Из упора лёжа по очереди подтягивай колени. Начни медленно.' },
  { id: 'pullup', name: 'Подтягивания', unit: 'раз', min: 2, max: 8, step: 1, category: 'strength', equipment: 'Турник', tip: 'Используй устойчивый турник. Поднимайся без раскачивания.' },
  { id: 'dip', name: 'Брусья', unit: 'раз', min: 3, max: 12, step: 1, category: 'strength', equipment: 'Брусья', tip: 'Опускайся подконтрольно, в комфортной для плеч амплитуде.' },
]

export const STORAGE_KEY = 'gym-roulette-v1'
export const CATEGORY_LABELS: Record<Category, string> = { strength: 'Сила', cardio: 'Кардио', mobility: 'Гибкость' }

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return localDate(new Date(year, month - 1, date - 1, 12))
}

export function initialState(): ClubState {
  return { version: 1, name: 'Атлет', joined: localDate(), settings: { enabled: EXERCISES.filter(e => !e.equipment).map(e => e.id), ranges: {}, sound: false }, workouts: [] }
}

export function isComplete(workout?: Workout): boolean {
  return !!workout && workout.done.length === 3 && workout.done.every(Boolean)
}

export function stats(state: ClubState, today: string) {
  const completed = state.workouts.filter(isComplete)
  const dates = new Set(completed.map(w => w.date))
  let day = dates.has(today) ? today : previousDay(today)
  let streak = 0
  while (dates.has(day)) { streak++; day = previousDay(day) }
  let best = 0
  for (const date of dates) {
    let length = 1
    let before = previousDay(date)
    while (dates.has(before)) { length++; before = previousDay(before) }
    best = Math.max(best, length)
  }
  return { completed: completed.length, exercises: state.workouts.reduce((sum, w) => sum + w.done.filter(Boolean).length, 0), streak, best }
}

export function rollWorkout(settings: Settings, date: string, random: () => number = Math.random): Workout {
  const pool = EXERCISES.filter(e => settings.enabled.includes(e.id))
  if (!pool.length) throw new Error('Выбери хотя бы одно упражнение.')
  const picks = Array.from({ length: 3 }, () => {
    const exercise = pool[Math.floor(random() * pool.length)]
    const range = settings.ranges[exercise.id] ?? exercise
    const steps = Math.floor((range.max - range.min) / exercise.step)
    const amount = range.min + Math.floor(random() * (steps + 1)) * exercise.step
    return { exerciseId: exercise.id, amount }
  })
  return { date, picks, done: [false, false, false] }
}

export function beginDailyWorkout(state: ClubState, date: string, random: () => number = Math.random): { state: ClubState; created: boolean } {
  if (state.workouts.some(workout => workout.date === date)) return { state, created: false }
  return { state: { ...state, workouts: [...state.workouts, rollWorkout(state.settings, date, random)] }, created: true }
}

export function finishExercise(state: ClubState, date: string, index: number): ClubState {
  const workout = state.workouts.find(workout => workout.date === date)
  if (!workout || !Number.isInteger(index) || index < 0 || index > 2 || workout.done[index]) return state
  return { ...state, workouts: state.workouts.map(w => w.date === date ? { ...w, done: w.done.map((done, i) => i === index || done) } : w) }
}

function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && localDate(date) === value
}

export function parseState(raw: string | null): ClubState {
  const fallback = initialState()
  if (!raw) return fallback
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1) return fallback
    const name = typeof value.name === 'string' ? value.name.trim().slice(0, 24) : ''
    const enabled = Array.isArray(value.settings?.enabled)
      ? EXERCISES.filter(e => value.settings.enabled.includes(e.id)).map(e => e.id) : fallback.settings.enabled
    const ranges: Record<string, Range> = {}
    for (const exercise of EXERCISES) {
      const range = value.settings?.ranges?.[exercise.id]
      if (range && Number.isInteger(range.min) && Number.isInteger(range.max) && range.min >= 1 && range.max <= 300 && range.min <= range.max) {
        ranges[exercise.id] = { min: range.min, max: range.max }
      }
    }
    const dates = new Set<string>()
    const workouts: Workout[] = []
    if (Array.isArray(value.workouts)) for (const w of value.workouts) {
      if (!w || !validDay(w.date) || dates.has(w.date) || !Array.isArray(w.picks) || w.picks.length !== 3 || !Array.isArray(w.done) || w.done.length !== 3) continue
      if (!w.picks.every((p: Pick) => p && EXERCISES.some(e => e.id === p.exerciseId) && Number.isInteger(p.amount) && p.amount > 0 && p.amount <= 300)) continue
      dates.add(w.date)
      workouts.push({ date: w.date, picks: w.picks.map((p: Pick) => ({ exerciseId: p.exerciseId, amount: p.amount })), done: w.done.map((d: unknown) => d === true) })
    }
    return { version: 1, name: name || fallback.name, joined: validDay(value.joined) ? value.joined : fallback.joined, settings: { enabled: enabled.length ? enabled : fallback.settings.enabled, ranges, sound: value.settings?.sound === true }, workouts }
  } catch { return fallback }
}
