import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, MoveUpRight, Play, RotateCcw, Smartphone } from 'lucide-react'
import { SHIFT_DIRECTIONS, SHIFT_DURATIONS, SHIFT_INTRO_KEY, type ShiftDuration, type ShiftTempo } from '../lib/shift'
import ShiftSession, { type ShiftSessionHandle } from './ShiftSession'
import './ShiftPage.css'

const guideUrl = `${import.meta.env.BASE_URL}assets/shift-guide.png`
const steps = [
  { title: 'Освободи руки', label: 'Подготовка', text: 'Поставь телефон или открой игру на компьютере. Экран должен быть хорошо виден. Возьми лёгкую бутылку двумя руками, держи её перед собой, чуть ниже груди и близко к телу. Можно играть и без веса.', alt: 'Тренер держит бутылку двумя руками перед грудью; телефон стоит перед ним на подставке.' },
  { title: 'Стрелка вбок — повернись', label: 'Влево и вправо', text: 'Плавно поверни корпус и предмет туда, куда указывает стрелка. Дай стопам немного развернуться вместе с телом. Затем вернись в центр. Следуй стрелке на экране, не зеркаль позу тренера.', alt: 'Тренер плавно поворачивается вместе с бутылкой в направлении стрелки вправо.' },
  { title: 'Вверх и вниз — меняй высоту', label: 'Вверх и вниз', text: 'Стрелка вверх — подними предмет до груди. Вниз — опусти к поясу, слегка смягчив колени. Держи предмет рядом с телом: высоко над головой поднимать не нужно.', alt: 'Вертикальная стрелка показывает движение бутылки между поясом и грудью.' },
  { title: 'Соедини два движения', label: 'Диагонали', text: 'Стрелка по диагонали — небольшой поворот в её сторону и движение предмета вверх или вниз. Увидел направление — начинай плавно двигаться, пока стрелка приближается. Затем вернись в центр.', alt: 'Тренер поворачивает корпус и поднимает бутылку к груди по диагональной стрелке.' },
]

function hasSeenIntro() {
  try { return localStorage.getItem(SHIFT_INTRO_KEY) === 'seen' } catch { return false }
}

