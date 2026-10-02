import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addChallengeProgress, CHALLENGE_DAYS, CHALLENGE_MODELS, challengeCountdown, challengeModel, challengeProgress, challengeStatus, challengeSummary, challengeTotal, estimateChallenge, formatChallengeTime, generateChallenge, initialChallengeState, parseChallengeState, plannedSessions, startChallenge, stopChallenge, trainingDayCount, undoChallengeEntry } from '../src/lib/challenge.ts'

const now = Date.UTC(2026, 9, 3, 12)
const DAY = 86400000
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const stateWith = challenge => ({ version: 1, introSeen: true, challenges: [challenge] })

test('generation covers every duration, target count and exercise while respecting units, session caps and the time budget', () => {
  const durations = new Set(), counts = new Set(), exercises = new Set()
  const random = seeded(72625)
  for (let index = 0; index < 3000; index++) {
    const challenge = generateChallenge(now, random, `challenge-${index}`)
    durations.add(challenge.days)
    counts.add(challenge.targets.length)
    assert.equal(challenge.deadline - challenge.startedAt, challenge.days * DAY)
    assert.ok(estimateChallenge(challenge).minutes <= challenge.days * 50)
    assert.ok(estimateChallenge(challenge).minutes >= 5)
    const families = new Set()
    for (const target of challenge.targets) {
      const model = challengeModel(target.exerciseId)
      exercises.add(model.id)
      assert.ok(!families.has(model.family))
      families.add(model.family)
      assert.equal(target.sessions, plannedSessions(challenge.days, model.strength))
      assert.ok(Number.isInteger(target.amount) && target.amount > 0)
      assert.equal(target.amount % model.step, 0)
      assert.ok(target.amount <= model.sessionLimit * target.sessions)
    }
    assert.deepEqual(parseChallengeState(JSON.stringify(stateWith(challenge))), stateWith(challenge))
  }
  assert.deepEqual([...durations].sort((a, b) => a - b), [...CHALLENGE_DAYS])
  assert.deepEqual([...counts].sort(), [1, 2, 3])
  assert.equal(exercises.size, CHALLENGE_MODELS.length)
})

test('strength sessions reserve recovery days, while cardio has up to five sessions per seven days', () => {
  assert.deepEqual(CHALLENGE_DAYS.map(days => plannedSessions(days, true)), [1, 1, 3, 5, 10])
  assert.deepEqual(CHALLENGE_DAYS.map(days => plannedSessions(days, false)), [1, 2, 5, 10, 22])
})

test('time estimates apply each unit correctly and include warm-up time', () => {
  const challenge = { days: 7, targets: [{ exerciseId: 'cycling', amount: 50, sessions: 5 }, { exerciseId: 'pushup', amount: 30, sessions: 3 }, { exerciseId: 'steps', amount: 40000, sessions: 5 }] }
  const estimate = estimateChallenge(challenge)
  assert.equal(trainingDayCount(challenge), 7) // Strength and cardio days do not always coincide.
  assert.equal(estimate.minutes, 693) // 50 / .2 + 30 / 4 + 40000 / 100 + 7 * 5
  assert.equal(estimate.dailyMinutes, 99)
  assert.ok(estimate.lowMinutes < estimate.minutes && estimate.highMinutes > estimate.minutes)
  // This example exceeds the generator's weekly time cap, so it cannot be restored as a generated challenge.
  assert.equal(parseChallengeState(JSON.stringify(stateWith({ ...challenge, id: 'too-much', startedAt: now, deadline: now + 7 * DAY, entries: [] }))).challenges.length, 0)
})

test('the first-visit introduction persists and an active challenge cannot be rerolled or extended', () => {
  const initial = initialChallengeState()
  assert.equal(initial.introSeen, false)
  assert.equal(parseChallengeState(JSON.stringify({ ...initial, introSeen: true })).introSeen, true)
  const first = startChallenge(initial, now, () => 0, 'first')
  const restored = parseChallengeState(JSON.stringify(first))
  assert.equal(restored.introSeen, true)
  assert.deepEqual(restored, first)
  assert.equal(startChallenge(restored, now + 5000, () => .99, 'reroll'), restored)
  assert.equal(restored.challenges[0].deadline, now + DAY)
})

