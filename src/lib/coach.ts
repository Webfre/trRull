import { COACH_LINES } from '../data/coach-lines.ts'
import { localDate } from './workout.ts'

export const COACH_STORAGE_KEY = 'gym-roulette-coach-v1'
export const COACH_DAILY_LIMIT = 3
export const COACH_GOODBYE = 'Зайди позже, бро, мне надо тренироваться. Увидимся завтра!'
export const COACH_FINISHED = 'Все 200 баек рассказал! Новые повторы оставлю гантелям. А тебе — продолжать свою историю. Я в зал!'

export type CoachState = {
  version: 1
  history: { id: string; date: string }[]
  dismissedOn: string | null
  retired: boolean
}
export type CoachReply = { kind: 'line' | 'goodbye' | 'finished' | 'hidden'; state: CoachState; text: string }

export function initialCoachState(): CoachState {
  return { version: 1, history: [], dismissedOn: null, retired: false }
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && localDate(date) === value
}

export function parseCoachState(raw: string | null): CoachState {
  const initial = initialCoachState()
  if (!raw) return initial
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1) return initial
    const ids = new Set<string>(COACH_LINES.map(line => line.id))
    const seen = new Set<string>()
    const history: CoachState['history'] = []
    if (Array.isArray(value.history)) for (const entry of value.history) {
      if (!entry || !ids.has(entry.id) || seen.has(entry.id) || !validDate(entry.date)) continue
      seen.add(entry.id)
      history.push({ id: entry.id, date: entry.date })
    }
    return {
      version: 1,
      history,
      dismissedOn: validDate(value.dismissedOn) ? value.dismissedOn : null,
      retired: history.length === COACH_LINES.length && value.retired === true,
    }
  } catch { return initial }
}

export function coachCountToday(state: CoachState, date: string): number {
  return state.history.filter(entry => entry.date === date).length
}

export function isCoachHidden(state: CoachState, date: string): boolean {
  return state.retired || state.dismissedOn === date
}

export function nextCoachReply(state: CoachState, date: string, random: () => number = Math.random): CoachReply {
  if (isCoachHidden(state, date)) return { kind: 'hidden', state, text: '' }
  const seen = new Set(state.history.map(entry => entry.id))
  const remaining = COACH_LINES.filter(line => !seen.has(line.id))
  if (!remaining.length) {
    return { kind: 'finished', state: { ...state, retired: true, dismissedOn: date }, text: COACH_FINISHED }
  }
  if (coachCountToday(state, date) >= COACH_DAILY_LIMIT) {
    return { kind: 'goodbye', state: { ...state, dismissedOn: date }, text: COACH_GOODBYE }
  }
  const index = Math.min(remaining.length - 1, Math.max(0, Math.floor(random() * remaining.length)))
  const line = remaining[index]
  return {
    kind: 'line',
    state: { ...state, history: [...state.history, { id: line.id, date }] },
    text: line.text,
  }
}
