import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Award, CalendarDays, Check, ChevronRight, Dumbbell, Flame, Pencil, Sparkles, Trophy, X } from 'lucide-react'
import { getExercise, STORAGE_KEY, beginDailyWorkout, finishExercise, initialState, isComplete, localDate, parseState, previousDay, stats, type ClubState, type Settings } from './lib/workout'
import Modal from './components/Modal'
import SettingsForm from './components/SettingsForm'
import SlotMachine from './components/SlotMachine'
import CoachCompanion from './components/CoachCompanion'
import AchievementsPage from './components/AchievementsPage'
import WalkingCompletion from './components/WalkingCompletion'
import CalendarHistory from './components/CalendarHistory'
import { clubLevel } from './lib/levels'
import { achievementCollections, achievementSummary } from './lib/achievements'

type View = 'workout' | 'progress' | 'achievements'
type ModalType = 'profile' | 'settings' | 'help' | 'tomorrow' | 'success' | 'calendar' | null
const mascotUrl = `${import.meta.env.BASE_URL}assets/coach.png`

function readState() {
  try { return parseState(localStorage.getItem(STORAGE_KEY)) } catch { return initialState() }
}

function chime() {
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.value = .035
    ;[392, 494, 587].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(context.currentTime + index * .11)
      oscillator.stop(context.currentTime + index * .11 + .14)
    })
    setTimeout(() => void context.close(), 800)
  } catch { /* Audio is optional; a browser without it can still play. */ }
}

