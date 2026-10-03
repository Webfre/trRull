export const SHIFT_INTRO_KEY = 'gym-roulette-shift-intro-v1'
export const SHIFT_DURATIONS = [60, 90, 120] as const
export type ShiftDuration = typeof SHIFT_DURATIONS[number]
export type ShiftTempo = 'gentle' | 'lively'

export const SHIFT_DIRECTIONS = [
  { label: 'Вверх', angle: 0, symbol: '↑' },
  { label: 'Вверх и вправо', angle: 45, symbol: '↗' },
  { label: 'Вправо', angle: 90, symbol: '→' },
  { label: 'Вниз и вправо', angle: 135, symbol: '↘' },
  { label: 'Вниз', angle: 180, symbol: '↓' },
  { label: 'Вниз и влево', angle: 225, symbol: '↙' },
  { label: 'Влево', angle: 270, symbol: '←' },
  { label: 'Вверх и влево', angle: 315, symbol: '↖' },
] as const

export type ShiftCue = { direction: number; start: number; duration: number }

// Generate the entire round once. Pausing never rerolls directions or changes pace.
export function createShiftRound(seconds: ShiftDuration, tempo: ShiftTempo, random = Math.random): ShiftCue[] {
  const total = seconds * 1000
  const [slow, fast] = tempo === 'gentle' ? [4600, 2800] : [3800 / 1.5, 2000 / 1.5]
  const cues: ShiftCue[] = []
  let start = 0
  while (start < total) {
    const previous = cues.at(-1)?.direction
    const choices = SHIFT_DIRECTIONS.map((_, index) => index).filter(index => {
      if (cues.length < 4 && index % 2 !== 0) return false
      return previous === undefined || (index !== previous && (index + 4) % 8 !== previous)
    })
    const direction = choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))]
    const duration = Math.round(slow + (fast - slow) * start / total)
    // Distribute a too-short final fragment over existing cues, so the final
    // direction still has a full, usable interval and the round ends on time.
    if (total - start < fast && cues.length) {
      const factor = total / start
      let cursor = 0
      return cues.map((cue, index) => {
        const end = index === cues.length - 1 ? total : Math.round((cue.start + cue.duration) * factor)
        const next = { ...cue, start: cursor, duration: end - cursor }
        cursor = end
        return next
      })
    }
    cues.push({ direction, start, duration: Math.min(duration, total - start) })
    start += duration
  }
  return cues
}

export function shiftCueAt(cues: ShiftCue[], elapsed: number): number {
  if (elapsed < 0 || !Number.isFinite(elapsed)) return -1
  return cues.findIndex(cue => elapsed >= cue.start && elapsed < cue.start + cue.duration)
}
