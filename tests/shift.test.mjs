import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createShiftRound, shiftCueAt, SHIFT_DIRECTIONS, SHIFT_DURATIONS } from '../src/lib/shift.ts'

const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }

test('all round lengths finish exactly on time, accelerate and allow time for every direction', () => {
  for (const duration of SHIFT_DURATIONS) {
    for (const tempo of ['gentle', 'lively']) {
      const cues = createShiftRound(duration, tempo, seeded(42))
      assert.equal(cues[0].start, 0)
      assert.equal(cues.at(-1).start + cues.at(-1).duration, duration * 1000)
      assert.ok(cues.at(-1).duration < cues[0].duration)
      cues.forEach((cue, index) => {
        assert.ok(cue.duration >= (tempo === 'gentle' ? 2800 : Math.floor(2000 / 1.5)))
        if (index > 0) {
          assert.equal(cue.start, cues[index - 1].start + cues[index - 1].duration)
          assert.ok(cue.duration <= cues[index - 1].duration)
        }
      })
    }
  }
})

test('rounds introduce diagonals after four cues and avoid repeats and abrupt opposite directions', () => {
  const directions = new Set()
  for (let seed = 0; seed < 100; seed++) {
    const cues = createShiftRound(120, 'lively', seeded(seed))
    cues.forEach((cue, index) => {
      directions.add(cue.direction)
      assert.ok(cue.direction >= 0 && cue.direction < SHIFT_DIRECTIONS.length)
      if (index < 4) assert.equal(cue.direction % 2, 0)
      if (index > 0) {
        assert.notEqual(cue.direction, cues[index - 1].direction)
        assert.notEqual((cue.direction + 4) % 8, cues[index - 1].direction)
      }
    })
  }
  assert.equal(directions.size, 8)
})

test('timeline handles boundaries, completion and a frozen elapsed time without mutating the round', () => {
  const cues = createShiftRound(90, 'gentle', seeded(7))
  const original = structuredClone(cues)
  cues.forEach((cue, index) => {
    assert.equal(shiftCueAt(cues, cue.start), index)
    assert.equal(shiftCueAt(cues, cue.start + cue.duration - .001), index)
    const pausedAt = cue.start + cue.duration / 2
    assert.equal(shiftCueAt(cues, pausedAt), index)
    assert.equal(shiftCueAt(cues, pausedAt), index)
  })
  assert.equal(shiftCueAt(cues, 90000), -1)
  assert.equal(shiftCueAt(cues, 95000), -1)
  assert.equal(shiftCueAt(cues, -1), -1)
  assert.equal(shiftCueAt(cues, NaN), -1)
  assert.deepEqual(cues, original)
})

test('random selection stays in bounds at either end of its range', () => {
  for (const value of [0, .999999, 1]) {
    assert.ok(createShiftRound(60, 'gentle', () => value).every(cue => Number.isInteger(cue.direction)))
  }
})
