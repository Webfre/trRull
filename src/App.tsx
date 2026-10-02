import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Award, BadgeCheck, CalendarDays, Check, ChevronRight, CircleHelp, Dumbbell, Flame, History, LockKeyhole, Medal, Pencil, Settings2, ShieldCheck, Sparkles, Star, Ticket, Trophy, X, Zap } from 'lucide-react'
import { CATEGORY_LABELS, EXERCISES, STORAGE_KEY, beginDailyWorkout, finishExercise, initialState, isComplete, localDate, parseState, previousDay, stats, type Category, type ClubState, type Settings } from './lib/workout'
import ExerciseIcon from './components/ExerciseIcon'
import Modal from './components/Modal'
import SettingsForm from './components/SettingsForm'
import SlotMachine from './components/SlotMachine'

type View = 'workout' | 'exercises' | 'progress'
type ModalType = 'profile' | 'settings' | 'help' | 'tomorrow' | 'success' | null
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
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinningRef = useRef(false)
  const stateRef = useRef(state)
  const today = localDate(now)
  const workout = state.workouts.find(w => w.date === today)
  const progress = stats(state, today)

  useEffect(() => {
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

  function complete(index: number) {
    const latest = currentState()
    const date = localDate()
    const active = latest.workouts.find(w => w.date === date)
    if (!active || active.done[index] || spinningRef.current) return
    const next = finishExercise(latest, date, index)
    save(next)
    if (isComplete(next.workouts.find(w => w.date === date))) { setModal('success'); if (latest.settings.sound) chime() }
    else setToast('Есть! Ещё один шаг к сильной привычке.')
  }

  function saveSettings(settings: Settings) {
    save({ ...currentState(), settings })
    setModal(null)
    setToast('Настройки сохранены. Следующая прокрутка — по твоим правилам.')
  }

  const challenges = [
    { name: 'Первый подход', text: 'Закрой первую тренировку', value: progress.completed, target: 1, Icon: Medal },
    { name: 'Поймал ритм', text: 'Три дня без пропусков', value: progress.best, target: 3, Icon: Flame },
    { name: 'Железная неделя', text: 'Семь тренировок в копилке', value: progress.completed, target: 7, Icon: ShieldCheck },
    { name: 'Легенда подвала', text: 'Тридцать тренировок. Уважение.', value: progress.completed, target: 30, Icon: Trophy },
  ]

  return <>
    <a className="skip-link" href="#main">К тренировке</a>
    <header className="site-header">
      <button className="brand" aria-label="Gym Roulette — главная" onClick={() => setView('workout')}><span className="brand-mark"><Dumbbell size={31} strokeWidth={2.5} /></span><span className="brand-wordmark">GYM<span>ROULETTE<span className="brand-period">®</span></span></span></button>
      <nav className="main-nav" aria-label="Главная навигация">
        {([{ id: 'workout', label: 'Тренировка', Icon: Dumbbell }, { id: 'exercises', label: 'Упражнения', Icon: Zap }, { id: 'progress', label: 'Мой прогресс', Icon: Trophy }] as const).map(item => <button key={item.id} className={view === item.id ? 'nav-active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><item.Icon size={17} /><span>{item.label}</span></button>)}
      </nav>
      <button className="header-profile" aria-label="Открыть профиль" onClick={() => setView('progress')}><span className="profile-initial">{state.name.charAt(0).toUpperCase()}</span><span>{state.name}</span><ChevronRight size={16} /></button>
    </header>

    <main id="main" className="page-container">
      <section className="page-heading">
        <div><div className="eyebrow"><span className="short-rule" />ТВОЙ ЛИЧНЫЙ КЛУБ БЕЗ ОТГОВОРОК</div><h1>{view === 'workout' ? <>УДАЧА РЕШАЕТ. <span>ТЫ ДЕЛАЕШЬ.</span></> : view === 'exercises' ? <>ПРОСТЫЕ ДВИЖЕНИЯ. <span>СИЛЬНЫЙ ТЫ.</span></> : <>КАЖДЫЙ ПОДХОД. <span>В ТВОЮ ПОЛЬЗУ.</span></>}</h1><p>{view === 'workout' ? 'Три случайных упражнения — и ты уже лучше, чем вчера.' : view === 'exercises' ? 'Свой вес, немного места и желание двигаться.' : 'Большая привычка складывается из маленьких побед.'}</p></div>
        <div className="daily-stamp" aria-label="Каждый день — новый шанс"><Star size={17} /><span>КАЖДЫЙ ДЕНЬ</span><strong>НОВЫЙ ШАНС</strong><div>★ ★ ★</div></div>
      </section>

      <div className="dashboard-grid">
        <aside className="profile-sidebar">
          <section className="membership-card" aria-labelledby="membership-title">
            <div className="card-topline"><h2 id="membership-title">КЛУБНАЯ КАРТА</h2><Ticket size={17} /></div>
            <div className="member-identity"><div className="member-avatar"><Dumbbell size={32} strokeWidth={1.5} /><span>★</span></div><h3>{state.name}</h3><button className="edit-profile" aria-label="Изменить имя" onClick={() => setModal('profile')}><Pencil size={14} /></button><div className="member-rank">{progress.completed >= 30 ? 'ЛЕГЕНДА' : progress.completed >= 5 ? 'СВОЙ В ЗАЛЕ' : 'НОВИЧОК В ЗАЛЕ'}</div></div>
            <div className="member-stats"><div><span><Flame size={17} />Серия</span><strong>{progress.streak}<small> дн.</small></strong></div><div><span><Dumbbell size={17} />Тренировки</span><strong>{progress.completed}</strong></div><div><span><Check size={17} />Упражнения</span><strong>{progress.exercises}</strong></div></div>
            <div className="member-level"><div><span>{progress.completed >= 30 ? 'Ты — легенда клуба' : 'До нового уровня'}</span><strong>{Math.min(progress.completed, progress.completed < 5 ? 5 : 30)}/{progress.completed < 5 ? 5 : 30}</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, progress.completed / (progress.completed < 5 ? 5 : 30) * 100)}%` }} /></div></div>
            <div className="member-card-bottom"><span>MEMBER OF THE IRON CLUB</span><span className="barcode" aria-hidden="true" /></div>
          </section>

          <section className="week-card" aria-labelledby="week-title"><div className="card-topline"><h2 id="week-title">ТВОЯ НЕДЕЛЯ</h2><CalendarDays size={17} /></div><Week state={state} today={today} /><p>{progress.streak ? `Держишь темп уже ${progress.streak} дн. Так держать!` : 'Начни сегодня. Продолжи завтра.'}</p></section>
          <button className="settings-link" onClick={() => setModal('settings')}><Settings2 size={17} /><span>Настроить рулетку</span><ChevronRight size={15} /></button>
        </aside>

        {view === 'workout' ? <>
          <SlotMachine workout={workout} spinning={spinning} sound={state.settings.sound} onSpin={spin} onSound={() => { const latest = currentState(); save({ ...latest, settings: { ...latest.settings, sound: !latest.settings.sound } }) }} onHelp={() => setModal('help')} onDone={complete} remaining={remainingToday(now)} />
          <aside className="coach-sidebar"><section className="coach-poster"><div className="poster-top"><span>СЛОВО ТРЕНЕРА</span><Star size={15} /></div><div className="coach-speech">{isComplete(workout) ? <>ВОТ ЭТО<br />Я ПОНИМАЮ!</> : <>ЭЙ, БАДДИ.<br />ТВОЙ ВЫХОД!</>}</div><div className="coach-art"><span className="coach-sunburst" aria-hidden="true" /><img src={mascotUrl} width="1122" height="1402" alt="Усатый мультяшный тренер с повязкой на голове показывает большой палец" /></div><div className="coach-quote"><span>«</span><p>{isComplete(workout) ? <>СЕГОДНЯ ТЫ<br />СДЕЛАЛ ДЕЛО.</> : <>ХАРАКТЕР СИЛЬНЕЕ<br />ЛЮБОЙ ОТГОВОРКИ.</>}</p></div><div className="poster-bottom">ТВОЙ ТРЕНЕР. ВСЕГДА В ТВОЁМ УГЛУ.</div></section></aside>
        </> : view === 'exercises' ? <section className="wide-content exercise-library"><div className="content-heading"><div><span className="eyebrow">АРСЕНАЛ СТАРОЙ ШКОЛЫ</span><h2>Всё, что может выпасть</h2></div><button className="secondary-button" onClick={() => setModal('settings')}><Settings2 size={16} />Настроить</button></div><div className="filter-tabs" role="group" aria-label="Категория упражнений">{(['all', 'strength', 'cardio', 'mobility'] as const).map(category => <button key={category} className={filter === category ? 'selected' : ''} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category === 'all' ? 'Все упражнения' : CATEGORY_LABELS[category]}</button>)}</div><div className="exercise-grid">{EXERCISES.filter(e => filter === 'all' || e.category === filter).map(exercise => { const range = state.settings.ranges[exercise.id] ?? exercise; return <article className={`exercise-card ${!state.settings.enabled.includes(exercise.id) ? 'not-in-pool' : ''}`} key={exercise.id}><div className="exercise-card-top"><ExerciseIcon id={exercise.id} size={34} /><span>{CATEGORY_LABELS[exercise.category]}</span></div><h3>{exercise.name}</h3><strong className="exercise-range">{range.min}–{range.max}<small> {exercise.unit}</small></strong><p>{exercise.tip}</p><div className="exercise-card-bottom">{state.settings.enabled.includes(exercise.id) ? <><Check size={13} />В рулетке</> : <><span className="empty-circle" />Не участвует</>}{exercise.equipment && <span>{exercise.equipment}</span>}</div></article> })}</div></section> : <section className="wide-content progress-content"><div className="content-heading"><div><span className="eyebrow">ЛИЧНОЕ ДЕЛО АТЛЕТА</span><h2>Твой путь в клубе</h2></div><History size={26} /></div><div className="progress-summary"><div><Flame size={23} /><strong>{progress.best}<small>дней</small></strong><span>Лучшая серия</span></div><div><Dumbbell size={23} /><strong>{progress.completed}<small>дней</small></strong><span>Тренировок закрыто</span></div><div><Award size={23} /><strong>{challenges.filter(c => c.value >= c.target).length}<small>из 4</small></strong><span>Наград получено</span></div></div>
          <section className="challenges-section" aria-labelledby="challenges-title"><div className="challenges-heading"><div><span className="eyebrow">ЗАРАБОТАЙ СВОЁ УВАЖЕНИЕ</span><h2 id="challenges-title">МАЛЕНЬКИЕ ПОБЕДЫ. <span>БОЛЬШОЙ ХАРАКТЕР.</span></h2></div><span className="challenge-count">{challenges.filter(c => c.value >= c.target).length} / 4 НАГРАДЫ</span></div><div className="challenge-grid">{challenges.map(challenge => { const earned = challenge.value >= challenge.target; return <article key={challenge.name} className={`challenge ${earned ? 'earned' : ''}`}><div className="challenge-badge"><challenge.Icon size={29} strokeWidth={1.5} />{earned ? <BadgeCheck className="badge-lock" size={13} /> : <LockKeyhole className="badge-lock" size={12} />}</div><div className="challenge-details"><h3>{challenge.name}</h3><p>{challenge.text}</p><div className="challenge-progress"><div className="progress-track"><span style={{ width: `${Math.min(100, challenge.value / challenge.target * 100)}%` }} /></div><span>{Math.min(challenge.value, challenge.target)}/{challenge.target}</span></div></div></article> })}</div></section>
          <h3 className="history-heading">ЖУРНАЛ ТРЕНИРОВОК</h3>{state.workouts.length ? <div className="history-list">{[...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).map(w => <article className="history-row" key={w.date}><div className={`history-icon ${isComplete(w) ? 'finished' : ''}`}>{isComplete(w) ? <Check size={22} /> : <Dumbbell size={22} />}</div><div><h4>{new Date(`${w.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h4><p>{w.picks.map(p => `${EXERCISES.find(e => e.id === p.exerciseId)!.name} ${p.amount}`).join(' · ')}</p></div><span>{w.done.filter(Boolean).length}/3</span></article>)}</div> : <div className="empty-progress"><Dumbbell size={45} strokeWidth={1.2} /><h3>История начинается с тебя</h3><p>Первая тренировка — первая запись.<br />Крути рулетку и начни свою серию.</p><button className="primary-button" onClick={() => setView('workout')}>К тренировке</button></div>}</section>}
      </div>

      <footer className="site-footer"><div><Dumbbell size={18} /><span>GYM ROULETTE</span><span className="footer-dot">·</span><span>МЕНЬШЕ СЛОВ. БОЛЬШЕ ПОВТОРОВ.</span></div><button className="text-button" onClick={() => setModal('help')}>ПРАВИЛА КЛУБА <CircleHelp size={14} /></button></footer>
    </main>

    {storageUnavailable && <div className="storage-notice" role="alert">Браузер не разрешает сохранить прогресс. Сейчас он доступен только до закрытия страницы.</div>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setToast('')}><X size={17} /></button></div>}
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
