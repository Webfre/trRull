export const CHALLENGE_KEY = 'gym-roulette-challenges-v1'
export const CHALLENGE_DAYS = [1, 2, 7, 14, 30] as const
const DAY_MS = 86_400_000

type Model = { id: string; name: string; unit: string; family: string; strength: boolean; perMinute: number; sessionLimit: number; step: number; inputStep: number; equipment?: string }
// Game balance assumptions, including short pauses. These are not clinical exercise prescriptions.
export const CHALLENGE_MODELS: readonly Model[] = [
  { id: 'pushup', name: 'Отжимания', unit: 'раз', family: 'upper', strength: true, perMinute: 4, sessionLimit: 80, step: 10, inputStep: 1 },
  { id: 'squat', name: 'Приседания', unit: 'раз', family: 'lower', strength: true, perMinute: 8, sessionLimit: 160, step: 10, inputStep: 1 },
  { id: 'lunge', name: 'Выпады', unit: 'раз', family: 'lower', strength: true, perMinute: 6, sessionLimit: 100, step: 10, inputStep: 1 },
  { id: 'plank', name: 'Планка', unit: 'сек', family: 'core', strength: true, perMinute: 30, sessionLimit: 240, step: 30, inputStep: 1 },
  { id: 'pullup', name: 'Подтягивания', unit: 'раз', family: 'upper', strength: true, perMinute: 1.2, sessionLimit: 18, step: 2, inputStep: 1, equipment: 'Турник' },
  { id: 'dip', name: 'Брусья', unit: 'раз', family: 'upper', strength: true, perMinute: 2, sessionLimit: 36, step: 3, inputStep: 1, equipment: 'Брусья' },
  { id: 'rope', name: 'Скакалка', unit: 'раз', family: 'impact', strength: false, perMinute: 50, sessionLimit: 600, step: 50, inputStep: 1 },
  { id: 'jack', name: 'Джампинг-джек', unit: 'раз', family: 'impact', strength: false, perMinute: 25, sessionLimit: 240, step: 20, inputStep: 1 },
  { id: 'shadowbox', name: 'Бой с тенью', unit: 'сек', family: 'boxing', strength: false, perMinute: 40, sessionLimit: 600, step: 60, inputStep: 1 },
  { id: 'cycling', name: 'Велосипед', unit: 'км', family: 'cycling', strength: false, perMinute: .2, sessionLimit: 20, step: 1, inputStep: .1, equipment: 'Велосипед или велотренажёр' },
  { id: 'steps', name: 'Ходьба', unit: 'шагов', family: 'walking', strength: false, perMinute: 100, sessionLimit: 8_000, step: 500, inputStep: 1 },
]

export type ChallengeTarget = { exerciseId: string; amount: number; sessions: number }
export type ChallengeEntry = { id: string; exerciseId: string; amount: number; at: number }
export type Challenge = { id: string; startedAt: number; deadline: number; days: number; targets: ChallengeTarget[]; entries: ChallengeEntry[]; stoppedAt?: number }
export type ChallengeState = { version: 1; introSeen: boolean; challenges: Challenge[] }
export type ChallengeStatus = 'active' | 'completed' | 'expired' | 'stopped'

export function challengeModel(id: string): Model { return CHALLENGE_MODELS.find(model => model.id === id)! }
export function initialChallengeState(): ChallengeState { return { version: 1, introSeen: false, challenges: [] } }

function plannedDays(days: number, strength: boolean): number[] {
  return Array.from({ length: days }, (_, day) => day).filter(day => strength ? day % 3 === 0 : ![3, 6].includes(day % 7))
}

export function plannedSessions(days: number, strength: boolean): number { return plannedDays(days, strength).length }

export function trainingDayCount(challenge: Pick<Challenge, 'targets' | 'days'>): number {
  return new Set(challenge.targets.flatMap(target => plannedDays(challenge.days, challengeModel(target.exerciseId).strength))).size
}

export function estimateChallenge(challenge: Pick<Challenge, 'targets' | 'days'>) {
  const sessions = trainingDayCount(challenge)
  const minutes = Math.ceil(challenge.targets.reduce((sum, target) => sum + target.amount / challengeModel(target.exerciseId).perMinute, 0) + sessions * 5)
  return { minutes, dailyMinutes: Math.ceil(minutes / challenge.days), lowMinutes: Math.round(minutes * .75), highMinutes: Math.ceil(minutes * 1.25) }
}

