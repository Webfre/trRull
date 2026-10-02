import { useState, type FormEvent } from 'react'
import type { Pick } from '../lib/workout'
import { getExercise } from '../lib/workout'
import ExerciseIcon from './ExerciseIcon'
import Modal from './Modal'

export default function RecordCompletion({ pick, onComplete, onClose }: { pick: Pick; onComplete: (bestSet?: number) => void; onClose: () => void }) {
  const [best, setBest] = useState(String(pick.amount))
  const exercise = getExercise(pick.exerciseId)!
  const step = pick.exerciseId === 'cycling' ? .1 : 1
  const value = Number(best)
  const valid = best.trim() !== '' && Number.isFinite(value) && value > 0 && value <= pick.amount && Math.abs(value / step - Math.round(value / step)) < .000001
  const label = pick.exerciseId === 'cycling' ? 'Лучшая поездка' : pick.exerciseId === 'plank' ? 'Самое долгое удержание' : pick.exerciseId === 'shadowbox' ? 'Самый длинный раунд' : 'Лучший подход'
  function submit(event: FormEvent) { event.preventDefault(); if (valid) onComplete(value) }
  return <Modal title={`${exercise.name}: выполнено`} onClose={onClose}>
    <div className="walking-completion-summary"><ExerciseIcon id={pick.exerciseId} size={31} /><strong>{pick.amount} <small>{exercise.unit}</small></strong></div>
    <p className="record-completion-help" id="record-completion-help">Сделал всё за раз — оставь число. Делил задание — укажи максимум за один подход. Он пойдёт в достижения «За раз».</p>
    <form className="profile-form" onSubmit={submit}>
      <label htmlFor="completed-record">{label}, {exercise.unit}</label>
      <input id="completed-record" aria-describedby="record-completion-help" type="number" inputMode={step < 1 ? 'decimal' : 'numeric'} min={step} max={pick.amount} step={step} required value={best} onChange={event => setBest(event.target.value)} />
      <button className="primary-button full-width" type="submit" disabled={!valid}>Сохранить выполненное</button>
    </form>
    <button className="text-button record-completion-skip" onClick={() => onComplete()}>Выполнено, без рекорда</button>
  </Modal>
}