export default function ShiftPage({ imageUrl }: { imageUrl: string }) {
  const [intro, setIntro] = useState(() => !hasSeenIntro())
  const [step, setStep] = useState(-1)
  const [duration, setDuration] = useState<ShiftDuration>(90)
  const [tempo, setTempo] = useState<ShiftTempo>('gentle')
  const [storageWarning, setStorageWarning] = useState(false)
  const session = useRef<ShiftSessionHandle>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    const previous = document.title
    document.title = 'Сдвиг — игра на движение · GYM ROULETTE'
    return () => { document.title = previous }
  }, [])

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    heading.current?.focus({ preventScroll: true })
  }, [step, intro])

  function finishIntro() {
    setIntro(false)
    try { localStorage.setItem(SHIFT_INTRO_KEY, 'seen') } catch { setStorageWarning(true) }
  }

  return <section className="shift-page" aria-label="Мини-игра Сдвиг">
    <header className="shift-page-heading"><h1><MoveUpRight size={28} />Сдвиг</h1><span>Перерыв в движении</span></header>

    {intro ? <div className="shift-intro">
      {step === -1 ? <div className="shift-welcome">
        <div className="shift-welcome-coach"><img src={imageUrl} width="1122" height="1402" alt="Тренер приветствует тебя" /></div>
        <div className="shift-welcome-copy">
          <span className="shift-eyebrow">Новое занятие в нашем клубе</span>
          <h2 ref={heading} tabIndex={-1}>Сменим ритм?</h2>
          <p>«Я показываю направление — ты двигаешься. Стрелки летят к тебе издалека: сначала неспешно, потом всё быстрее. Пара минут, чтобы отвлечься и размяться».</p>
          <div className="shift-welcome-facts"><span><Smartphone size={18} />Телефон или ПК</span><span><Clock3 size={18} />1–2 минуты</span></div>
          <button className="primary-button shift-primary" onClick={() => setStep(0)}>Покажи, как играть<ChevronRight size={19} /></button>
          <p className="shift-small">8 направлений · движения корпусом · лёгкий предмет в руках</p>
        </div>
      </div> : <div className="shift-tutorial">
        <div className="shift-guide-image" role="img" aria-label={steps[step].alt} style={{ backgroundImage: `url("${guideUrl}")`, backgroundPosition: `${step % 2 * 100}% ${Math.floor(step / 2) * 100}%` }} />
        <div className="shift-tutorial-copy">
          <div className="shift-step-top"><span className="shift-eyebrow">{steps[step].label}</span><span>{step + 1} / {steps.length}</span></div>
          <h2 ref={heading} tabIndex={-1}>{steps[step].title}</h2>
          <p>{steps[step].text}</p>
          <div className="shift-step-progress" aria-label={`Шаг ${step + 1} из ${steps.length}`}>{steps.map((item, index) => <span key={item.label} className={index <= step ? 'is-read' : ''} />)}</div>
          <div className="shift-tutorial-actions"><button className="secondary-button" onClick={() => setStep(step - 1)}><ChevronLeft size={18} />Назад</button><button className="primary-button shift-primary" onClick={() => step === steps.length - 1 ? finishIntro() : setStep(step + 1)}>{step === steps.length - 1 ? 'Всё понятно' : 'Дальше'}{step === steps.length - 1 ? <Check size={18} /> : <ChevronRight size={18} />}</button></div>
        </div>
      </div>}
    </div> : <>
      <div className="shift-lobby">
        <div className="shift-poster" aria-hidden="true"><span>СЛЕДУЙ НАПРАВЛЕНИЮ</span><div className="shift-poster-arrows"><ArrowUpRight /><ArrowUpRight /><ArrowUpRight /></div><strong>СДВИГ</strong><small>Дай голове перерыв.</small></div>
        <div className="shift-setup">
          <span className="shift-eyebrow">Твой маленький перерыв</span>
          <h2 ref={heading} tabIndex={-1}>Меньше мыслей.<br />Больше движения.</h2>
          <fieldset className="shift-options"><legend>Сколько играем?</legend><div>{SHIFT_DURATIONS.map(seconds => <button key={seconds} aria-pressed={duration === seconds} onClick={() => setDuration(seconds)}>{seconds} <span>сек</span></button>)}</div></fieldset>
          <fieldset className="shift-options shift-tempo"><legend>Какой темп?</legend><div><button aria-pressed={tempo === 'gentle'} onClick={() => setTempo('gentle')}>Плавно<small>Для знакомства</small></button><button aria-pressed={tempo === 'lively'} onClick={() => setTempo('lively')}>Бодро<small>Лучше без веса</small></button></div></fieldset>
          <p className="shift-pace-note">{tempo === 'gentle' ? 'От ~5 до ~3 секунд на направление.' : 'От ~2,5 до ~1,3 секунды на направление.'} Ускорение плавное.</p>
          <button className="primary-button shift-primary shift-start" onClick={() => session.current?.start(duration, tempo)}><Play size={20} fill="currentColor" />Начать раунд<ArrowUpRight size={21} /></button>
          <p className="shift-start-hint">5 секунд на подготовку. Касание экрана — пауза.</p>
        </div>
      </div>
      <div className="shift-reminder"><img src={imageUrl} width="1122" height="1402" alt="" /><div><strong>Поставь экран перед собой</strong><p>Двигайся плавно, с небольшой амплитудой. Начни без веса или с лёгкой бутылкой. Если неудобно — снизь темп или сделай паузу.</p></div><button onClick={() => { setStep(0); setIntro(true) }}><RotateCcw size={17} />Как играть</button></div>
      <div className="shift-direction-strip" aria-label="Восемь направлений">{SHIFT_DIRECTIONS.map(direction => <span key={direction.angle} aria-label={direction.label}>{direction.symbol}</span>)}</div>
      <p className="shift-footnote">Движения не отслеживаются. Просто двигайся в своём ритме.</p>
    </>}
    {storageWarning && <p className="shift-storage-warning" role="status">Браузер не сохранил знакомство. После обновления правила могут открыться снова.</p>}
    <ShiftSession ref={session} />
  </section>
}
