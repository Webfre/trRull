import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COACH_LINES } from '../src/data/coach-lines.ts'
import { COACH_DAILY_LIMIT, COACH_GOODBYE, coachCountToday, initialCoachState, isCoachHidden, nextCoachReply, parseCoachState } from '../src/lib/coach.ts'
import { localDate } from '../src/lib/workout.ts'

test('catalog contains exactly 200 distinct, nonempty lines with stable IDs', () => {
  assert.equal(COACH_LINES.length, 200)
  assert.equal(new Set(COACH_LINES.map(line => line.id)).size, 200)
  assert.equal(new Set(COACH_LINES.map(line => line.text)).size, 200)
  for (const line of COACH_LINES) {
    assert.match(line.id, /^coach-\d{3}$/)
    assert.ok(line.text.length >= 30 && line.text.length <= 250, line.id)
  }
})

test('three lines per day persist through reload; the fourth click says goodbye and dismisses', () => {
  let state = initialCoachState()
  for (let i = 0; i < COACH_DAILY_LIMIT; i++) {
    const reply = nextCoachReply(state, '2026-10-03', () => 0)
    assert.equal(reply.kind, 'line')
    state = parseCoachState(JSON.stringify(reply.state))
    assert.equal(coachCountToday(state, '2026-10-03'), i + 1)
    assert.equal(isCoachHidden(state, '2026-10-03'), false)
  }
  const goodbye = nextCoachReply(state, '2026-10-03')
  assert.equal(goodbye.kind, 'goodbye')
  assert.equal(goodbye.text, COACH_GOODBYE)
  state = parseCoachState(JSON.stringify(goodbye.state))
  assert.equal(state.history.length, 3)
  assert.equal(isCoachHidden(state, '2026-10-03'), true)
  const blocked = nextCoachReply(state, '2026-10-03')
  assert.equal(blocked.kind, 'hidden')
  assert.equal(blocked.state, state)
})

test('next local day restores the coach without forgetting earlier lines', () => {
  let state = initialCoachState()
  for (let i = 0; i < 4; i++) state = nextCoachReply(state, '2026-12-31', () => 0).state
  const restored = parseCoachState(JSON.stringify(state))
  assert.equal(isCoachHidden(restored, '2027-01-01'), false)
  assert.equal(coachCountToday(restored, '2027-01-01'), 0)
  const next = nextCoachReply(restored, '2027-01-01', () => 0)
  assert.equal(next.kind, 'line')
  assert.equal(next.state.history.length, 4)
  assert.equal(new Set(next.state.history.map(item => item.id)).size, 4)
})

test('midnight renews the allowance even if yesterday had no farewell click', () => {
  let state = initialCoachState()
  for (let i = 0; i < 3; i++) state = nextCoachReply(state, '2026-10-03').state
  assert.equal(state.dismissedOn, null)
  const next = nextCoachReply(state, '2026-10-04')
  assert.equal(next.kind, 'line')
  assert.equal(coachCountToday(next.state, '2026-10-04'), 1)
})

test('all 200 lines are shown once, then the coach retires without resetting history', () => {
  let state = initialCoachState()
  const shown = new Set()
  let day = ''
  for (let i = 0; i < 200; i++) {
    day = localDate(new Date(2026, 9, 3 + Math.floor(i / 3), 12))
    const reply = nextCoachReply(state, day, () => .999)
    assert.equal(reply.kind, 'line')
    assert.equal(shown.has(reply.text), false)
    shown.add(reply.text)
    state = parseCoachState(JSON.stringify(reply.state))
  }
  assert.equal(shown.size, 200)
  const exhausted = nextCoachReply(state, day)
  assert.equal(exhausted.kind, 'finished')
  const restored = parseCoachState(JSON.stringify(exhausted.state))
  assert.equal(restored.history.length, 200)
  assert.equal(restored.retired, true)
  assert.equal(nextCoachReply(restored, '2028-01-01').kind, 'hidden')
})

test('invalid storage recovers; duplicate, unknown and invalid-date entries are removed', () => {
  assert.deepEqual(parseCoachState('{bad'), initialCoachState())
  assert.deepEqual(parseCoachState('null'), initialCoachState())
  assert.deepEqual(parseCoachState(JSON.stringify({ version: 99 })), initialCoachState())
  const restored = parseCoachState(JSON.stringify({
    version: 1,
    retired: true,
    dismissedOn: '2026-02-31',
    history: [
      { id: 'coach-001', date: '2026-10-03' },
      { id: 'coach-001', date: '2026-10-04' },
      { id: 'unknown', date: '2026-10-03' },
      { id: 'coach-002', date: '2026-02-31' },
      null,
    ],
  }))
  assert.deepEqual(restored.history, [{ id: 'coach-001', date: '2026-10-03' }])
  assert.equal(restored.retired, false)
  assert.equal(restored.dismissedOn, null)
})

test('choosing a reply leaves the previous state untouched', () => {
  const state = initialCoachState()
  Object.freeze(state.history)
  Object.freeze(state)
  const reply = nextCoachReply(state, '2026-10-03')
  assert.equal(state.history.length, 0)
  assert.equal(reply.state.history.length, 1)
})
