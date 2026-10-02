import type { CSSProperties } from 'react'
import { Check, Flame, Footprints, LockKeyhole } from 'lucide-react'
import { RARITIES, type Achievement } from '../lib/achievements'
import ExerciseIcon from './ExerciseIcon'

export const formatNumber = (value: number) => value.toLocaleString('ru-RU')

export function BadgeArtwork({ achievement }: { achievement: Achievement }) {
  const tier = achievement.tier
  return <span className={`badge-artwork rarity-${tier} ${achievement.unlocked ? 'badge-unlocked' : 'badge-locked'}`} aria-hidden="true" style={{ '--frame-x': `${(tier % 4) * 100 / 3}%`, '--frame-y': `${Math.floor(tier / 4) * 50}%`, '--badge-atlas': `url("${import.meta.env.BASE_URL}assets/achievement-frames.png")` } as CSSProperties}>
    <span className="badge-aura" />
    <span className="badge-frame-art" />
    <span className="badge-exercise-icon">{achievement.groupId === 'streak' ? <Flame size={39} /> : achievement.groupId === 'steps' ? <Footprints size={39} /> : <ExerciseIcon id={achievement.groupId} size={39} />}</span>
    <span className="badge-state-mark">{achievement.unlocked ? <Check size={14} /> : <LockKeyhole size={12} />}</span>
  </span>
}

export default function AchievementBadge({ achievement, onSelect }: { achievement: Achievement; onSelect: () => void }) {
  const remaining = Math.max(0, achievement.target - achievement.total)
  return <button className={`achievement-card ${achievement.unlocked ? 'is-earned' : ''}`} onClick={onSelect} aria-label={`${achievement.name}: ${formatNumber(achievement.target)} ${achievement.unit}. ${RARITIES[achievement.tier]}. ${achievement.unlocked ? 'Открыто' : `Осталось ${formatNumber(remaining)} ${achievement.unit}`}`}>
    <BadgeArtwork achievement={achievement} />
    <span className="achievement-target">{formatNumber(achievement.target)} <small>{achievement.unit}</small></span>
    <span className="achievement-rarity">{RARITIES[achievement.tier]}</span>
    <span className="achievement-mini-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, achievement.total / achievement.target * 100)}%` }} /></span>
    <span className="achievement-progress-label">{achievement.unlocked ? 'ОТКРЫТО' : `${formatNumber(Math.min(achievement.total, achievement.target))} / ${formatNumber(achievement.target)}`}</span>
  </button>
}
