import { test } from 'node:test'
import assert from 'node:assert/strict'
import { achievementCollections, achievementSummary, CYCLING_MILESTONES, EXERCISE_MILESTONES } from '../src/lib/achievements.ts'
import { attendanceSummary, daysBetween } from '../src/lib/attendance.ts'
import { CLUB_LEVELS, clubLevel } from '../src/lib/levels.ts'
import { CYCLING_DISTANCES, EXERCISES, finishExercise, getExercise, initialState, localDate, parseState, previousDay, rollWorkout, stats } from '../src/lib/workout.ts'

const today = localDate()
const workout = (date, ids = ['pushup', 'pushup', 'plank'], amounts = [30, 20, 60], done = [true, true, true]) => ({ date, picks: ids.map((exerciseId, i) => ({ exerciseId, amount: amounts[i] })), done })
const stateWith = (workouts = [], joined = '2026-09-01') => ({ ...initialState(), joined, workouts })
const group = (state, id) => achievementCollections(state, today).find(item => item.id === id)

test('124 badges cover ten exercises, streaks and steps; walking and stretching have no duplicate awards', () => {
  const collections = achievementCollections(initialState(), today)
  assert.equal(achievementSummary(collections).total, 124)
  assert.equal(achievementSummary(collections).unlocked, 0)
  assert.equal(collections.length, 12)
  assert.ok(!collections.some(item => ['walk', 'stretch', 'bridge', 'climber', 'bicycle'].includes(item.id)))
  assert.deepEqual(group(initialState(), 'pushup').badges.map(item => item.target), [50, 100, 200, 300, 400, 500, 1000, 3000, 5000, 10000, 30000])
  assert.deepEqual(group(initialState(), 'cycling').badges.map(item => item.target), [5, 10, 30, 50, 100, 500, 1000])
  assert.deepEqual(group(initialState(), 'streak').badges.map(item => item.target), [3, 5, 10, 20, 30, 60, 90])
  assert.equal(new Set(collections.flatMap(item => item.badges.map(badge => badge.id))).size, 124)
  for (const collection of collections) {
    assert.equal(collection.badges[0].tier, 0)
    assert.equal(collection.badges.at(-1).tier, 10)
  }
})

test('only completed picks count, duplicate exercises add separately, seconds never become repetitions', () => {
  let state = stateWith([workout(today, undefined, undefined, [true, false, true])])
  assert.equal(group(state, 'pushup').total, 30)
  assert.equal(group(state, 'pushup').badges[0].unlocked, false)
  assert.equal(group(state, 'plank').total, 60)
  assert.equal(group(state, 'plank').unit, 'сек')
  state = finishExercise(state, today, 1)
  assert.equal(group(state, 'pushup').total, 50)
  assert.equal(group(state, 'pushup').badges[0].unlocked, true)
  assert.equal(group(state, 'pushup').badges[1].unlocked, false)
})

test('each milestone unlocks at its boundary and earned badges survive storage reloads', () => {
  for (const [id, milestones, unit] of [['pushup', EXERCISE_MILESTONES, 'раз'], ['cycling', CYCLING_MILESTONES, 'км']]) {
    for (const threshold of milestones) {
      const records = []
      let remaining = threshold - 1
      let day = today
      while (remaining > 0) {
        const amount = Math.min(300, remaining)
        records.push(workout(day, [id, 'stretch', 'walk'], [amount, 2, 10], [true, false, false]))
        remaining -= amount
        day = previousDay(day)
      }
      records.push(workout(day, [id, 'stretch', 'walk'], [1, 2, 10], [false, false, false]))
      let state = stateWith(records)
      assert.equal(group(state, id).badges.find(item => item.target === threshold).unlocked, false)
      state = parseState(JSON.stringify(finishExercise(state, day, 0)))
      assert.equal(group(state, id).badges.find(item => item.target === threshold).unlocked, true)
      assert.equal(group(state, id).total, threshold)
      assert.equal(group(state, id).unit, unit)
    }
  }
})