function remainingToday(now: Date) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const minutes = Math.max(0, Math.ceil((midnight.getTime() - now.getTime()) / 60000))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export default function App() {
  const [state, setState] = useState<ClubState>(readState)
  const [view, setView] = useState<View>('workout')
  const [modal, setModal] = useState<ModalType>(null)
  const [spinning, setSpinning] = useState(false)
  const [now, setNow] = useState(new Date())
  const [toast, setToast] = useState('')
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  const [walking, setWalking] = useState<{ index: number; date: string; minutes: number } | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinningRef = useRef(false)
  const stateRef = useRef(state)
  const today = localDate(now)
  const workout = state.workouts.find(w => w.date === today)
  const progress = stats(state, today)
  const level = clubLevel(progress.completed)
  const collections = achievementCollections(state, today)
  const achievementCounts = achievementSummary(collections)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current))
    } catch { setStorageUnavailable(true) }
    const timer = setInterval(() => setNow(new Date()), 30_000)
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY) { const next = parseState(event.newValue); stateRef.current = next; setState(next) } }
    const wake = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    window.addEventListener('storage', sync)
    document.addEventListener('visibilitychange', wake)
    return () => { clearInterval(timer); if (spinTimer.current) clearTimeout(spinTimer.current); window.removeEventListener('storage', sync); document.removeEventListener('visibilitychange', wake) }
  }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])

  function save(next: ClubState) {
    stateRef.current = next
    setState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageUnavailable(false) }
    catch { setStorageUnavailable(true) }
  }

  function currentState() {
    if (storageUnavailable) return stateRef.current
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? parseState(raw) : stateRef.current } catch { return stateRef.current }
  }

  function spin() {
    if (spinningRef.current) return
    const date = localDate()
    setNow(new Date())
    const latest = currentState()
    const result = beginDailyWorkout(latest, date)
    if (!result.created) { save(latest); setModal('tomorrow'); return }
    save(result.state)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setToast('Твоя тройка готова. Время действовать!'); return }
    spinningRef.current = true
    setSpinning(true)
    if (latest.settings.sound) chime()
    spinTimer.current = setTimeout(() => {
      spinningRef.current = false
      setSpinning(false)
      setToast('Твоя тройка готова. Время действовать!')
      if (latest.settings.sound) chime()
    }, 2800)
  }

  function requestCompletion(index: number) {
    const date = localDate()
    const active = currentState().workouts.find(workout => workout.date === date)
    if (!active || active.done[index] || spinningRef.current) return
    if (active.picks[index].exerciseId === 'walk') {
      setWalking({ index, date, minutes: active.picks[index].amount })
    } else complete(index)
  }

  function complete(index: number, steps?: number) {
    const latest = currentState()
    const date = localDate()
    const active = latest.workouts.find(w => w.date === date)
    if (!active || active.done[index] || spinningRef.current) return
    const next = finishExercise(latest, date, index, steps)
    save(next)
    if (isComplete(next.workouts.find(w => w.date === date))) { setModal('success'); if (latest.settings.sound) chime() }
    else setToast('Есть! Ещё один шаг к сильной привычке.')
  }

  function saveSettings(settings: Settings) {
    save({ ...currentState(), settings })
    setModal(null)
    setToast('Настройки сохранены. Следующая прокрутка — по твоим правилам.')
  }

  return <>
    <a className="skip-link" href="#main">К тренировке</a>
    <header className="site-header">
      <button className="brand" aria-label="Gym Roulette — главная" onClick={() => setView('workout')}><span className="brand-mark"><Dumbbell size={31} strokeWidth={2.5} /></span><span className="brand-wordmark">GYM<span>ROULETTE<span className="brand-period">®</span></span></span></button>
      <nav className="main-nav" aria-label="Главная навигация">
        <button className={view === 'workout' ? 'nav-active' : ''} aria-current={view === 'workout' ? 'page' : undefined} onClick={() => setView('workout')}><Dumbbell size={17} /><span>Тренировка</span></button>
        <button className={view === 'achievements' ? 'nav-active' : ''} aria-current={view === 'achievements' ? 'page' : undefined} onClick={() => setView('achievements')}><Trophy size={17} /><span>Достижения</span></button>
      </nav>
      <button className="header-profile" aria-current={view === 'progress' ? 'page' : undefined} aria-label="Открыть профиль" onClick={() => setView('progress')}><span className="profile-initial">{state.name.charAt(0).toUpperCase()}</span><span>{state.name}</span><ChevronRight size={16} /></button>
    </header>

    <main id="main" className="page-container">
      {view !== 'achievements' && <h1 className="sr-only">{view === 'workout' ? 'Тренировка' : 'Профиль'}</h1>}

      {view === 'achievements' ? <AchievementsPage collections={collections} /> : <div className={`dashboard-grid ${view === 'workout' ? 'home-layout' : 'profile-layout'}`}>
        {view === 'progress' && <aside className="profile-sidebar">
          <section className="membership-card" aria-label="Профиль атлета">
            <div className="member-identity"><div className="member-avatar"><Dumbbell size={32} strokeWidth={1.5} /><span>★</span></div><h3>{state.name}</h3><button className="edit-profile" aria-label="Изменить имя" onClick={() => setModal('profile')}><Pencil size={14} /></button><div className="member-rank">{level.current.nickname}</div></div>
            <div className="member-stats"><div><span><Flame size={17} />Серия</span><strong>{progress.streak}<small> дн.</small></strong></div><div><span><Dumbbell size={17} />Тренировки</span><strong>{progress.completed}</strong></div></div>
            <div className="member-level"><div><span>Уровень {level.current.level} / 20</span><strong>{level.next ? `ещё ${level.remaining}` : 'MAX'}</strong></div><div className="progress-track" role="progressbar" aria-label="Прогресс до следующего уровня" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress)}><span style={{ width: `${level.progress}%` }} /></div><p>{level.next ? `На ${level.next.days}-й тренировке: ${level.next.nickname}` : 'Высший ранг. Год в деле!'}</p></div>
          </section>

          <section className="week-card" aria-label="Твоя неделя"><button className="week-calendar-open" onClick={() => setModal('calendar')} aria-label="Твоя неделя — открыть календарь и статистику"><span className="card-topline"><strong>ТВОЯ НЕДЕЛЯ</strong><CalendarDays size={17} /></span><Week state={state} today={today} /><span className="week-caption">{progress.streak ? `Держишь темп уже ${progress.streak} дн.` : 'Открыть календарь'} <ChevronRight size={12} /></span></button></section>
        </aside>}

        {view === 'workout' ? <>
          <SlotMachine workout={workout} spinning={spinning} sound={state.settings.sound} onSpin={spin} onSound={() => { const latest = currentState(); save({ ...latest, settings: { ...latest.settings, sound: !latest.settings.sound } }) }} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} onDone={requestCompletion} />
        </> : <section className="wide-content progress-content"><div className="progress-summary"><div><Flame size={23} /><strong>{progress.best}<small>дней</small></strong><span>Лучшая серия</span></div><div><Dumbbell size={23} /><strong>{progress.completed}<small>дней</small></strong><span>Тренировок закрыто</span></div><div><Award size={23} /><strong>{achievementCounts.unlocked}<small>из {achievementCounts.total}</small></strong><span>Наград получено</span></div></div>
          <h3 className="history-heading">ЖУРНАЛ ТРЕНИРОВОК</h3>{state.workouts.length ? <div className="history-list">{[...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).map(w => <article className="history-row" key={w.date}><div className={`history-icon ${isComplete(w) ? 'finished' : ''}`}>{isComplete(w) ? <Check size={22} /> : <Dumbbell size={22} />}</div><div><h4>{new Date(`${w.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h4><p>{w.picks.map(p => `${getExercise(p.exerciseId)?.name ?? 'Упражнение'} ${p.amount} ${getExercise(p.exerciseId)?.unit ?? ''}`).join(' · ')}</p></div><span>{w.done.filter(Boolean).length}/3</span></article>)}</div> : <div className="empty-progress"><Dumbbell size={45} strokeWidth={1.2} /><h3>История начинается с тебя</h3><p>Первая тренировка — первая запись.<br />Крути рулетку и начни свою серию.</p><button className="primary-button" onClick={() => setView('workout')}>К тренировке</button></div>}</section>}
      </div>}

      {view === 'workout' && <CoachCompanion today={today} imageUrl={mascotUrl} />}
    </main>

    {storageUnavailable && <div className="storage-notice" role="alert">Браузер не разрешает сохранить прогресс. Сейчас он доступен только до закрытия страницы.</div>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setToast('')}><X size={17} /></button></div>}
    {walking && <WalkingCompletion minutes={walking.minutes} onClose={() => setWalking(null)} onComplete={steps => {
      const pending = walking
      setWalking(null)
      if (localDate() !== pending.date) { setNow(new Date()); setToast('Начался новый день. Открой сегодняшнюю тренировку.'); return }
      complete(pending.index, steps)
    }} />}
    {modal === 'calendar' && <CalendarHistory state={state} today={today} onClose={() => setModal(null)} />}
    {modal === 'settings' && <Modal title="Твоя рулетка — твои правила" onClose={() => setModal(null)} className="settings-modal"><SettingsForm settings={state.settings} onSave={saveSettings} onCancel={() => setModal(null)} /></Modal>}
    {modal === 'profile' && <Modal title="Клубная карта" onClose={() => setModal(null)}><ProfileForm name={state.name} onSave={name => { save({ ...currentState(), name }); setModal(null); setToast('Теперь в клубе тебя знают по имени.') }} /><p className="privacy-note">Имя и прогресс хранятся только в этом браузере. Регистрация не нужна.</p></Modal>}
    {modal === 'help' && <Modal title="Правила нашего клуба" onClose={() => setModal(null)}><div className="rules-list"><div><b>01</b><section><h3>Доверься случаю</h3><p>Одна прокрутка в календарные сутки по времени твоего устройства. Рулетка выбирает три упражнения и объём. Повторы могут совпасть.</p></section></div><div><b>02</b><section><h3>Сделай своё дело</h3><p>Выполни упражнения в удобном порядке и отметь каждое. Все три готовы — тренировка закрыта.</p></section></div><div><b>03</b><section><h3>Вернись завтра</h3><p>Новая попытка появляется в полночь. Собирай тренировки, поддерживай серию и открывай награды.</p></section></div></div><p className="rules-note">Начни с короткой разминки и выбирай посильную нагрузку. Упражнения и диапазоны можно менять в настройках.</p><button className="primary-button full-width" onClick={() => setModal(null)}>Понял. Погнали!</button></Modal>}
    {(modal === 'tomorrow' || modal === 'success') && <Modal title={modal === 'success' ? 'ЕЩЁ ОДНА ПОБЕДА!' : 'ЗАВТРА — НОВЫЙ ПОДХОД'} onClose={() => setModal(null)} className="celebration-modal"><div className="celebration-art"><img src={mascotUrl} alt="Тренер одобрительно показывает большой палец" width="1122" height="1402" /><span><Sparkles size={27} /></span></div><h3>{modal === 'success' ? 'YEAH, BUDDY!' : 'НА СЕГОДНЯ ХВАТИТ, БРО.'}</h3><p>{modal === 'success' ? 'Три упражнения закрыты. Характер прокачан. Отдыхай и возвращайся за новой тройкой завтра.' : isComplete(workout) ? 'Ты уже сделал своё дело. Восстановись — завтра железо снова позовёт.' : 'Твоя тройка уже выбрана. Выполни упражнения и отметь их, а за новой порцией заходи завтра.'}</p><div className="next-spin-label">СЛЕДУЮЩАЯ ПРОКРУТКА ЧЕРЕЗ <strong>{remainingToday(now)}</strong></div><button className="primary-button full-width" onClick={() => setModal(null)}>{isComplete(workout) ? 'ДО ЗАВТРА, ТРЕНЕР' : 'К УПРАЖНЕНИЯМ'}</button></Modal>}
  </>
}

function ProfileForm({ name, onSave }: { name: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name)
  function submit(event: FormEvent) { event.preventDefault(); if (draft.trim()) onSave(draft.trim()) }
  return <form onSubmit={submit} className="profile-form"><label htmlFor="athlete-name">Как тебя называть?</label><input id="athlete-name" autoComplete="nickname" required maxLength={24} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Имя или прозвище" /><button className="primary-button full-width" type="submit" disabled={!draft.trim()}>Сохранить имя</button></form>
}

function Week({ state, today }: { state: ClubState; today: string }) {
  const date = new Date(`${today}T12:00:00`)
  const weekday = (date.getDay() + 6) % 7
  let monday = today
  for (let i = 0; i < weekday; i++) monday = previousDay(monday)
  const start = new Date(`${monday}T12:00:00`)
  const labels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']
  return <div className="week-days">{labels.map((label, index) => {
    const day = localDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12))
    const complete = isComplete(state.workouts.find(w => w.date === day))
    return <div key={label} className={`week-day ${day === today ? 'is-today' : ''} ${complete ? 'day-complete' : ''}`} aria-label={`${label}, ${day === today ? 'сегодня, ' : ''}${complete ? 'выполнено' : 'не выполнено'}`}><span>{label}</span><div>{complete ? <Check size={14} /> : day === today ? <span className="today-dot" /> : <span className="day-dash">–</span>}</div></div>
  })}</div>
}
