import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowRight, Check, Clock3, Dumbbell, Flag, Footprints, RotateCcw, ShieldAlert, Trophy, X } from 'lucide-react'
import { addChallengeProgress, CHALLENGE_KEY, challengeCountdown, challengeModel, challengeProgress, challengeStatus, challengeTotal, estimateChallenge, formatChallengeTime, initialChallengeState, parseChallengeState, startChallenge, stopChallenge, undoChallengeEntry, type Challenge, type ChallengeState, type ChallengeTarget } from '../lib/challenge'
import ExerciseIcon from './ExerciseIcon'
import Modal from './Modal'
import './ChallengePage.css'

const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
function readChallenges() { try { return parseChallengeState(localStorage.getItem(CHALLENGE_KEY)) } catch { return initialChallengeState() } }

export default function ChallengePage({ imageUrl, onExit, initialValue, onChange }: { imageUrl: string; onExit: () => void; initialValue: ChallengeState; onChange: (state: ChallengeState) => void }) {
  const [state, setState] = useState<ChallengeState>(initialValue)
  const stateRef = useRef(state)
  const storageWorking = useRef(true)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)
  const [intro, setIntro] = useState(() => !state.introSeen)
  const [declined, setDeclined] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [revealUnderlay, setRevealUnderlay] = useState(false)
  const [now, setNow] = useState(Date.now)
  const resultRef = useRef<HTMLHeadingElement>(null)
  const current = state.challenges.at(-1)
  const status = current ? challengeStatus(current, now) : null
  const visibleHistory = state.challenges.slice(0, -1).filter(challenge => challengeStatus(challenge, now) === 'completed')

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    const wake = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    const sync = (event: StorageEvent) => {
      if (event.key !== CHALLENGE_KEY && event.key !== null) return
      const next = event.key === null ? readChallenges() : parseChallengeState(event.newValue)
      stateRef.current = next
      setState(next)
      onChange(next)
      setNow(Date.now())
    }
    window.addEventListener('storage', sync)
    document.addEventListener('visibilitychange', wake)
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); document.removeEventListener('visibilitychange', wake) }
  }, [onChange])

  useEffect(() => {
    if (!drawing) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const reveal = setTimeout(() => setRevealUnderlay(true), reduced ? 0 : 3400)
    const timer = setTimeout(() => { setDrawing(false); setNow(Date.now()) }, reduced ? 100 : 4200)
    return () => { clearTimeout(reveal); clearTimeout(timer) }
  }, [drawing])

  useEffect(() => { if (current && (status === 'active' || status === 'completed') && !drawing && !intro) resultRef.current?.focus({ preventScroll: true }) }, [current?.id, status, drawing, intro])

  useEffect(() => { if (status === 'stopped' || status === 'expired') { setDeclined(false); setError('') } }, [status])

  async function update(change: (latest: ChallengeState) => ChallengeState): Promise<boolean> {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const apply = () => {
        let latest = stateRef.current
        if (storageWorking.current) {
          try { const raw = localStorage.getItem(CHALLENGE_KEY); if (raw) latest = parseChallengeState(raw) }
          catch { storageWorking.current = false; setStorageWarning(true) }
        }
        const next = change(latest)
        try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(next)); storageWorking.current = true; setStorageWarning(false) }
        catch { storageWorking.current = false; setStorageWarning(true) }
        stateRef.current = next
        setState(next)
        onChange(next)
        setNow(Date.now())
      }
      if (navigator.locks) await navigator.locks.request(CHALLENGE_KEY, apply)
      else apply()
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не получилось сохранить результат. Попробуй ещё раз.'); return false }
    finally { pending.current = false; setBusy(false) }
  }

  async function closeIntro() {
    if (await update(latest => ({ ...latest, introSeen: true }))) setIntro(false)
  }

  async function begin() {
    if (drawing || pending.current) return
    let created = false
    const saved = await update(latest => {
      const next = startChallenge(latest, Date.now(), Math.random, makeId())
      created = next !== latest
      return next
    })
    if (saved) { setDeclined(false); setRevealUnderlay(false); setDrawing(created) }
  }

  const equipment = current ? current.targets.map(target => challengeModel(target.exerciseId).equipment).filter(Boolean) : []
  const estimate = current ? estimateChallenge(current) : null
  const remainingMinutes = current ? Math.ceil(current.targets.reduce((sum, target) => sum + Math.max(0, target.amount - challengeTotal(current, target.exerciseId)) / challengeModel(target.exerciseId).perMinute, 0)) : 0

  return <section className="challenge-page" aria-labelledby="challenge-page-title" aria-busy={drawing || busy}>
    <header className="challenge-page-heading"><h1 id="challenge-page-title"><Flag size={27} />ЧЕЛЛЕНДЖ</h1><span>РЕЖИМ С ХАРАКТЕРОМ</span></header>
    {(!current || status === 'stopped' || status === 'expired' || (drawing && !revealUnderlay)) ? <div className="challenge-invitation">
      <img src={imageUrl} width="1122" height="1402" alt="Тренер приглашает принять челлендж" />
      <div className="challenge-invitation-copy"><h2>{declined ? 'Заходи в другой раз, бро.' : 'Готов начать свой челлендж?'}</h2><p>{declined ? 'Сначала подготовка. Вызов никуда не денется.' : 'Упражнения и срок выберет колесо. От тебя — готовность выполнить.'}</p>
        {declined ? <div className="challenge-invitation-actions"><button className="primary-button" onClick={onExit}>На главную <ArrowRight size={17} /></button><button className="text-button" onClick={() => setDeclined(false)}>Я передумал</button></div> : <div className="challenge-invitation-actions"><button className="primary-button challenge-yes" disabled={busy || drawing || intro} onClick={() => void begin()}>Да, я готов <ArrowRight size={18} /></button><button className="secondary-button" disabled={busy || drawing || intro} onClick={() => setDeclined(true)}>Нет, позже</button></div>}
      </div>
    </div> : <div className="challenge-result">
      <div className="challenge-result-top"><div><span className="challenge-kicker">ТВОЙ ВЫЗОВ</span><h2 tabIndex={-1} ref={resultRef}>{status === 'active' ? `За ${current.days} ${current.days === 1 ? 'день' : current.days === 2 ? 'дня' : 'дней'}` : 'ЧЕЛЛЕНДЖ ЗАКРЫТ'}</h2></div><span className={`challenge-seal ${status === 'completed' ? 'complete' : ''}`}>{status === 'completed' ? <Trophy size={31} /> : <Flag size={29} />}</span></div>
      <div className="challenge-overview"><div className="challenge-countdown"><span>{status === 'active' ? 'ОСТАЛОСЬ' : 'СРОК ЧЕЛЛЕНДЖА'}</span><strong>{status === 'active' ? challengeCountdown(current.deadline, now) : `${current.days} дн.`}</strong><small>До {new Date(current.deadline).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div><div className="challenge-time-estimate"><Clock3 size={19} /><span>Ориентир времени</span><strong>≈ {formatChallengeTime(estimate!.minutes)}</strong><small>≈ {estimate!.dailyMinutes} мин в день в среднем</small></div><div className="challenge-overall"><strong>{challengeProgress(current)}<small>%</small></strong><progress value={challengeProgress(current)} max={100} aria-label="Общий прогресс челленджа" /></div></div>
      {status === 'completed' && <p className="challenge-outcome success" role="status">Все цели выполнены. Теперь время восстановиться.</p>}
      {equipment.length > 0 && <p className="challenge-equipment">Понадобится: {equipment.join(' · ').toLowerCase()}</p>}
      <div className="challenge-targets">{current.targets.map(target => <TargetCard key={`${current.id}-${target.exerciseId}`} challenge={current} target={target} disabled={busy || drawing || status !== 'active'} onAdd={amount => update(latest => addChallengeProgress(latest, current.id, target.exerciseId, amount, Date.now(), makeId()))} />)}</div>
      {status === 'active' && <p className="challenge-recovery"><ShieldAlert size={18} /><span>Распределяй объём по сроку и дели его на подходы. Оставляй дни восстановления между силовыми занятиями. Если нагрузка непривычна или самочувствие ухудшилось — остановись.</span></p>}
      <details className="challenge-math"><summary>Как рассчитана нагрузка <span>≈ {formatChallengeTime(estimate!.lowMinutes)}–{formatChallengeTime(estimate!.highMinutes)}</span></summary><p>Это ориентир по условному темпу, с короткими паузами и 5 минутами разминки на занятие. Твой темп, маршрут и подготовка могут заметно изменить время. Сервис не оценивает твоё здоровье и не гарантирует, что нагрузка тебе подходит.</p><ul>{current.targets.map(target => { const model = challengeModel(target.exerciseId); return <li key={target.exerciseId}><strong>{model.name}</strong><span>{target.sessions} зан. · примерно {number(Math.ceil(target.amount / target.sessions / model.inputStep) * model.inputStep)} {model.unit} на занятие</span></li> })}</ul><p>В силовой части заложен один тренировочный день на каждые три дня срока. Для кардио — до пяти дней из семи. Ориентир оставшегося объёма: {remainingMinutes ? `≈ ${formatChallengeTime(remainingMinutes)} без разминки` : 'всё выполнено'}. Пропуски не повышают плановую нагрузку.</p></details>
      {current.entries.length > 0 && <details className="challenge-log"><summary>Записи прогресса <span>{current.entries.length}</span></summary><ul>{[...current.entries].reverse().map(entry => <li key={entry.id}><span>{challengeModel(entry.exerciseId).name}<small>{new Date(entry.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><strong>+{number(entry.amount)} {challengeModel(entry.exerciseId).unit}</strong></li>)}</ul><button className="text-button" disabled={busy} onClick={() => void update(latest => undoChallengeEntry(latest, current.id))}><RotateCcw size={15} />Отменить последнюю запись</button></details>}
      <div className="challenge-bottom-actions">{status === 'active' ? <button className="text-button" disabled={busy} onClick={() => void update(latest => stopChallenge(latest, current.id, Date.now()))}><X size={15} />Прекратить челлендж</button> : <button className="primary-button" disabled={busy} onClick={() => void begin()}>Новый челлендж <ArrowRight size={17} /></button>}<button className="text-button" onClick={onExit}>На главную</button></div>
    </div>}
    {error && <p className="form-error challenge-error" role="alert">{error}</p>}
    {storageWarning && <p className="challenge-storage-warning" role="alert">Браузер не разрешает сохранить челлендж. Прогресс доступен только до перезагрузки или закрытия приложения.</p>}
    {!drawing && visibleHistory.length > 0 && <details className="challenge-history"><summary>Прошлые челленджи <span>{visibleHistory.length}</span></summary>{[...visibleHistory].reverse().map(challenge => <article key={challenge.id}><span>{new Date(challenge.startedAt).toLocaleDateString('ru-RU')} · {challenge.days} дн.<small>{challenge.targets.map(target => challengeModel(target.exerciseId).name).join(' · ')}</small></span><strong>{challengeProgress(challenge)}%<small>Выполнено</small></strong></article>)}</details>}
    {intro && <Modal title="Серьёзный разговор, бро" className="challenge-intro-modal" onClose={() => void closeIntro()}><div className="challenge-intro-coach"><img src={imageUrl} width="1122" height="1402" alt="Тренер объясняет правила челленджа" /><div><h3>Здесь решает колесо.</h3><p>Это сложный режим для подготовленных взрослых. Упражнения, объём и срок выпадают случайно. Выбрать или настроить челлендж нельзя — только решить, готов ли ты его выполнить.</p></div></div><p>Может понадобиться велосипед, турник или брусья. Время начинается сразу после «Да». Результаты добавляй частями, до окончания таймера.</p><p className="challenge-intro-warning">Если физическая подготовка или здоровье не позволяют такую нагрузку — не начинай и вернись позже. При боли или ухудшении самочувствия прекрати занятие. При заболеваниях или сомнениях обсуди нагрузку с врачом. Челлендж можно прекратить в любой момент.</p><button className="primary-button full-width" disabled={busy} onClick={() => void closeIntro()}>Понял тебя, тренер</button></Modal>}
    {drawing && <ChallengeDraw />}
  </section>
}

function TargetCard({ challenge, target, disabled, onAdd }: { challenge: Challenge; target: ChallengeTarget; disabled: boolean; onAdd: (amount: number) => Promise<boolean> }) {
  const [amount, setAmount] = useState('')
  const model = challengeModel(target.exerciseId)
  const completed = challengeTotal(challenge, target.exerciseId)
  const remaining = Math.round((target.amount - completed) * 10) / 10
  const inputId = `challenge-${target.exerciseId}`
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (disabled || !amount.trim()) return
    if (await onAdd(Number(amount.replace(',', '.')))) setAmount('')
  }
  return <article className={`challenge-target ${remaining === 0 ? 'target-complete' : ''}`}>
    <div className="challenge-target-icon">{target.exerciseId === 'steps' ? <Footprints size={31} /> : <ExerciseIcon id={target.exerciseId} size={31} />}</div>
    <div className="challenge-target-main"><h3>{model.name}</h3><div className="challenge-target-numbers"><strong>{number(completed)}</strong><span>/ {number(target.amount)} {model.unit}</span>{remaining === 0 && <Check size={19} aria-label="Цель выполнена" />}</div><progress max={target.amount} value={completed} aria-label={`${model.name}: ${number(completed)} из ${number(target.amount)} ${model.unit}`} /></div>
    {remaining > 0 && <form onSubmit={submit} className="challenge-progress-form"><label htmlFor={inputId}>Добавить сделанное, {model.unit}</label><div><input id={inputId} type="number" inputMode={model.inputStep < 1 ? 'decimal' : 'numeric'} min={model.inputStep} max={remaining} step={model.inputStep} required placeholder="0" value={amount} onChange={event => setAmount(event.target.value)} disabled={disabled} /><button type="submit" disabled={disabled || !amount || Number(amount) <= 0} aria-label={`Записать: ${model.name}`}>+<span>Добавить</span></button></div></form>}
  </article>
}

function ChallengeDraw() {
  const icons = ['pushup', 'squat', 'cycling', 'walk', 'plank', 'rope', 'shadowbox', 'pullup']
  return <div className="challenge-draw" role="status" aria-label="Колесо выбирает твой челлендж"><div className="challenge-draw-content"><div className="challenge-wheel"><span className="challenge-wheel-pointer" /><div className="challenge-wheel-disc" aria-hidden="true">{icons.map((id, index) => <span key={id} style={{ '--wheel-angle': `${index * 45}deg` } as CSSProperties}><ExerciseIcon id={id} size={29} /></span>)}</div><span className="challenge-wheel-center"><Dumbbell size={48} /></span></div><h2>ХАРАКТЕР, НА ВЫХОД.</h2><p>Колесо выбирает твой вызов<span className="challenge-loading-dots">...</span></p></div></div>
}