test('walking minutes never invent steps; manual steps persist and cannot be counted twice', () => {
  let state = stateWith([workout(today, ['walk', 'walk', 'squat'], [30, 10, 20], [false, false, false])])
  state = finishExercise(state, today, 0, 2100)
  state = parseState(JSON.stringify(state))
  assert.equal(group(state, 'steps').total, 2100)
  assert.equal(finishExercise(state, today, 0, 9000), state)
  state = finishExercise(state, today, 1)
  assert.equal(group(state, 'steps').total, 2100)
  state = finishExercise(state, today, 2, 5000)
  assert.equal(group(state, 'steps').total, 2100)
  assert.equal(state.workouts[0].picks[2].steps, undefined)
})

test('invalid step values are rejected without marking the walk done', () => {
  const state = stateWith([workout(today, ['walk', 'walk', 'walk'], [10, 10, 10], [false, false, false])])
  for (const steps of [-1, 1.5, NaN, Infinity, 100001]) assert.equal(finishExercise(state, today, 0, steps), state)
  assert.equal(finishExercise(state, today, 0, 0).workouts[0].done[0], true)
  const corrupt = structuredClone(state)
  corrupt.workouts[0].picks.forEach((pick, index) => { pick.steps = [-20, 2.5, 200000][index] })
  assert.ok(parseState(JSON.stringify(corrupt)).workouts[0].picks.every(pick => pick.steps === undefined))
})

