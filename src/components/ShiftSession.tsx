import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import { createShiftRound, shiftCueAt, SHIFT_DIRECTIONS, type ShiftCue, type ShiftDuration, type ShiftTempo } from '../lib/shift'

type Phase = 'idle' | 'countdown' | 'running' | 'paused' | 'finished'
export type ShiftSessionHandle = { start: (duration: ShiftDuration, tempo: ShiftTempo) => void }

export default function ShiftSession({ ref }: { ref: Ref<ShiftSessionHandle> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const arrow = useRef<SVGSVGElement>(null)
  const arrowShape = useRef<SVGGElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const elapsed = useRef(0)
  const cues = useRef<ShiftCue[]>([])
  const options = useRef<{ duration: ShiftDuration; tempo: ShiftTempo }>({ duration: 90, tempo: 'gentle' })
  const previousOverflow = useRef<string | null>(null)
  const countdownLength = useRef(5)
  const [phase, setPhase] = useState<Phase>('idle')
  const [countdown, setCountdown] = useState(5)
  const [cueIndex, setCueIndex] = useState(0)

  function changePhase(next: Phase) {
    phaseRef.current = next
    setPhase(next)
  }

  function requestFullscreen() {
    // Fullscreen API excludes <dialog>; request it on the content inside the modal.
    // https://fullscreen.spec.whatwg.org/#dom-element-requestfullscreen
    const element = screen.current
    if (element?.requestFullscreen && !document.fullscreenElement) {
      // iOS and embedded browsers may reject native fullscreen; the dialog still fills the viewport.
      void element.requestFullscreen().then(() => {
        if (phaseRef.current === 'idle' && document.fullscreenElement === element) void document.exitFullscreen().catch(() => {})
      }).catch(() => {})
    }
  }

  function begin(duration: ShiftDuration, tempo: ShiftTempo) {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'finished') return
    options.current = { duration, tempo }
    cues.current = createShiftRound(duration, tempo)
    elapsed.current = 0
    countdownLength.current = 5
    setCountdown(5)
    setCueIndex(0)
    if (!dialog.current?.open) {
      previousOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialog.current?.showModal()
    }
    changePhase('countdown')
    requestFullscreen()
  }

  useImperativeHandle(ref, () => ({ start: begin }))

  function pause() {
    if (phaseRef.current === 'running' || phaseRef.current === 'countdown') changePhase('paused')
  }

  function resume() {
    countdownLength.current = 3
    setCountdown(3)
    changePhase('countdown')
    requestFullscreen()
  }

  function close() {
    changePhase('idle')
    if (document.fullscreenElement === screen.current) void document.exitFullscreen().catch(() => {})
    dialog.current?.close()
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current
    previousOverflow.current = null
  }

  useEffect(() => {
    const element = dialog.current
    const fullscreenElement = screen.current
    const visibility = () => { if (document.hidden) pause() }
    const fullscreen = () => { if (!document.fullscreenElement) pause() }
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('fullscreenchange', fullscreen)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('fullscreenchange', fullscreen)
      phaseRef.current = 'idle'
      if (document.fullscreenElement === fullscreenElement) void document.exitFullscreen().catch(() => {})
      element?.close()
      if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current
    }
  }, [])

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') return
    let disposed = false
    let lock: WakeLockSentinel | undefined
    if ('wakeLock' in navigator) {
      void navigator.wakeLock.request('screen').then(value => {
        if (disposed) void value.release().catch(() => {})
        else lock = value
      }).catch(() => {})
    }
    return () => { disposed = true; if (lock) void lock.release().catch(() => {}) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'idle') dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    if (phase !== 'countdown' && phase !== 'running') return
    let frame = 0
    const startedAt = performance.now()
    const offset = elapsed.current
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let previousCue = -1
    function tick(now: number) {
      if (phaseRef.current !== phase) return
      if (phase === 'countdown') {
        const remaining = Math.max(0, Math.ceil(countdownLength.current - (now - startedAt) / 1000))
        setCountdown(remaining)
        if (remaining === 0) { changePhase('running'); return }
      } else {
        elapsed.current = Math.min(options.current.duration * 1000, offset + now - startedAt)
        const index = shiftCueAt(cues.current, elapsed.current)
        if (index < 0) { changePhase('finished'); return }
        const cue = cues.current[index]
        if (index !== previousCue) {
          previousCue = index
          setCueIndex(index)
          arrowShape.current?.setAttribute('transform', `rotate(${SHIFT_DIRECTIONS[cue.direction].angle} 100 100)`)
        }
        const progress = Math.min(1, (elapsed.current - cue.start) / (cue.duration * .88))
        if (arrow.current) {
          arrow.current.style.transform = reducedMotion.matches ? 'none' : `translateZ(${-3000 * (1 - progress) ** 2}px)`
          arrow.current.style.opacity = reducedMotion.matches ? '1' : String(.3 + .7 * Math.min(1, progress * 4))
        }
      }
      frame = requestAnimationFrame(tick)
    }
    tick(startedAt)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  const currentDirection = SHIFT_DIRECTIONS[cues.current[cueIndex]?.direction ?? 0]
  const total = options.current.duration
  const remaining = Math.max(0, Math.ceil(total - elapsed.current / 1000))

  return <dialog ref={dialog} className="shift-session" aria-label="Сдвиг — игровой экран" onCancel={event => {
    event.preventDefault()
    if (phaseRef.current === 'paused' || phaseRef.current === 'finished') close()
    else pause()
  }}>
    <div ref={screen} className="shift-screen">
    {phase === 'running' && <button className="shift-playfield" onClick={pause} aria-label={`Пауза. Направление: ${currentDirection.label}`}>
      <svg ref={arrow} className="shift-flying-arrow" viewBox="0 0 200 200" aria-hidden="true">
        <g ref={arrowShape}><path d="M100 12 185 97H130V184H70V97H15Z" /></g>
      </svg>
      <span className="sr-only" role="status">{currentDirection.label}</span>
    </button>}
    {phase === 'countdown' && <div className="shift-session-panel shift-countdown">
      <p>{elapsed.current > 0 ? 'Продолжаем через' : 'Поставь телефон. Приготовься.'}</p>
      <strong role="timer" aria-live="polite">{countdown}</strong>
      <p>Коснись экрана во время игры, чтобы поставить паузу.</p>
      <button className="shift-dark-secondary" onClick={pause}><Pause size={18} />Пауза</button>
    </div>}
    {phase === 'paused' && <div className="shift-session-panel">
      <Pause size={32} aria-hidden="true" />
      <p className="shift-session-kicker">Можно выдохнуть</p>
      <h2>Пауза</h2>
      <p>Осталось {remaining} сек. Темп продолжится с того же места.</p>
      <button className="shift-dark-primary" onClick={resume}><Play size={19} />Продолжить</button>
      <button className="shift-dark-secondary" onClick={close}><X size={18} />Завершить раунд</button>
      <small>На компьютере: пробел — пауза, Esc — пауза или выход.</small>
    </div>}
    {phase === 'finished' && <div className="shift-session-panel">
      <span className="shift-finish-mark"><Check size={36} /></span>
      <p className="shift-session-kicker">Отвлёкся. Подвигался. Перезагрузился.</p>
      <h2>Хороший сдвиг!</h2>
      <p>{total} секунд · {cues.current.length} показанных направлений</p>
      <p className="shift-session-caption">Как двигался — знаешь ты. Игра не отслеживает движения.</p>
      <button className="shift-dark-primary" onClick={() => begin(options.current.duration, options.current.tempo)}><RotateCcw size={18} />Ещё раунд</button>
      <button className="shift-dark-secondary" onClick={close}>Вернуться к игре</button>
    </div>}
    </div>
  </dialog>
}