test('partial progress is additive, durable and idempotent for a repeated submission ID', () => {
  let state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  state = addChallengeProgress(state, 'first', 'pushup', 10, now + 1000, 'entry-1')
  assert.equal(challengeTotal(state.challenges[0], 'pushup'), 10)
  assert.equal(addChallengeProgress(state, 'first', 'pushup', 10, now + 1000, 'entry-1'), state)
  state = parseChallengeState(JSON.stringify(state))
  state = addChallengeProgress(state, 'first', 'pushup', 5, now + 2000, 'entry-2')
  assert.equal(challengeTotal(state.challenges[0], 'pushup'), 15)
  assert.equal(challengeStatus(state.challenges[0], now + 2000), 'active')
  assert.equal(challengeProgress(state.challenges[0]), 30)
})

test('entry validation rejects wrong units, excess, negative, non-finite and unknown values', () => {
  const state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  for (const amount of [0, -1, 1.5, Infinity, NaN, 100000, '10']) assert.throws(() => addChallengeProgress(state, 'first', 'pushup', amount, now + 1000, 'bad'))
  assert.throws(() => addChallengeProgress(state, 'first', 'unknown', 1, now + 1000, 'bad'))
  assert.throws(() => addChallengeProgress(state, 'missing', 'pushup', 1, now + 1000, 'bad'))
  assert.throws(() => addChallengeProgress(state, 'first', 'pushup', 1, now - 1, 'bad'))
})

test('kilometres accept tenths, while step counts stay exact integers', () => {
  const challenge = { id: 'mixed', days: 1, startedAt: now, deadline: now + DAY, targets: [{ exerciseId: 'cycling', amount: 3, sessions: 1 }, { exerciseId: 'steps', amount: 1000, sessions: 1 }], entries: [] }
  let state = stateWith(challenge)
  state = addChallengeProgress(state, 'mixed', 'cycling', .1, now + 1, 'cycle-1')
  state = addChallengeProgress(state, 'mixed', 'cycling', .2, now + 2, 'cycle-2')
  assert.equal(challengeTotal(state.challenges[0], 'cycling'), .3)
  assert.throws(() => addChallengeProgress(state, 'mixed', 'cycling', .25, now + 3, 'bad'))
  assert.throws(() => addChallengeProgress(state, 'mixed', 'steps', 1.5, now + 3, 'bad'))
  state = addChallengeProgress(state, 'mixed', 'steps', 999, now + 4, 'walk-1')
  assert.ok(challengeProgress(state.challenges[0]) < 100)
  assert.deepEqual(parseChallengeState(JSON.stringify(state)), state)
})

test('deadline is strict, survives reload, and blocks late or expired submissions', () => {
  let state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  const challenge = state.challenges[0]
  assert.equal(challengeStatus(challenge, challenge.deadline - 1), 'active')
  assert.equal(challengeStatus(challenge, challenge.deadline), 'expired')
  state = addChallengeProgress(state, 'first', 'pushup', 1, challenge.deadline - 1, 'last-in-time')
  assert.throws(() => addChallengeProgress(state, 'first', 'pushup', 1, challenge.deadline, 'late'))
  const restored = parseChallengeState(JSON.stringify(state))
  assert.equal(challengeStatus(restored.challenges[0], now + 2 * DAY), 'expired')
  assert.equal(challengeTotal(restored.challenges[0], 'pushup'), 1)
  const next = startChallenge(restored, now + 2 * DAY, () => .99, 'after-failure')
  assert.equal(next.challenges.length, 2)
  assert.equal(challengeStatus(next.challenges[0], now + 2 * DAY), 'expired')
  assert.equal(challengeStatus(next.challenges[1], now + 2 * DAY), 'active')
  assert.deepEqual(parseChallengeState(JSON.stringify(next)), next)
})

test('completion requires every goal, persists past expiry, and undo removes only the latest entry', () => {
  let state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  state = addChallengeProgress(state, 'first', 'pushup', 49, now + 1, 'e1')
  assert.ok(challengeProgress(state.challenges[0]) < 100)
  state = addChallengeProgress(state, 'first', 'pushup', 1, now + 2, 'e2')
  assert.equal(challengeProgress(state.challenges[0]), 100)
  assert.equal(challengeStatus(state.challenges[0], now + 2 * DAY), 'completed')
  const restored = parseChallengeState(JSON.stringify(state))
  assert.equal(challengeStatus(restored.challenges[0], now + 2 * DAY), 'completed')
  state = undoChallengeEntry(restored, 'first')
  assert.equal(challengeTotal(state.challenges[0], 'pushup'), 49)
  assert.equal(challengeStatus(state.challenges[0], now + 3), 'active')
  assert.equal(challengeStatus(state.challenges[0], now + 2 * DAY), 'expired')
})

