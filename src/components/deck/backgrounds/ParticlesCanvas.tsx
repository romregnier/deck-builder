import { useRef, useEffect } from 'react'

interface Particle {
  x: number; y: number; vx: number; vy: number
  r: number; alpha: number
  c: [number, number, number]
}

interface ParticlesCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

const PARTICLE_COUNT = 80
const LINK_DISTANCE = 120
const SPEED = 0.5

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

export function ParticlesCanvas({ style, accentColor }: ParticlesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let particles: Particle[] = []
    let animId: number
    const mouse = { x: -9999, y: -9999 }

    const accent: [number, number, number] = accentColor ? hexToRgb(accentColor) : [225, 31, 123]

    const initParticles = () => {
      particles = Array.from({ length: PARTICLE_COUNT }, () => {
        const rnd = Math.random()
        let c: [number, number, number]
        if (rnd < 0.7) c = [255, 255, 255]
        else if (rnd < 0.9) c = accent
        else c = [0, 212, 255]
        return {
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * SPEED,
          vy: (Math.random() - 0.5) * SPEED,
          r: Math.random() * 1.5 + 1.5,
          alpha: Math.random() * 0.4 + 0.4,
          c,
        }
      })
    }

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      initParticles()
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = cv.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    cv.addEventListener('mousemove', onMouseMove)

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0B090D'
      ctx.fillRect(0, 0, W, H)

      // Update & draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse attraction for first particle (the "attracted" one)
        if (i === 0) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200 && dist > 0) {
            p.vx += dx / dist * 0.05
            p.vy += dy / dist * 0.05
            // Clamp speed
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
            if (speed > SPEED * 3) { p.vx = (p.vx / speed) * SPEED * 3; p.vy = (p.vy / speed) * SPEED * 3 }
          }
        }

        p.x += p.vx; p.y += p.vy

        // Bounce
        if (p.x < 0) { p.x = 0; p.vx *= -1 }
        if (p.x > W) { p.x = W; p.vx *= -1 }
        if (p.y < 0) { p.y = 0; p.vy *= -1 }
        if (p.y > H) { p.y = H; p.vy *= -1 }

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${p.alpha})`
        ctx.fill()

        // Draw links
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x; const dy = p.y - q.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK_DISTANCE) {
            const opacity = (1 - dist / LINK_DISTANCE) * 0.5
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      cv.removeEventListener('mousemove', onMouseMove)
    }
  }, [accentColor])

  return <canvas ref={canvasRef} style={style} />
}