export function generateChallenge(now: number, random: () => number = Math.random, id: string = crypto.randomUUID()): Challenge {
  const choose = <T,>(items: readonly T[]) => items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))]
  const days = choose(CHALLENGE_DAYS)
  const count = choose([1, 2, 3])
  const selected: Model[] = []
  for (let index = 0; index < count; index++) {
    const available = CHALLENGE_MODELS.filter(model => !selected.some(other => other.family === model.family))
    selected.push(choose(available))
  }
  const timeBudget = days * (30 + Math.floor(random() * 21))
  let targets = selected.map(model => {
    const sessions = plannedSessions(days, model.strength)
    const rawAmount = sessions * model.sessionLimit * (.65 + random() * .3)
    return { exerciseId: model.id, sessions, amount: Math.max(model.step, Math.floor(rawAmount / model.step) * model.step) }
  })
  const warmup = trainingDayCount({ targets, days }) * 5
  const workloadMinutes = targets.reduce((sum, target) => sum + target.amount / challengeModel(target.exerciseId).perMinute, 0)
  const scale = Math.min(1, (timeBudget - warmup) / workloadMinutes)
  targets = targets.map(target => {
    const model = challengeModel(target.exerciseId)
    return { ...target, amount: Math.max(model.step, Math.floor(target.amount * scale / model.step) * model.step) }
  })
  return { id, startedAt: now, deadline: now + days * DAY_MS, days, targets, entries: [] }
}

export function challengeTotal(challenge: Challenge, exerciseId: string): number {
  return Math.round(challenge.entries.filter(entry => entry.exerciseId === exerciseId).reduce((sum, entry) => sum + entry.amount, 0) * 10) / 10
}

export function challengeStatus(challenge: Challenge, now: number): ChallengeStatus {
  if (challenge.stoppedAt !== undefined) return 'stopped'
  if (challenge.targets.every(target => challengeTotal(challenge, target.exerciseId) >= target.amount)) return 'completed'
  return now >= challenge.deadline ? 'expired' : 'active'
}

export function challengeSummary(state: ChallengeState, now: number) {
  return { started: state.challenges.length, completed: state.challenges.filter(challenge => challengeStatus(challenge, now) === 'completed').length }
}

export function challengeProgress(challenge: Challenge): number {
  if (challenge.targets.every(target => challengeTotal(challenge, target.exerciseId) >= target.amount)) return 100
  return Math.min(99, Math.floor(challenge.targets.reduce((sum, target) => sum + Math.min(1, challengeTotal(challenge, target.exerciseId) / target.amount), 0) / challenge.targets.length * 100))
}

export function startChallenge(state: ChallengeState, now: number, random: () => number = Math.random, id?: string): ChallengeState {
  if (state.challenges.some(challenge => challengeStatus(challenge, now) === 'active')) return state
  const previous = state.challenges.at(-1)
  if (previous && now < (previous.stoppedAt ?? previous.entries.at(-1)?.at ?? previous.startedAt)) throw new Error('Проверь дату и время устройства перед новым челленджем.')
  return { ...state, introSeen: true, challenges: [...state.challenges, generateChallenge(now, random, id)] }
}

export function addChallengeProgress(state: ChallengeState, challengeId: string, exerciseId: string, amount: number, now: number, entryId: string): ChallengeState {
  const challenge = state.challenges.find(item => item.id === challengeId)
  if (!challenge || challenge !== state.challenges.at(-1)) throw new Error('Открой текущий челлендж.')
  if (challenge.entries.some(entry => entry.id === entryId)) return state
  if (challengeStatus(challenge, now) !== 'active' || now < challenge.startedAt) throw new Error('Этот челлендж уже завершён. Новые результаты не принимаются.')
  if (now < (challenge.entries.at(-1)?.at ?? challenge.startedAt)) throw new Error('Проверь дату и время устройства перед записью результата.')
  const target = challenge.targets.find(item => item.exerciseId === exerciseId)
  const model = challengeModel(exerciseId)
  if (!target || !model || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount / model.inputStep - Math.round(amount / model.inputStep)) > .000001) throw new Error('Укажи корректное количество выполненного.')
  const remaining = Math.round((target.amount - challengeTotal(challenge, exerciseId)) * 10) / 10
  if (amount > remaining) throw new Error(`До цели осталось ${remaining.toLocaleString('ru-RU')} ${model.unit}.`)
  const next = { ...challenge, entries: [...challenge.entries, { id: entryId, exerciseId, amount: Math.round(amount * 10) / 10, at: now }] }
  return { ...state, challenges: state.challenges.map(item => item.id === challengeId ? next : item) }
}