test('stopping preserves history and allows a new challenge without resuming the old one', () => {
  let state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  state = addChallengeProgress(state, 'first', 'pushup', 10, now + 1, 'e1')
  state = stopChallenge(state, 'first', now + 2)
  assert.equal(challengeStatus(state.challenges[0], now + 3), 'stopped')
  assert.throws(() => addChallengeProgress(state, 'first', 'pushup', 1, now + 3, 'e2'))
  assert.equal(undoChallengeEntry(state, 'first'), state)
  state = startChallenge(state, now + 3, () => .99, 'second')
  assert.equal(state.challenges.length, 2)
  assert.equal(challengeTotal(state.challenges[0], 'pushup'), 10)
  assert.equal(state.challenges[1].days, 30)
  assert.deepEqual(parseChallengeState(JSON.stringify(state)), state)
})

test('malformed storage preserves valid history while rejecting duplicate, invalid and overlapping records', () => {
  for (const raw of [null, '{broken', 'null', '{"version":2}']) assert.deepEqual(parseChallengeState(raw), initialChallengeState())
  const valid = startChallenge(initialChallengeState(), now, () => 0, 'first')
  valid.challenges[0].entries = [
    { id: 'good', exerciseId: 'pushup', amount: 10, at: now + 1 },
    { id: 'good', exerciseId: 'pushup', amount: 10, at: now + 1 },
    { id: 'bad', exerciseId: 'pushup', amount: 10000, at: now + 2 },
    { id: 'late', exerciseId: 'pushup', amount: 1, at: now + DAY },
  ]
  const conflict = generateChallenge(now + 3, () => 0, 'overlap')
  const invalid = { ...conflict, id: 'invalid', targets: [{ exerciseId: 'unknown', sessions: 1, amount: 10 }] }
  const restored = parseChallengeState(JSON.stringify({ ...valid, challenges: [...valid.challenges, valid.challenges[0], conflict, invalid] }))
  assert.equal(restored.challenges.length, 1)
  assert.equal(restored.challenges[0].entries.length, 1)
  assert.equal(challengeTotal(restored.challenges[0], 'pushup'), 10)
})

test('a device clock rollback cannot create out-of-order progress or overlapping challenges', () => {
  let state = startChallenge(initialChallengeState(), now, () => 0, 'first')
  state = addChallengeProgress(state, 'first', 'pushup', 10, now + 1000, 'e1')
  assert.throws(() => addChallengeProgress(state, 'first', 'pushup', 5, now + 500, 'e2'))
  state = stopChallenge(state, 'first', now + 500)
  assert.equal(state.challenges[0].stoppedAt, now + 1000)
  assert.deepEqual(parseChallengeState(JSON.stringify(state)), state)
  assert.throws(() => startChallenge(state, now + 500, () => 0, 'second'))
})

test('time labels handle hours, long durations and expired countdowns without negative values', () => {
  assert.equal(formatChallengeTime(45), '45 мин')
  assert.equal(formatChallengeTime(90), '1 ч 30 мин')
  assert.equal(formatChallengeTime(120), '2 ч')
  assert.equal(challengeCountdown(now + DAY, now), '1 дн. 00:00:00')
  assert.equal(challengeCountdown(now + 61_000, now), '00:01:01')
  assert.equal(challengeCountdown(now - 1, now), '00:00:00')
})

test('profile counts all started challenges and only full successes, including after reload and undo', () => {
  assert.deepEqual(challengeSummary(initialChallengeState(), now), { started: 0, completed: 0 })
  let state = startChallenge(initialChallengeState(), now, () => 0, 'success')
  state = addChallengeProgress(state, 'success', 'pushup', 50, now + 1, 'e1')
  state = startChallenge(state, now + 2, () => 0, 'stopped')
  state = stopChallenge(state, 'stopped', now + 3)
  state = startChallenge(state, now + 4, () => 0, 'failure')
  state = startChallenge(state, now + 2 * DAY, () => 0, 'active')
  assert.deepEqual(challengeSummary(state, now + 2 * DAY), { started: 4, completed: 1 })
  state = parseChallengeState(JSON.stringify(state))
  assert.deepEqual(challengeSummary(state, now + 2 * DAY), { started: 4, completed: 1 })
  state = addChallengeProgress(state, 'active', 'pushup', 50, now + 2 * DAY + 1, 'e2')
  assert.deepEqual(challengeSummary(state, now + 2 * DAY + 1), { started: 4, completed: 2 })
  state = undoChallengeEntry(state, 'active')
  assert.deepEqual(challengeSummary(state, now + 2 * DAY + 2), { started: 4, completed: 1 })
})
