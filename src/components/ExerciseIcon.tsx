import { Accessibility, Activity, Bike, BicepsFlexed, Dumbbell, Footprints, HandFist, HeartPulse, MoveUp, PersonStanding, StretchHorizontal, Timer, Zap } from 'lucide-react'

const icons = {
  squat: Dumbbell, pushup: BicepsFlexed, plank: Timer, walk: Footprints,
  lunge: PersonStanding, bicycle: Bike, cycling: Bike, stretch: Accessibility, bridge: StretchHorizontal,
  jack: HeartPulse, climber: Activity, pullup: MoveUp, dip: Zap, shadowbox: HandFist,
}

export default function ExerciseIcon({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  if (id === 'rope') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M5 9v6a7 7 0 0 0 14 0V9" /><rect x="3" y="2" width="4" height="7" rx="2" /><rect x="17" y="2" width="4" height="7" rx="2" /></svg>
  const Icon = icons[id as keyof typeof icons] ?? Dumbbell
  return <Icon size={size} strokeWidth={1.6} className={className} aria-hidden="true" />
}