export function undoChallengeEntry(state: ChallengeState, id: string): ChallengeState {
  const current = state.challenges.at(-1)
  if (!current || current.id !== id || !current.entries.length || current.stoppedAt !== undefined) return state
  return { ...state, challenges: state.challenges.map(item => item.id === id ? { ...item, entries: item.entries.slice(0, -1) } : item) }
}

export function stopChallenge(state: ChallengeState, id: string, now: number): ChallengeState {
  return { ...state, challenges: state.challenges.map(item => item.id === id && challengeStatus(item, now) === 'active' ? { ...item, stoppedAt: Math.max(now, item.startedAt, item.entries.at(-1)?.at ?? 0) } : item) }
}

export function parseChallengeState(raw: string | null): ChallengeState {
  const initial = initialChallengeState()
  if (!raw) return initial
  try {
    const value = JSON.parse(raw)
    if (!value || value.version !== 1) return initial
    const challenges: Challenge[] = []
    const ids = new Set<string>()
    if (Array.isArray(value.challenges)) for (const item of value.challenges) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !Number.isSafeInteger(item.startedAt) || item.startedAt < 0 || item.startedAt > 8e15 || !CHALLENGE_DAYS.includes(item.days) || item.deadline !== item.startedAt + item.days * DAY_MS || !Array.isArray(item.targets) || item.targets.length < 1 || item.targets.length > 3) continue
      const families = new Set<string>()
      const valid = item.targets.every((target: ChallengeTarget) => {
        const model = target && challengeModel(target.exerciseId)
        if (!model || families.has(model.family) || target.sessions !== plannedSessions(item.days, model.strength) || !Number.isInteger(target.amount) || target.amount < model.step || target.amount % model.step !== 0 || target.amount > target.sessions * model.sessionLimit) return false
        families.add(model.family)
        return true
      })
      if (!valid || estimateChallenge(item).minutes > item.days * 50) continue
      const challenge: Challenge = { id: item.id, startedAt: item.startedAt, deadline: item.deadline, days: item.days, targets: item.targets.map((target: ChallengeTarget) => ({ exerciseId: target.exerciseId, amount: target.amount, sessions: target.sessions })), entries: [] }
      const entryIds = new Set<string>()
      if (Array.isArray(item.entries)) for (const entry of item.entries) {
        if (!entry || typeof entry.id !== 'string' || !entry.id || entryIds.has(entry.id) || !Number.isSafeInteger(entry.at) || entry.at < item.startedAt || entry.at >= item.deadline || (challenge.entries.at(-1)?.at ?? 0) > entry.at) continue
        try {
          const temporary: ChallengeState = { ...initial, challenges: [challenge] }
          challenge.entries = addChallengeProgress(temporary, item.id, entry.exerciseId, entry.amount, entry.at, entry.id).challenges[0].entries
          entryIds.add(entry.id)
        } catch { /* Ignore an invalid progress record, keeping the valid challenge and earlier entries. */ }
      }
      if (Number.isSafeInteger(item.stoppedAt) && item.stoppedAt >= item.startedAt && item.stoppedAt < item.deadline) {
        challenge.stoppedAt = item.stoppedAt
        challenge.entries = challenge.entries.filter(entry => entry.at <= item.stoppedAt)
      }
      ids.add(item.id)
      challenges.push(challenge)
    }
    challenges.sort((a, b) => a.startedAt - b.startedAt)
    const sequential: Challenge[] = []
    for (const challenge of challenges) {
      const previous = sequential.at(-1)
      const endedAt = previous ? previous.stoppedAt ?? (challengeStatus(previous, previous.deadline) === 'completed' ? previous.entries.at(-1)!.at : previous.deadline) : 0
      if (challenge.startedAt >= endedAt) sequential.push(challenge)
    }
    return { version: 1, introSeen: value.introSeen === true || sequential.length > 0, challenges: sequential }
  } catch { return initial }
}

export function formatChallengeTime(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  return hours ? `${hours} ч${rounded % 60 ? ` ${rounded % 60} мин` : ''}` : `${rounded} мин`
}

export function challengeCountdown(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  const days = Math.floor(seconds / 86400)
  const time = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':')
  return `${days ? `${days} дн. ` : ''}${time}`
}
