import { isComplete, type ClubState } from './workout.ts'

export function daysBetween(from: string, to: string): number {
  const stamp = (day: string) => { const [year, month, date] = day.split('-').map(Number); return Date.UTC(year, month - 1, date) }
  return Math.round((stamp(to) - stamp(from)) / 86_400_000)
}

export function attendanceSummary(state: ClubState, today: string) {
  const startedOn = [state.joined, today, ...state.workouts.map(workout => workout.date)].sort()[0]
  const pastDays = Math.max(0, daysBetween(startedOn, today))
  const completeDates = new Set(state.workouts.filter(workout => isComplete(workout) && workout.date >= startedOn && workout.date <= today).map(workout => workout.date))
  const pastCompleted = [...completeDates].filter(date => date < today).length
  const missed = Math.max(0, pastDays - pastCompleted)
  const missedPercent = pastDays ? Math.round(missed / pastDays * 1000) / 10 : 0
  const completed = completeDates.size
  const todayComplete = completeDates.has(today)
  const verdict = !pastDays ? 'СТАРТ ПРИНЯТ' : missedPercent <= 15 ? 'ТЕМП ОК' : missedPercent <= 40 ? 'МОЖНО РОВНЕЕ' : 'РИТМ СБИЛСЯ'
  const motivation = !pastDays
    ? todayComplete ? 'Первая тренировка закрыта. Увидимся завтра.' : 'Первая галочка ждёт. Начнём спокойно.'
    : missedPercent <= 15 ? 'Держишь ритм. Продолжай в том же духе.'
    : todayComplete ? 'Сегодня уже вернулся в дело. Завтра продолжай.' : 'Без самокритики. Начни с сегодняшней тренировки.'
  return { startedOn, pastDays, elapsedDays: pastDays + 1, completed, missed, missedPercent, verdict, motivation }
}
