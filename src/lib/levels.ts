export const CLUB_LEVELS = [
  { level: 1, days: 0, nickname: 'Новичок в зале' },
  { level: 2, days: 3, nickname: 'Свой на разминке' },
  { level: 3, days: 7, nickname: 'Охотник за повторами' },
  { level: 4, days: 14, nickname: 'Друг гантелей' },
  { level: 5, days: 21, nickname: 'Крепкий орешек' },
  { level: 6, days: 30, nickname: 'Друг железа' },
  { level: 7, days: 45, nickname: 'Мастер подхода' },
  { level: 8, days: 60, nickname: 'Завсегдатай зала' },
  { level: 9, days: 80, nickname: 'Стальной характер' },
  { level: 10, days: 100, nickname: 'Хранитель темпа' },
  { level: 11, days: 125, nickname: 'Титан разминки' },
  { level: 12, days: 150, nickname: 'Мастер дисциплины' },
  { level: 13, days: 175, nickname: 'Сила привычки' },
  { level: 14, days: 200, nickname: 'Атлет старой школы' },
  { level: 15, days: 225, nickname: 'Несгибаемый' },
  { level: 16, days: 250, nickname: 'Живая легенда' },
  { level: 17, days: 280, nickname: 'Чемпион подвала' },
  { level: 18, days: 310, nickname: 'Железный авторитет' },
  { level: 19, days: 340, nickname: 'Хозяин Олимпа' },
  { level: 20, days: 365, nickname: 'Легенда 365' },
] as const

export function clubLevel(completedDays: number) {
  const completed = Math.max(0, Math.floor(completedDays))
  const current = [...CLUB_LEVELS].reverse().find(level => completed >= level.days) ?? CLUB_LEVELS[0]
  const next = CLUB_LEVELS.find(level => level.level === current.level + 1)
  return {
    current, next,
    remaining: next ? Math.max(0, next.days - completed) : 0,
    progress: next ? Math.min(100, (completed - current.days) / (next.days - current.days) * 100) : 100,
  }
}
