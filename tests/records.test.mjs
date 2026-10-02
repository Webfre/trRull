import { test } from 'node:test'
import assert from 'node:assert/strict'
import { achievementCollections, achievementSummary, SINGLE_MILESTONES } from '../src/lib/achievements.ts'
import { finishExercise, initialState, localDate, parseState } from '../src/lib/workout.ts'

const day = localDate()
const pending = (id = 'pushup', amount = 50) => ({ ...initialState(), workouts: [{ date: day, picks: [{ exerciseId: id, amount }, { exerciseId: id, amount }, { exerciseId: 'stretch', amount: 2 }], done: [false, false, false] }] })
const group = (state, id, mode = 'single') => achievementCollections(state, day, mode).find(item => item.id === id)

test('single-session mode has 121 separate awards, unit-specific scales and no streak or stretching duplicates', () => {
  const state = initialState()
  const totals = achievementCollections(state, day)
  const single = achievementCollections(state, day, 'single')
  assert.equal(achievementSummary(single).total, 121)
  assert.equal(achievementSummary([...totals, ...single]).total, 245)
  assert.equal(new Set([...totals, ...single].flatMap(item => item.badges.map(badge => badge.id))).size, 245)
  assert.ok(single.every(item => !['walk', 'stretch', 'streak'].includes(item.id)))
  assert.deepEqual(group(state, 'pushup').badges.map(item => item.target), [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100])
  assert.equal(group(state, 'plank').badges.at(-1).target, 360)
  assert.equal(group(state, 'squat').badges.at(-1).target, 150)
  assert.deepEqual(group(state, 'cycling').badges.map(badge => badge.target), [5, 10, 20, 30, 40, 50, 60, 75, 100, 125, 150])
  assert.deepEqual(group(state, 'pullup').badges.map(badge => badge.target), [5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50])
  assert.deepEqual(group(state, 'steps').badges.map(badge => badge.target), [2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000])
  for (const collection of single) {
    assert.ok(collection.badges.every(badge => badge.mode === 'single'))
    assert.equal(collection.badges[0].tier, 0)
    assert.equal(collection.badges.at(-1).tier, 10)
    assert.equal(collection.total, 0)
  }
})

test('a record is the largest confirmed set, never the sum of repeated exercises', () => {
  let state = finishExercise(pending(), day, 0, undefined, 20)
  state = finishExercise(state, day, 1, undefined, 30)
  assert.equal(group(state, 'pushup').total, 30)
  assert.equal(group(state, 'pushup', 'total').total, 100)
  assert.equal(group(state, 'pushup').badges.find(badge => badge.target === 30).unlocked, true)
  assert.equal(group(state, 'pushup').badges.find(badge => badge.target === 40).unlocked, false)
  assert.equal(finishExercise(state, day, 1, undefined, 50), state)
  assert.deepEqual(parseState(JSON.stringify(state)), state)
  state.settings.ranges.pushup = { min: 1, max: 5 }
  assert.equal(group(state, 'pushup').total, 30)
})

test('old or unconfirmed completions still count toward totals without inventing a single-set record', () => {
  let state = pending()
  state.workouts[0].picks[0].bestSet = 45
  assert.equal(group(state, 'pushup').total, 0)
  state = parseState(JSON.stringify(state))
  assert.equal(state.workouts[0].picks[0].bestSet, undefined)
  state = finishExercise(state, day, 0)
  assert.equal(group(state, 'pushup').total, 0)
  assert.equal(group(state, 'pushup', 'total').total, 50)
  assert.equal(group(parseState(JSON.stringify(state)), 'pushup').total, 0)
})

test('each single-set milestone unlocks at the exact threshold and survives reload', () => {
  for (const [id, milestones] of Object.entries(SINGLE_MILESTONES)) {
    for (const target of milestones) {
      const isSteps = id === 'steps'
      const state = pending(isSteps ? 'walk' : id, isSteps ? 30 : target)
      const below = isSteps ? finishExercise(state, day, 0, target - 1) : target > 1 ? finishExercise(state, day, 0, undefined, target - 1) : finishExercise(state, day, 0)
      assert.equal(group(below, id).badges.find(badge => badge.target === target).unlocked, false)
      if (!isSteps && target > 300) state.workouts[0].combo = { multiplier: 2, poolSize: 3 }
      if (!isSteps && target > 300) state.workouts[0].picks = Array.from({ length: 3 }, () => ({ exerciseId: id, amount: target }))
      const achieved = parseState(JSON.stringify(isSteps ? finishExercise(state, day, 0, target) : finishExercise(state, day, 0, undefined, target)))
      assert.equal(group(achieved, id).badges.find(badge => badge.target === target).unlocked, true, `${id}: ${target}`)
    }
  }
})

test('combo doubles the task, while the explicitly confirmed record is counted once', () => {
  let state = pending('pushup', 100)
  state.workouts[0].picks = Array.from({ length: 3 }, () => ({ exerciseId: 'pushup', amount: 100 }))
  state.workouts[0].combo = { multiplier: 2, poolSize: 3 }
  state = finishExercise(state, day, 0, undefined, 25)
  state = finishExercise(state, day, 1, undefined, 40)
  state = finishExercise(state, day, 2, undefined, 30)
  state = parseState(JSON.stringify(state))
  assert.equal(group(state, 'pushup').total, 40)
  assert.equal(group(state, 'pushup', 'total').total, 300)
})

test('records reject invalid values and preserve fractional kilometres without converting units', () => {
  const state = pending()
  for (const value of [-1, 0, 51, 1.5, Infinity, NaN, '20']) assert.equal(finishExercise(state, day, 0, undefined, value), state)
  let cycling = finishExercise(pending('cycling', 20), day, 0, undefined, 12.5)
  cycling = parseState(JSON.stringify(cycling))
  assert.equal(group(cycling, 'cycling').total, 12.5)
  assert.equal(group(cycling, 'cycling').unit, 'км')
  assert.equal(finishExercise(pending('cycling', 20), day, 0, undefined, 12.55).workouts[0].done[0], false)
  for (const value of [-1, 51, 1.5, '20']) {
    const bad = pending()
    bad.workouts[0].done[0] = true
    bad.workouts[0].picks[0].bestSet = value
    const restored = parseState(JSON.stringify(bad))
    assert.equal(group(restored, 'pushup').total, 0)
    assert.equal(group(restored, 'pushup', 'total').total, 50)
  }
})

test('steps use the longest recorded walk rather than adding walks into a single record', () => {
  let state = finishExercise(pending('walk', 30), day, 0, 2500)
  state = finishExercise(state, day, 1, 3200)
  assert.equal(group(state, 'steps').total, 3200)
  assert.equal(group(state, 'steps', 'total').total, 5700)
})

test('old mute preferences no longer affect saved settings', () => {
  for (const sound of [true, false]) {
    const state = initialState()
    state.settings.sound = sound
    assert.equal('sound' in parseState(JSON.stringify(state)).settings, false)
  }
})
