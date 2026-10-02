import { useState, type FormEvent } from 'react'
import { Footprints } from 'lucide-react'
import Modal from './Modal'

export default function WalkingCompletion({ minutes, onComplete, onClose }: { minutes: number; onComplete: (steps?: number) => void; onClose: () => void }) {
  const [steps, setSteps] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const value = steps.trim() ? Number(steps) : undefined
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 100_000)) return
    onComplete(value)
  }
  return <Modal title="Ходьба выполнена" onClose={onClose}>
    <div className="walking-completion-summary"><Footprints size={31} /><strong>{minutes} <small>мин</small></strong></div>
    <form className="profile-form" onSubmit={submit}>
      <label htmlFor="walking-steps">Сколько шагов? <small className="optional-label">Необязательно</small></label>
      <p className="walking-step-help" id="walking-step-help">Укажи шаги за эту прогулку со своего шагомера — они пойдут в достижения.</p>
      <input id="walking-steps" type="number" inputMode="numeric" min="0" max="100000" step="1" value={steps} onChange={event => setSteps(event.target.value)} aria-describedby="walking-step-help" placeholder="Например, 2 000" />
      <button className="primary-button full-width" type="submit">Выполнено</button>
    </form>
  </Modal>
}
