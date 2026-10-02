import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISES, beginDailyWorkout, finishExercise, initialState, isComplete, localDate, parseState, previousDay, rollWorkout, stats } from '../src/lib/workout.ts'

test('daily spin survives a storage round trip and allows the next calendar day', () => {
  const first = beginDailyWorkout(initialState(), '2026-10-03', () => 0)
  assert.equal(first.created, true)
  const restored = parseState(JSON.stringify(first.state))
  const repeated = beginDailyWorkout(restored, '2026-10-03', () => .999)
  assert.equal(repeated.created, false)
  assert.deepEqual(repeated.state.workouts, first.state.workouts)
  const next = beginDailyWorkout(restored, '2026-10-04')
  assert.equal(next.created, true)
  assert.equal(next.state.workouts.length, 2)
})

test('completion is idempotent and keeps all three picks independent, including duplicates', () => {
  const first = beginDailyWorkout(initialState(), '2026-10-03', () => 0).state
  let state = finishExercise(first, '2026-10-03', 0)
  assert.deepEqual(state.workouts[0].done, [true, false, false])
  assert.equal(finishExercise(state, '2026-10-03', 0), state)
  assert.equal(finishExercise(state, '2026-10-04', 1), state)
  assert.equal(finishExercise(state, '2026-10-03', -1), state)
  state = finishExercise(finishExercise(state, '2026-10-03', 1), '2026-10-03', 2)
  assert.equal(isComplete(state.workouts[0]), true)
  assert.deepEqual(stats(state, '2026-10-03'), { completed: 1, exercises: 3, streak: 1, best: 1 })
})

test('current streak remains through today, then resets after a missed day', () => {
  let state = initialState()
  for (const day of ['2026-09-30', '2026-10-01', '2026-10-02']) {
    state = beginDailyWorkout(state, day).state
    for (let index = 0; index < 3; index++) state = finishExercise(state, day, index)
  }
  assert.equal(stats(state, '2026-10-03').streak, 3)
  assert.equal(stats(state, '2026-10-04').streak, 0)
  assert.equal(stats(state, '2026-10-04').best, 3)
})

test('exercise pool and custom bounds are respected at both random extremes', () => {
  const settings = { ...initialState().settings, enabled: ['squat'], ranges: { squat: { min: 12, max: 24 } } }
  const low = rollWorkout(settings, '2026-10-03', () => 0)
  const high = rollWorkout(settings, '2026-10-03', () => .999999)
  assert.ok(low.picks.every(pick => pick.exerciseId === 'squat' && pick.amount === 12))
  assert.ok(high.picks.every(pick => pick.exerciseId === 'squat' && pick.amount === 22))
  assert.throws(() => rollWorkout({ ...settings, enabled: [] }, '2026-10-03'))
})

test('all default exercises roll inside their bounds with valid increments', () => {
  for (const exercise of EXERCISES) {
    const settings = { enabled: [exercise.id], ranges: {}, sound: false }
    for (let i = 0; i < 25; i++) {
      const workout = rollWorkout(settings, '2026-10-03')
      assert.equal(workout.picks.length, 3)
      for (const pick of workout.picks) {
        assert.ok(pick.amount >= exercise.min && pick.amount <= exercise.max)
        assert.equal((pick.amount - exercise.min) % exercise.step, 0)
      }
    }
  }
})

test('malformed storage is recovered and invalid exercises and records are dropped', () => {
  assert.equal(parseState('{broken').name, 'Атлет')
  assert.equal(parseState('null').version, 1)
  const state = beginDailyWorkout(initialState(), '2026-10-03').state
  const saved = { ...state, name: '  Рома  ', settings: { enabled: ['unknown'], sound: 'yes', ranges: { squat: { min: 200, max: 1 } } }, workouts: [...state.workouts, ...state.workouts, { ...state.workouts[0], date: '2026-02-31' }, { date: '2026-10-02', picks: [], done: [] }] }
  const loaded = parseState(JSON.stringify(saved))
  assert.equal(loaded.name, 'Рома')
  assert.equal(loaded.workouts.length, 1)
  assert.ok(loaded.settings.enabled.length > 0)
  assert.equal(loaded.settings.sound, false)
  assert.deepEqual(loaded.settings.ranges, {})
})

test('local calendar days work across month, leap year and year boundaries', () => {
  assert.equal(previousDay('2026-01-01'), '2025-12-31')
  assert.equal(previousDay('2024-03-01'), '2024-02-29')
  assert.equal(previousDay('2026-03-01'), '2026-02-28')
  assert.equal(localDate(new Date(2026, 9, 3, 0, 1)), '2026-10-03')
})
