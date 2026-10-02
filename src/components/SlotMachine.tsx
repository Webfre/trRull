import { useMemo } from 'react'
import { Check, CircleHelp, Dumbbell, RotateCw, Settings2, Volume2, VolumeX } from 'lucide-react'
import { EXERCISES, getExercise, isComplete, type Workout } from '../lib/workout'
import ExerciseIcon from './ExerciseIcon'

type Props = { workout?: Workout; spinning: boolean; sound: boolean; onSpin: () => void; onSound: () => void; onHelp: () => void; onSettings: () => void; onDone: (index: number) => void }
const preview = [{ exerciseId: 'squat', amount: 20 }, { exerciseId: 'plank', amount: 30 }, { exerciseId: 'walk', amount: 15 }]

export default function SlotMachine({ workout, spinning, sound, onSpin, onSound, onHelp, onSettings, onDone }: Props) {
  const picks = workout?.picks ?? preview
  const completed = isComplete(workout)
  const sequences = useMemo(() => picks.map((pick, column) => [
    ...Array.from({ length: 16 }, (_, index) => ({ exerciseId: EXERCISES[(index * 3 + column * 5) % EXERCISES.length].id, amount: 10 })), pick,
  ]), [workout]) // The reel sequence stays fixed during an active spin.

  return <section className="roulette-section" aria-labelledby="roulette-title">
    <div className="section-eyebrow"><button className="settings-link" onClick={onSettings}><Settings2 size={17} /><span>Настроить рулетку</span></button><button className="text-button help-button" onClick={onHelp} aria-label="Чё кого, бро? — правила клуба"><CircleHelp size={15} />Чё кого, бро?</button></div>
    <div className={`slot-machine ${spinning ? 'is-spinning' : ''} ${completed ? 'is-complete' : ''}`}>
      <span className="machine-screw screw-tl" /><span className="machine-screw screw-tr" /><span className="machine-screw screw-bl" /><span className="machine-screw screw-br" />
      <div className="machine-topline"><span className="machine-rule" /><span className="small-star">✦</span><span>NO PAIN, NO GAME</span><span className="small-star">✦</span><span className="machine-rule" /></div>
      <h2 id="roulette-title" className="machine-title">GYM <span>ROULETTE</span></h2>
      <div className="reel-labels" aria-hidden="true"><span>01 — РАЗОГРЕЙСЯ</span><span>02 — СОБЕРИСЬ</span><span>03 — ДОЖМИ</span></div>
      <div className="reels" aria-label={spinning ? 'Рулетка вращается' : 'Три упражнения'} aria-busy={spinning}>
        {picks.map((pick, index) => {
          const exercise = getExercise(pick.exerciseId)!
          return <div className={`reel ${workout?.done[index] ? 'reel-done' : ''}`} key={index}>
            <span className="reel-tick left" /><span className="reel-tick right" />
            {workout?.done[index] && <Check className="reel-check" size={18} aria-label="Выполнено" />}
            <div className={`reel-strip ${spinning ? 'rolling' : ''}`} style={{ '--reel-duration': `${2 + index * .35}s` } as React.CSSProperties}>
              {(spinning ? sequences[index] : [pick]).map((item, itemIndex) => {
                const current = getExercise(item.exerciseId)!
                return <div className="reel-item" key={itemIndex} aria-hidden={spinning || undefined}>
                  <div className={`exercise-emblem emblem-${current.id}`}><ExerciseIcon id={current.id} size={51} /></div>
                  <h3>{current.name}</h3>
                  <p className={workout ? 'reel-amount' : 'reel-preview'}>{workout ? <><strong>{item.amount}</strong> {current.unit}</> : '???'}</p>
                </div>
              })}
            </div>
            <span className="sr-only">{!spinning && workout ? `${exercise.name}, ${pick.amount} ${exercise.unit}` : ''}</span>
          </div>
        })}
      </div>
      <div className="machine-caption"><span>★</span><span>{spinning ? 'ЖЕЛЕЗО ВЫБИРАЕТ. ТЫ ГОТОВИШЬСЯ.' : workout ? completed ? 'ЕЩЁ ОДИН ДЕНЬ В КОПИЛКУ ХАРАКТЕРА' : 'СЛУЧАЙ ВЫБРАЛ. ТЕПЕРЬ ТВОЯ ОЧЕРЕДЬ.' : 'ИСПЫТАЙ УДАЧУ. ПРОКАЧАЙ ХАРАКТЕР.'}</span><span>★</span></div>
      <div className="machine-controls">
        <span className="control-side"><Dumbbell size={20} /><span>OLD SCHOOL<br />TRAINING CLUB</span></span>
        <button className="spin-button" onClick={onSpin} disabled={spinning}>
          {completed ? <Check size={22} /> : <RotateCw size={22} className={spinning ? 'rotating' : ''} />}
          {spinning ? 'КРУТИМ...' : workout ? 'НА СЕГОДНЯ ВСЁ' : 'КРУТИТЬ РУЛЕТКУ'}
        </button>
        <button className="sound-button" onClick={onSound} aria-label={sound ? 'Выключить звук' : 'Включить звук'} aria-pressed={sound}>{sound ? <Volume2 size={22} /> : <VolumeX size={22} />}<span>{sound ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ'}</span></button>
      </div>
    </div>
    {workout && !spinning && <div className="workout-checklist" aria-live="polite">
      {workout.picks.map((pick, index) => {
        const exercise = getExercise(pick.exerciseId)!
        return <button key={index} className={`workout-task ${workout.done[index] ? 'task-done' : ''}`} aria-pressed={workout.done[index]} onClick={() => onDone(index)} disabled={workout.done[index]}><span className="task-checkbox">{workout.done[index] && <Check size={17} />}</span><span><strong>{exercise.name}</strong><small>{pick.amount} {exercise.unit}</small></span><span className="task-action">{workout.done[index] ? 'Готово' : 'Выполнено'}</span></button>
      })}
    </div>}
  </section>
}
