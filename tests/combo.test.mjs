import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISES, beginDailyWorkout, finishExercise, getExercise, initialState, isComplete, parseState, rollWorkout, stats } from '../src/lib/workout.ts'
import { achievementCollections } from '../src/lib/achievements.ts'

const day = '2026-10-03'
const randomSequence = values => {
  let index = 0
  return () => {
    assert.ok(index < values.length, 'unexpected random draw')
    return values[index++]
  }
}
const settingsFor = (enabled, ranges = {}) => ({ enabled, ranges, sound: false })

test('three identical exercises from a pool of at least three double each independently drawn amount', () => {
  const settings = settingsFor(['squat', 'pushup', 'plank'])
  const workout = rollWorkout(settings, day, randomSequence([0, .25, 0, .25, 0, .5]))
  assert.deepEqual(workout.picks, [
    { exerciseId: 'squat', amount: 30 },
    { exerciseId: 'squat', amount: 30 },
    { exerciseId: 'squat', amount: 40 },
  ])
  assert.deepEqual(workout.combo, { multiplier: 2, poolSize: 3 })
  assert.deepEqual(workout.done, [false, false, false])
  assert.equal(settings.ranges.squat, undefined)
})

test('one or two enabled exercises cannot trigger a combo, including duplicate and invalid setting IDs', () => {
  for (const enabled of [['squat'], ['squat', 'pushup'], ['squat', 'squat', 'squat'], ['squat', 'pushup', 'unknown']]) {
    const workout = rollWorkout(settingsFor(enabled), day, () => 0)
    assert.equal(workout.combo, undefined)
    assert.ok(workout.picks.every(pick => pick.amount === 10))
  }
})

test('two matching reels and three distinct reels keep their original loads', () => {
  const settings = settingsFor(['squat', 'pushup', 'plank'])
  for (const draws of [[0, 0, 0, 0, .5, 0], [0, 0, .5, 0, .9, 0]]) {
    const workout = rollWorkout(settings, day, randomSequence(draws))
    assert.equal(workout.combo, undefined)
    assert.ok(workout.picks.every(pick => pick.amount === getExercise(pick.exerciseId).min))
  }
})

test('combo doubles repetitions, seconds, minutes and kilometres in their original units', () => {
  for (const [id, amount, unit] of [['pushup', 15, 'раз'], ['plank', 45, 'сек'], ['walk', 30, 'мин'], ['stretch', 3, 'мин'], ['cycling', 20, 'км']]) {
    const enabled = [id, ...EXERCISES.filter(exercise => exercise.id !== id).slice(0, 2).map(exercise => exercise.id)]
    const pool = EXERCISES.filter(exercise => enabled.includes(exercise.id))
    const selection = (pool.findIndex(exercise => exercise.id === id) + .1) / pool.length
    const workout = rollWorkout(settingsFor(enabled, { [id]: { min: amount, max: amount } }), day, randomSequence([selection, 0, selection, 0, selection, 0]))
    assert.equal(workout.combo.multiplier, 2)
    assert.ok(workout.picks.every(pick => pick.amount === amount * 2 && getExercise(pick.exerciseId).unit === unit))
  }
})

test('combo survives repeated reloads and settings changes without multiplying again', () => {
  let state = { ...initialState(), settings: settingsFor(['squat', 'pushup', 'plank'], { squat: { min: 300, max: 300 } }) }
  state = beginDailyWorkout(state, day, () => 0).state
  assert.ok(state.workouts[0].picks.every(pick => pick.amount === 600))
  state.settings = settingsFor(['squat'])
  for (let i = 0; i < 3; i++) state = parseState(JSON.stringify(state))
  assert.equal(state.workouts.length, 1)
  assert.equal(state.workouts[0].combo.poolSize, 3)
  assert.ok(state.workouts[0].picks.every(pick => pick.amount === 600))
  const repeated = beginDailyWorkout(state, day, () => .99)
  assert.equal(repeated.created, false)
  assert.equal(repeated.state, state)
})

test('completing combo tasks credits the displayed amount exactly once and counts one workout day', () => {
  let state = { ...initialState(), settings: settingsFor(['squat', 'pushup', 'plank'], { squat: { min: 300, max: 300 } }) }
  state = beginDailyWorkout(state, day, () => 0).state
  state = finishExercise(state, day, 0)
  assert.equal(achievementCollections(state, day).find(group => group.id === 'squat').total, 600)
  assert.equal(finishExercise(state, day, 0), state)
  state = parseState(JSON.stringify(state))
  state = finishExercise(finishExercise(state, day, 1), day, 2)
  assert.equal(achievementCollections(state, day).find(group => group.id === 'squat').total, 1800)
  assert.equal(isComplete(state.workouts[0]), true)
  assert.equal(stats(state, day).completed, 1)
})

test('combo walking doubles the planned minutes while actual step counts remain unchanged', () => {
  let state = { ...initialState(), settings: settingsFor(['walk', 'lunge', 'cycling']) }
  state = beginDailyWorkout(state, day, () => 0).state
  assert.ok(state.workouts[0].picks.every(pick => pick.exerciseId === 'walk' && pick.amount === 20))
  state = finishExercise(state, day, 0, 2100)
  assert.equal(achievementCollections(parseState(JSON.stringify(state)), day).find(group => group.id === 'steps').total, 2100)
})

test('historical identical picks do not gain a combo retroactively', () => {
  const state = initialState()
  state.workouts = [{ date: day, picks: Array.from({ length: 3 }, () => ({ exerciseId: 'squat', amount: 20 })), done: [true, false, true] }]
  const restored = parseState(JSON.stringify(state))
  assert.deepEqual(restored.workouts, state.workouts)
  assert.equal(restored.workouts[0].combo, undefined)
})

test('malformed combo data cannot authorize an oversized load', () => {
  const state = { ...initialState(), settings: settingsFor(['squat', 'pushup', 'plank'], { squat: { min: 300, max: 300 } }) }
  const valid = beginDailyWorkout(state, day, () => 0).state
  for (const combo of [undefined, { multiplier: 4, poolSize: 3 }, { multiplier: 2, poolSize: 2 }, { multiplier: 2, poolSize: 999 }]) {
    const broken = structuredClone(valid)
    broken.workouts[0].combo = combo
    assert.equal(parseState(JSON.stringify(broken)).workouts.length, 0)
  }
  const mixed = structuredClone(valid)
  mixed.workouts[0].picks[1].exerciseId = 'pushup'
  assert.equal(parseState(JSON.stringify(mixed)).workouts.length, 0)
})
