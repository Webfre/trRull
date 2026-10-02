import { useEffect, useRef } from 'react'
import './ComboConfetti.css'

const COLORS = ['#edbd57', '#ba392c', '#fff0ca', '#58714b', '#d98149', '#f8f5ec']

export default function ComboConfetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canvas = ref.current!
    const context = canvas.getContext('2d')
    if (!context || reducedMotion.matches) return

    let width = window.innerWidth
    let height = window.innerHeight
    let frame = 0
    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const particles = Array.from({ length: width < 600 ? 100 : 160 }, (_, index) => {
      const fromLeft = index % 2 === 0
      return {
        x: fromLeft ? width * .06 : width * .94,
        y: height * .68,
        vx: (fromLeft ? 1 : -1) * (width * (.18 + Math.random() * .55)),
        vy: -height * (.65 + Math.random() * .5),
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - .5) * 12,
        size: 5 + Math.random() * 6,
        delay: Math.random() * .45,
        color: COLORS[index % COLORS.length],
        round: index % 5 === 0,
      }
    })
    const start = performance.now()
    let last = start
    const draw = (now: number) => {
      context.clearRect(0, 0, width, height)
      const elapsed = (now - start) / 1000
      if (reducedMotion.matches || elapsed >= 5) return
      const delta = Math.min((now - last) / 1000, .04)
      last = now
      for (const particle of particles) {
        if (elapsed < particle.delay) continue
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        particle.vx *= Math.pow(.7, delta)
        particle.vy += height * .48 * delta
        particle.angle += particle.spin * delta
        context.save()
        context.globalAlpha = Math.min(1, (5 - elapsed) / 1.2)
        context.translate(particle.x, particle.y)
        context.rotate(particle.angle)
        context.scale(Math.cos(elapsed * 7 + particle.spin) * .6 + .4, 1)
        context.fillStyle = particle.color
        if (particle.round) {
          context.beginPath()
          context.arc(0, 0, particle.size * .45, 0, Math.PI * 2)
          context.fill()
        } else context.fillRect(-particle.size / 2, -particle.size / 3, particle.size, particle.size * .65)
        context.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); context.clearRect(0, 0, width, height) }
  }, [])

  return <canvas ref={ref} className="combo-confetti" aria-hidden="true" />
}
