import { useState } from 'react'
import { Check, Flame, Footprints, Trophy } from 'lucide-react'
import { achievementSummary, RARITIES, type Achievement, type AchievementCollection } from '../lib/achievements'
import AchievementBadge, { BadgeArtwork, formatNumber } from './AchievementBadge'
import ExerciseIcon from './ExerciseIcon'
import Modal from './Modal'
import './AchievementsPage.css'

export default function AchievementsPage({ collections }: { collections: AchievementCollection[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const summary = achievementSummary(collections)
  const selected = collections.flatMap(group => group.badges).find(badge => badge.id === selectedId)

  return <section className="achievements-page" aria-labelledby="achievements-page-title">
    <header className="achievements-page-header"><h1 id="achievements-page-title"><Trophy size={29} />ДОСТИЖЕНИЯ</h1><div className="achievement-total"><strong>{summary.unlocked}</strong><span>/ {summary.total} открыто</span></div></header>
    <div className="achievement-collections">{collections.map(collection => <section className="achievement-collection" key={collection.id} aria-labelledby={`collection-${collection.id}`}>
      <div className="achievement-collection-heading">
        <div className="achievement-collection-name">{collection.id === 'streak' ? <Flame size={26} /> : collection.id === 'steps' ? <Footprints size={26} /> : <ExerciseIcon id={collection.id} size={26} />}<h2 id={`collection-${collection.id}`}>{collection.name}</h2></div>
        <p>{collection.id === 'streak' && 'Лучшая серия'} <strong>{formatNumber(collection.total)}</strong> {collection.unit}</p>
      </div>
      {collection.id === 'steps' && collection.total === 0 && <p className="steps-hint">Укажи шаги со своего шагомера, когда отмечаешь ходьбу выполненной.</p>}
      <div className="achievement-gallery">{collection.badges.map(badge => <AchievementBadge key={badge.id} achievement={badge} onSelect={() => setSelectedId(badge.id)} />)}</div>
    </section>)}</div>
    {selected && <AchievementDetails achievement={selected} onClose={() => setSelectedId(null)} />}
  </section>
}

function AchievementDetails({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const remaining = Math.max(0, achievement.target - achievement.total)
  return <Modal title={achievement.name} onClose={onClose} className="achievement-detail-modal">
    <div className="achievement-detail-art"><BadgeArtwork achievement={achievement} /></div>
    <h3>{formatNumber(achievement.target)} <span>{achievement.unit}</span></h3>
    <p className="achievement-detail-rarity">{RARITIES[achievement.tier]}</p>
    {achievement.unlocked ? <p className="achievement-detail-status"><Check size={18} />Достижение открыто</p> : <p className="achievement-detail-status">Осталось {formatNumber(remaining)} {achievement.unit}</p>}
    <progress className="achievement-detail-progress" max={achievement.target} value={Math.min(achievement.target, achievement.total)} aria-label={`Прогресс: ${formatNumber(achievement.total)} из ${formatNumber(achievement.target)} ${achievement.unit}`} />
    <button className="primary-button full-width" onClick={onClose}>Понятно</button>
  </Modal>
}
