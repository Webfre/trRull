import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Minus } from 'lucide-react'
import { attendanceSummary } from '../lib/attendance'
import { getExercise, isComplete, localDate, type ClubState } from '../lib/workout'
import Modal from './Modal'
import './CalendarHistory.css'

export default function CalendarHistory({ state, today, onClose }: { state: ClubState; today: string; onClose: () => void }) {
  const summary = attendanceSummary(state, today)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(year, monthNumber - 1, 1, 12)
  const firstWeekday = (first.getDay() + 6) % 7
  const length = new Date(year, monthNumber, 0, 12).getDate()
  const cells = Array.from({ length: firstWeekday + length }, (_, index) => index < firstWeekday ? null : localDate(new Date(year, monthNumber - 1, index - firstWeekday + 1, 12)))
  const workout = state.workouts.find(item => item.date === selected)

  function changeMonth(offset: number) {
    const firstDay = localDate(new Date(year, monthNumber - 1 + offset, 1, 12))
    const nextMonth = firstDay.slice(0, 7)
    setMonth(nextMonth)
    setSelected(nextMonth === today.slice(0, 7) ? today : firstDay < summary.startedOn ? summary.startedOn : firstDay)
  }

  return <Modal title="Календарь тренировок" onClose={onClose} className="calendar-modal">
    <p className="calendar-start">В клубе с {new Date(`${summary.startedOn}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div className="attendance-stats"><div><strong>{summary.completed}</strong><span>Закрыто дней</span></div><div><strong>{summary.missed}</strong><span>Пропущено</span></div><div><strong>{summary.missedPercent.toLocaleString('ru-RU')}<small>%</small></strong><span>Пропусков</span></div></div>
    <div className={`attendance-verdict ${summary.missedPercent > 40 ? 'needs-rhythm' : ''}`}><strong>{summary.verdict}</strong><span>{summary.motivation}</span></div>
    <div className="calendar-month-nav"><button className="icon-button" type="button" onClick={() => changeMonth(-1)} disabled={month <= summary.startedOn.slice(0, 7)} aria-label="Предыдущий месяц"><ChevronLeft size={21} /></button><h3>{first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h3><button className="icon-button" type="button" onClick={() => changeMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="Следующий месяц"><ChevronRight size={21} /></button></div>
    <div className="calendar-week-labels" aria-hidden="true">{['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => <span key={day}>{day}</span>)}</div>
    <div className="calendar-month-grid">{cells.map((day, index) => {
      if (!day) return <span key={`empty-${index}`} />
      const record = state.workouts.find(item => item.date === day)
      const finished = isComplete(record)
      const inactive = day < summary.startedOn || day > today
      const missed = !inactive && day < today && !finished
      const partial = !!record?.done.some(Boolean) && !finished
      const status = inactive ? day > today ? 'будущий день' : 'до первого визита' : finished ? 'выполнено' : missed ? partial ? 'частично выполнено, день пропущен' : 'пропущено' : partial ? 'частично выполнено' : 'ещё можно выполнить'
      return <button key={day} className={`calendar-day ${finished ? 'complete' : ''} ${missed ? 'missed' : ''} ${day === today ? 'today' : ''} ${selected === day ? 'selected' : ''}`} disabled={inactive} aria-pressed={selected === day} aria-label={`${day}, ${status}`} onClick={() => setSelected(day)}><span>{Number(day.slice(-2))}</span><span className="calendar-day-symbol">{!inactive && (finished ? <Check size={13} /> : missed ? <Minus size={13} /> : <span className="calendar-today-dot" />)}</span></button>
    })}</div>
    <div className="calendar-legend"><span><i className="legend-complete" />Выполнено</span><span><i className="legend-missed" />Пропуск</span><span><i className="legend-today" />Сегодня</span></div>
    <section className="calendar-day-details" aria-labelledby="calendar-selected-day"><h3 id="calendar-selected-day">{new Date(`${selected}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h3>{workout ? <ul>{workout.picks.map((pick, index) => { const exercise = getExercise(pick.exerciseId)!; return <li key={index} className={workout.done[index] ? 'done' : ''}><span aria-label={workout.done[index] ? 'Выполнено' : 'Не выполнено'}>{workout.done[index] ? <Check size={16} /> : <Minus size={16} />}</span><span>{exercise.name}</span><strong>{pick.amount} {exercise.unit}{pick.steps ? <small> · {pick.steps.toLocaleString('ru-RU')} шагов</small> : null}</strong></li> })}</ul> : <p>{selected === today ? 'Сегодняшняя тренировка ещё не выбрана.' : 'Тренировка не записана.'}</p>}</section>
  </Modal>
}
