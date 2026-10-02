import { Accessibility, Activity, Bike, BicepsFlexed, Dumbbell, Footprints, HeartPulse, MoveUp, PersonStanding, StretchHorizontal, Timer, Zap } from 'lucide-react'

const icons = {
  squat: Dumbbell, pushup: BicepsFlexed, plank: Timer, walk: Footprints,
  lunge: PersonStanding, bicycle: Bike, stretch: Accessibility, bridge: StretchHorizontal,
  jack: HeartPulse, climber: Activity, pullup: MoveUp, dip: Zap,
}

export default function ExerciseIcon({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  const Icon = icons[id as keyof typeof icons] ?? Dumbbell
  return <Icon size={size} strokeWidth={1.6} className={className} aria-hidden="true" />
}
