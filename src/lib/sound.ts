let context: AudioContext | undefined

// Create/resume audio in response to a click, then reuse it for the result sound.
export function chime(): void {
  try {
    if (!context || context.state === 'closed') context = new AudioContext()
    const audio = context
    const play = () => {
      const gain = audio.createGain()
      gain.connect(audio.destination)
      gain.gain.setValueAtTime(.035, audio.currentTime)
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .5)
      ;[392, 494, 587].forEach((frequency, index) => {
        const oscillator = audio.createOscillator()
        oscillator.type = 'triangle'
        oscillator.frequency.value = frequency
        oscillator.connect(gain)
        oscillator.onended = () => { oscillator.disconnect(); if (index === 2) gain.disconnect() }
        oscillator.start(audio.currentTime + index * .11)
        oscillator.stop(audio.currentTime + index * .11 + .14)
      })
    }
    void (audio.state === 'running' ? Promise.resolve() : audio.resume()).then(play).catch(() => {})
  } catch { /* An unavailable audio device must not block the workout. */ }
}
