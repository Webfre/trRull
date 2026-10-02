import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { EXERCISES, type Settings } from '../lib/workout'
import ExerciseIcon from './ExerciseIcon'

type Props = { settings: Settings; onSave: (settings: Settings) => void; onCancel: () => void; intro?: ReactNode; saveLabel?: string; cancelLabel?: string }

export default function SettingsForm({ settings, onSave, onCancel, intro, saveLabel = 'Сохранить настройки', cancelLabel = 'Отмена' }: Props) {
  const [draft, setDraft] = useState<Settings>(structuredClone(settings))
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.enabled.length) { setError('Оставь хотя бы одно упражнение в рулетке.'); return }
    for (const exercise of EXERCISES) {
      const range = draft.ranges[exercise.id] ?? exercise
      if (exercise.amounts && (!exercise.amounts.includes(range.min) || !exercise.amounts.includes(range.max))) {
        setError(`${exercise.name}: выбери дистанции 1, 5, 10 или 20 км.`)
        return
      }
      if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 1 || range.max > 300 || range.min > range.max) {
        setError(`${exercise.name}: укажи целые числа от 1 до 300. Минимум не должен быть больше максимума.`)
        return
      }
    }
    onSave(draft)
  }
  return <form onSubmit={submit}>
    {intro ?? <p className="modal-intro">Выбери свои упражнения и комфортный объём. Новые настройки применятся к следующей прокрутке.</p>}
    <div className="settings-table-head"><span>УПРАЖНЕНИЕ</span><span>ОТ</span><span>ДО</span></div>
    <div className="settings-exercises">{EXERCISES.map(exercise => {
      const enabled = draft.enabled.includes(exercise.id)
      const range = draft.ranges[exercise.id] ?? exercise
      return <div className={`settings-row ${!enabled ? 'excluded' : ''}`} key={exercise.id}>
        <label className="exercise-choice"><input type="checkbox" checked={enabled} onChange={() => setDraft({ ...draft, enabled: enabled ? draft.enabled.filter(id => id !== exercise.id) : [...draft.enabled, exercise.id] })} /><span className="custom-checkbox">{enabled && <Check size={14} />}</span><ExerciseIcon id={exercise.id} size={22} /><span>{exercise.name}<small>{exercise.equipment ? `${exercise.unit} · ${exercise.equipment}` : exercise.unit}</small></span></label>
        {(['min', 'max'] as const).map(bound => exercise.amounts ? <select key={bound} className="range-input" aria-label={`${exercise.name}: ${bound === 'min' ? 'минимум' : 'максимум'}, км`} value={range[bound]} onChange={e => setDraft({ ...draft, ranges: { ...draft.ranges, [exercise.id]: { ...range, [bound]: Number(e.target.value) } } })}>{exercise.amounts.map(amount => <option key={amount} value={amount}>{amount}</option>)}</select> : <input key={bound} className="range-input" type="number" min="1" max="300" step="1" required aria-label={`${exercise.name}: ${bound === 'min' ? 'минимум' : 'максимум'}, ${exercise.unit}`} value={range[bound]} onChange={event => setDraft({ ...draft, ranges: { ...draft.ranges, [exercise.id]: { min: range.min, max: range.max, [bound]: Number(event.target.value) } } })} />)}
      </div>
    })}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onCancel}>{cancelLabel}</button><button className="primary-button" type="submit"><SlidersHorizontal size={17} />{saveLabel}</button></div>
  </form>
}
