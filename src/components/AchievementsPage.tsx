import { useState } from 'react'
import { Check, Flame, Footprints, Trophy } from 'lucide-react'
import { achievementSummary, RARITIES, type Achievement, type AchievementCollection, type AchievementMode } from '../lib/achievements'
import AchievementBadge, { BadgeArtwork, formatNumber } from './AchievementBadge'
import ExerciseIcon from './ExerciseIcon'
import Modal from './Modal'
import './AchievementsPage.css'

export default function AchievementsPage({ collections: totalCollections, singleCollections }: { collections: AchievementCollection[]; singleCollections: AchievementCollection[] }) {
  const [mode, setMode] = useState<AchievementMode>('total')
  const [unlockedOnly, setUnlockedOnly] = useState(false)
  const collections = mode === 'single' ? singleCollections : totalCollections
  const visibleCollections = unlockedOnly
    ? collections.map(collection => ({ ...collection, badges: collection.badges.filter(badge => badge.unlocked) })).filter(collection => collection.badges.length > 0)
    : collections
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const summary = achievementSummary(collections)
  const selected = collections.flatMap(group => group.badges).find(badge => badge.id === selectedId)

  return <section className="achievements-page" aria-labelledby="achievements-page-title">
    <header className="achievements-page-header"><h1 id="achievements-page-title"><Trophy size={29} />ДОСТИЖЕНИЯ</h1><div className="achievement-total"><strong>{summary.unlocked}</strong><span>/ {summary.total} открыто</span></div></header>
    <div className="achievement-toolbar">
      <div className="achievement-modes" role="group" aria-label="Как считать достижения">{(['total', 'single'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setSelectedId(null) }}>{value === 'total' ? 'Всего' : 'За раз'}</button>)}</div>
      <button className="achievement-open-filter" type="button" aria-pressed={unlockedOnly} aria-controls="achievement-collections" onClick={() => setUnlockedOnly(value => !value)}>{unlockedOnly ? <Check size={18} /> : <Trophy size={18} />}Показать открытые</button>
    </div>
    {mode === 'single' && <p className="achievement-mode-hint">Лучший подтверждённый подход, раунд или удержание. Велосипед — одна поездка, шаги — одна прогулка. Рекорд указывается при выполнении задания.</p>}
    <div className="achievement-collections" id="achievement-collections">{visibleCollections.map(collection => <section className="achievement-collection" key={collection.id} aria-labelledby={`collection-${collection.id}`}>
      <div className="achievement-collection-heading">
        <div className="achievement-collection-name">{collection.id === 'streak' ? <Flame size={26} /> : collection.id === 'steps' ? <Footprints size={26} /> : <ExerciseIcon id={collection.id} size={26} />}<h2 id={`collection-${collection.id}`}>{collection.name}</h2></div>
        <p>{mode === 'single' ? 'Рекорд' : collection.id === 'streak' ? 'Лучшая серия' : ''} <strong>{formatNumber(collection.total)}</strong> {collection.unit}</p>
      </div>
      {collection.id === 'steps' && collection.total === 0 && <p className="steps-hint">Укажи шаги со своего шагомера, когда отмечаешь ходьбу выполненной.</p>}
      <div className="achievement-gallery">{collection.badges.map(badge => <AchievementBadge key={badge.id} achievement={badge} onSelect={() => setSelectedId(badge.id)} />)}</div>
    </section>)}{visibleCollections.length === 0 && <div className="achievement-filter-empty" role="status"><Trophy size={35} aria-hidden="true" /><h2>Пока нет открытых достижений</h2><p>В режиме «{mode === 'single' ? 'За раз' : 'Всего'}» ещё не открыто ни одной награды.</p><button className="secondary-button" onClick={() => setUnlockedOnly(false)}>Показать все достижения</button></div>}</div>
    {selected && <AchievementDetails achievement={selected} onClose={() => setSelectedId(null)} />}
  </section>
}

function AchievementDetails({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const remaining = Math.max(0, achievement.target - achievement.total)
  return <Modal title={achievement.name} onClose={onClose} className="achievement-detail-modal">
    <div className="achievement-detail-art"><BadgeArtwork achievement={achievement} /></div>
    <h3>{formatNumber(achievement.target)} <span>{achievement.unit}</span></h3>
    <p className="achievement-detail-rarity">{RARITIES[achievement.tier]}</p>
    {achievement.mode === 'single' && <p className="achievement-detail-rarity">За раз · твой рекорд {formatNumber(achievement.total)} {achievement.unit}</p>}
    {achievement.unlocked ? <p className="achievement-detail-status"><Check size={18} />Достижение открыто</p> : <p className="achievement-detail-status">{achievement.mode === 'single' ? `Нужно ${formatNumber(achievement.target)} ${achievement.unit} за раз` : `Осталось ${formatNumber(remaining)} ${achievement.unit}`}</p>}
    <progress className="achievement-detail-progress" max={achievement.target} value={Math.min(achievement.target, achievement.total)} aria-label={`Прогресс: ${formatNumber(achievement.total)} из ${formatNumber(achievement.target)} ${achievement.unit}`} />
    <button className="primary-button full-width" onClick={onClose}>Понятно</button>
  </Modal>
}
