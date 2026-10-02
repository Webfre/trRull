import { test } from 'node:test'
import assert from 'node:assert/strict'

test('click audio resumes once, reuses its context and plays all three notes on every call', async t => {
  const original = globalThis.AudioContext
  t.after(() => { globalThis.AudioContext = original })
  let contexts = 0, resumes = 0, disconnects = 0
  const frequencies = [], starts = []
  globalThis.AudioContext = class {
    state = 'suspended'; currentTime = 0; destination = {}
    constructor() { contexts++ }
    async resume() { resumes++; this.state = 'running' }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { disconnects++ } } }
    createOscillator() { return { frequency: { set value(value) { frequencies.push(value) } }, connect() {}, disconnect() { disconnects++ }, start(time) { starts.push(time) }, stop() { this.onended() } } }
  }
  const { chime } = await import('../src/lib/sound.ts?reuse')
  chime()
  await new Promise(resolve => setImmediate(resolve))
  chime()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(contexts, 1)
  assert.equal(resumes, 1)
  assert.deepEqual(frequencies, [392, 494, 587, 392, 494, 587])
  assert.deepEqual(starts, [0, .11, .22, 0, .11, .22])
  assert.equal(disconnects, 8)
})

test('unsupported or blocked audio never interrupts the workout', async t => {
  const original = globalThis.AudioContext
  t.after(() => { globalThis.AudioContext = original })
  globalThis.AudioContext = undefined
  const { chime } = await import('../src/lib/sound.ts?unavailable')
  assert.doesNotThrow(() => chime())
  globalThis.AudioContext = class { state = 'suspended'; resume() { return Promise.reject(new Error('blocked')) } }
  assert.doesNotThrow(() => chime())
  await new Promise(resolve => setImmediate(resolve))
})
