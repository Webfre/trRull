import { useEffect, useRef, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { localDate } from '../lib/workout'
import { COACH_DAILY_LIMIT, COACH_STORAGE_KEY, coachCountToday, initialCoachState, isCoachHidden, nextCoachReply, parseCoachState, type CoachState } from '../lib/coach'
import './CoachCompanion.css'

type Speech = { key: number; text: string; date: string; ending: boolean }

function loadCoach(): CoachState {
  try { return parseCoachState(localStorage.getItem(COACH_STORAGE_KEY)) }
  catch { return initialCoachState() }
}

export default function CoachCompanion({ today, imageUrl }: { today: string; imageUrl: string }) {
  const [history, setHistory] = useState(loadCoach)
  const [day, setDay] = useState(today)
  const [speech, setSpeech] = useState<Speech | null>(null)
  const [characters, setCharacters] = useState(0)
  const [busy, setBusy] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [warning, setWarning] = useState('')
  const historyRef = useRef(history)
  const storageFailed = useRef(false)
  const clickPending = useRef(false)
  const alive = useRef(true)
  const sequence = useRef(0)
  const container = useRef<HTMLElement>(null)

  useEffect(() => {
    alive.current = true
    function sync(event: StorageEvent) {
      if (event.key !== COACH_STORAGE_KEY && event.key !== null) return
      const next = parseCoachState(event.newValue)
      historyRef.current = next
      setHistory(next)
    }
    window.addEventListener('storage', sync)
    return () => { alive.current = false; window.removeEventListener('storage', sync) }
  }, [])

  // App refreshes its local date at midnight and when returning to the tab.
  useEffect(() => { setDay(today) }, [today])
  useEffect(() => {
    setSpeech(current => current?.date === day ? current : null)
    setExiting(false)
  }, [day])

  useEffect(() => {
    if (!speech) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCharacters(speech.text.length)
      return
    }
    const timer = setInterval(() => setCharacters(count => {
      if (count >= speech.text.length) { clearInterval(timer); return count }
      return Math.min(count + 2, speech.text.length)
    }), 30)
    return () => clearInterval(timer)
  }, [speech])

  const visibleSpeech = speech?.date === day ? speech : null
  const typing = !!visibleSpeech && characters < visibleSpeech.text.length
  const hidden = isCoachHidden(history, day)
  const count = coachCountToday(history, day)

  useEffect(() => {
    if (!visibleSpeech?.ending || typing) return
    const exitTimer = setTimeout(() => setExiting(true), 4200)
    const hideTimer = setTimeout(() => {
      if (container.current?.contains(document.activeElement)) {
        document.querySelector<HTMLButtonElement>('.spin-button')?.focus({ preventScroll: true })
      }
      setSpeech(null)
    }, 4700)
    return () => { clearTimeout(exitTimer); clearTimeout(hideTimer) }
  }, [visibleSpeech, typing])

  function freshState(): CoachState {
    if (storageFailed.current) return historyRef.current
    try {
      const raw = localStorage.getItem(COACH_STORAGE_KEY)
      return raw ? parseCoachState(raw) : historyRef.current
    } catch { return historyRef.current }
  }

  function persist(next: CoachState) {
    historyRef.current = next
    setHistory(next)
    try {
      localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(next))
      storageFailed.current = false
      setWarning('')
    } catch {
      storageFailed.current = true
      setWarning('Браузер не разрешает сохранить историю. После обновления страницы или выхода из тренировки она может потеряться.')
    }
  }

  async function talk() {
    if (clickPending.current || visibleSpeech?.ending) return
    if (typing) { setCharacters(visibleSpeech!.text.length); return }
    clickPending.current = true
    setBusy(true)
    const tell = () => {
      if (!alive.current) return
      const date = localDate()
      const reply = nextCoachReply(freshState(), date)
      setDay(date)
      // Persist before starting the animation, including the farewell dismissal.
      persist(reply.state)
      if (reply.kind === 'hidden') { setSpeech(null); return }
      setCharacters(0)
      setExiting(false)
      setSpeech({ key: ++sequence.current, text: reply.text, date, ending: reply.kind !== 'line' })
    }
    try {
      // Serialize clicks across tabs on browsers with Web Locks support.
      if (navigator.locks) await navigator.locks.request(COACH_STORAGE_KEY, tell)
      else tell()
    } catch {
      if (alive.current) setWarning('Не получилось открыть реплику. Попробуй ещё раз.')
    } finally {
      clickPending.current = false
      if (alive.current) setBusy(false)
    }
  }

  if (hidden && !visibleSpeech?.ending) return null

  return <aside ref={container} className={`coach-companion ${typing ? 'coach-talking' : ''} ${exiting ? 'coach-leaving' : ''}`} aria-label="Байки тренера">
    <div className={`coach-bubble ${visibleSpeech ? 'has-story' : ''}`} key={visibleSpeech?.key ?? 'intro'}>
      {visibleSpeech ? <>
        <p className="coach-line" aria-hidden="true">{visibleSpeech.text.slice(0, characters)}{typing && <span className="coach-caret" />}</p>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{visibleSpeech.text}</p>
      </> : <p className="coach-line">{count >= COACH_DAILY_LIMIT ? 'Три байки уже выдал. Ещё слово — и я в зал!' : 'Псс… Есть одна байка. Нажми на меня.'}</p>}
      <span className="coach-daily-count">{visibleSpeech?.ending ? 'ТРЕНЕР УШЁЛ НА ТРЕНИРОВКУ' : `${count} / ${COACH_DAILY_LIMIT} на сегодня`}</span>
      {warning && <p className="coach-storage-warning" role="alert">{warning}</p>}
    </div>
    <button className="coach-character" type="button" onClick={() => void talk()} aria-disabled={busy || visibleSpeech?.ending || exiting} aria-label={typing ? 'Показать реплику целиком' : 'Послушать новую байку тренера'}>
      <img key={visibleSpeech?.key ?? 'idle'} src={imageUrl} alt="Мультяшный тренер с усами" width="1122" height="1402" draggable="false" />
      <span className="coach-tap-hint"><MessageCircle size={15} />{visibleSpeech?.ending ? 'Я в зал!' : typing ? 'Читать целиком' : count >= COACH_DAILY_LIMIT ? 'Ну ещё одну?' : 'Поболтаем?'}</span>
    </button>
  </aside>
}