test('best streak achievements remain earned after the current streak breaks', () => {
  const state = stateWith(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'].map(day => workout(day)))
  const collection = achievementCollections(state, '2026-09-10').find(item => item.id === 'streak')
  assert.equal(stats(state, '2026-09-10').streak, 0)
  assert.deepEqual(collection.badges.filter(item => item.unlocked).map(item => item.target), [3, 5])
})

test('new exercises migrate settings and today’s uncompleted picks without rewriting completed history', () => {
  const state = stateWith([
    workout(previousDay(today), ['bridge', 'climber', 'bicycle'], [20, 30, 60], [true, false, true]),
    workout(today, ['bridge', 'climber', 'bicycle'], [20, 20, 60], [true, false, false]),
  ])
  state.settings = { enabled: ['bridge', 'climber', 'bicycle', 'pushup'], ranges: { bridge: { min: 10, max: 15 }, bicycle: { min: 20, max: 60 }, pushup: { min: 10, max: 25 } }, sound: true }
  const restored = parseState(JSON.stringify(state))
  assert.ok(['rope', 'shadowbox', 'cycling', 'pushup'].every(id => restored.settings.enabled.includes(id)))
  assert.deepEqual(restored.settings.ranges, { pushup: { min: 10, max: 25 } })
  assert.deepEqual(restored.workouts[0], state.workouts[0])
  assert.deepEqual(restored.workouts[1].picks, [{ exerciseId: 'bridge', amount: 20 }, { exerciseId: 'shadowbox', amount: 30 }, { exerciseId: 'cycling', amount: 1 }])
  assert.equal(group(restored, 'cycling').total, 0)
  assert.equal(group(restored, 'rope').total, 0)
  assert.equal(group(restored, 'shadowbox').total, 0)
  assert.equal(getExercise('bicycle').unit, 'сек')
  assert.equal(getExercise('cycling').unit, 'км')
  assert.ok(!EXERCISES.some(item => ['bridge', 'climber', 'bicycle'].includes(item.id)))
  assert.deepEqual(parseState(JSON.stringify(restored)), restored)
})

test('cycling draws only 1, 5, 10 or 20 km and respects the selected distance range', () => {
  const settings = { enabled: ['cycling'], ranges: {}, sound: false }
  const seen = new Set()
  for (const draw of [0, .25, .5, .99999]) {
    for (const pick of rollWorkout(settings, today, () => draw).picks) seen.add(pick.amount)
  }
  assert.deepEqual([...seen], [...CYCLING_DISTANCES])
  settings.ranges.cycling = { min: 5, max: 10 }
  assert.ok(rollWorkout(settings, today, () => 0).picks.every(pick => pick.amount === 5))
  assert.ok(rollWorkout(settings, today, () => .99999).picks.every(pick => pick.amount === 10))
  const state = { ...initialState(), settings: { ...settings, ranges: { cycling: { min: 2, max: 7 } } } }
  assert.deepEqual(parseState(JSON.stringify(state)).settings.ranges, {})
})

test('20 unique club ranks require completed workout days, with level 20 starting exactly at 365', () => {
  assert.equal(CLUB_LEVELS.length, 20)
  assert.equal(new Set(CLUB_LEVELS.map(level => level.nickname)).size, 20)
  assert.equal(clubLevel(-10).current.level, 1)
  assert.equal(clubLevel(364).current.level, 19)
  assert.equal(clubLevel(365).current.level, 20)
  assert.equal(clubLevel(500).current.level, 20)
  assert.equal(clubLevel(365).next, undefined)
  assert.equal(clubLevel(365).progress, 100)
  for (const level of CLUB_LEVELS.slice(1)) {
    assert.equal(clubLevel(level.days).current.level, level.level)
    assert.equal(clubLevel(level.days - 1).current.level, level.level - 1)
    assert.equal(clubLevel(level.days - 1).remaining, 1)
  }
  const records = []
  let day = today
  for (let i = 0; i < 365; i++) { records.push(workout(day, undefined, undefined, [true, true, false])); day = previousDay(day) }
  assert.equal(clubLevel(stats(stateWith(records), today).completed).current.level, 1)
  records.forEach(record => { record.done[2] = true })
  assert.equal(clubLevel(stats(stateWith(records), today).completed).current.level, 20)
})

test('first visit has zero missed days, including when today’s workout is incomplete', () => {
  const state = stateWith([workout('2026-10-03', undefined, undefined, [true, false, false])], '2026-10-03')
  const summary = attendanceSummary(state, '2026-10-03')
  assert.equal(summary.startedOn, '2026-10-03')
  assert.equal(summary.missed, 0)
  assert.equal(summary.missedPercent, 0)
  assert.equal(summary.completed, 0)
  assert.equal(summary.elapsedDays, 1)
  assert.equal(summary.verdict, 'СТАРТ ПРИНЯТ')
  assert.equal(attendanceSummary(state, '2026-10-04').missed, 1)
})

test('calendar counts past partial days as missed, excludes today and future records from misses', () => {
  const state = stateWith([
    workout('2026-10-01'),
    workout('2026-10-02', undefined, undefined, [true, true, false]),
    workout('2026-10-03'),
    workout('2026-10-04'),
  ], '2026-10-01')
  const summary = attendanceSummary(state, '2026-10-03')
  assert.equal(summary.completed, 2)
  assert.equal(summary.missed, 1)
  assert.equal(summary.pastDays, 2)
  assert.equal(summary.missedPercent, 50)
  assert.equal(summary.verdict, 'РИТМ СБИЛСЯ')
  assert.equal(attendanceSummary(state, '2026-10-04').missedPercent, 33.3)
  assert.match(summary.motivation, /Сегодня уже вернулся/)
})

test('saved first-visit date survives reload, and older workout history repairs a missing start date', () => {
  const state = stateWith([], '2026-01-01')
  const restored = parseState(JSON.stringify(state))
  assert.equal(restored.joined, '2026-01-01')
  assert.equal(attendanceSummary(restored, '2026-01-04').missed, 3)
  assert.equal(attendanceSummary(restored, '2026-01-04').missedPercent, 100)
  assert.equal(parseState(JSON.stringify({ ...stateWith([workout('2025-01-03')]), joined: null })).joined, '2025-01-03')
  assert.equal(attendanceSummary(stateWith([workout('2026-01-01'), workout('2026-01-02')], '2026-01-01'), '2026-01-03').missedPercent, 0)
})

test('calendar day math handles leap years, year boundaries and daylight-saving transition dates', () => {
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2)
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1)
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2)
  assert.equal(daysBetween('2025-10-03', '2026-10-03'), 365)
})
