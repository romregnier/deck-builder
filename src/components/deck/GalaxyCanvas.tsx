import { useRef, useEffect } from 'react'

interface Star {
  x: number; y: number; vx: number; vy: number
  r: number; a: number; tw: number; ts: number
  c: [number, number, number]
}

interface Shooter {
  x: number; y: number; vx: number; vy: number
  trail: Array<{x: number; y: number}>
  maxTrail: number; c: [number, number, number]; done: boolean
}

export function GalaxyCanvas({ style, accentColor: _accentColor }: { style?: React.CSSProperties; accentColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let stars: Star[] = []
    let shooters: Shooter[] = []
    let lastShooter = 0
    let animId: number

    const initStars = () => {
      const n = Math.min(200, Math.floor(W * H / 5000))
      stars = Array.from({ length: n }, () => {
        const r = Math.random()
        return {
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08,
          r: Math.random() * 1.6 + 0.2,
          a: Math.random() * 0.35 + 0.05,
          tw: Math.random() * Math.PI * 2,
          ts: Math.random() * 0.015 + 0.005,
          c: r < 0.6 ? [255,255,255] : r < 0.75 ? [225,31,123] : r < 0.9 ? [124,58,237] : [0,212,255] as [number,number,number],
        }
      })
    }

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      initStars()
    }

    const spawnShooter = () => {
      const fromLeft = Math.random() > 0.5
      shooters.push({
        x: fromLeft ? -20 : W + 20, y: Math.random() * H * 0.5,
        vx: fromLeft ? (6 + Math.random() * 4) : -(6 + Math.random() * 4),
        vy: 2 + Math.random() * 2,
        trail: [], maxTrail: 45,
        c: Math.random() > 0.5 ? [255,255,255] : [225,31,123] as [number,number,number],
        done: false,
      })
    }

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, W, H)

      // Nebula blobs
      const blobs = [
        { x: W*0.15, y: H*0.25, r: 300, c: [124,58,237] as [number,number,number], a: 0.04 },
        { x: W*0.8,  y: H*0.6,  r: 350, c: [225,31,123] as [number,number,number], a: 0.04 },
        { x: W*0.5,  y: H*0.8,  r: 280, c: [0,212,255] as [number,number,number],  a: 0.025 },
      ]
      blobs.forEach(b => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${b.a})`)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill()
      })

      // Stars
      stars.forEach(s => {
        s.tw += s.ts
        const a = s.a * (0.6 + 0.4 * Math.sin(s.tw))
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a})`; ctx.fill()
        if (s.r > 1.0) {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4)
          g.addColorStop(0, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a * 0.3})`)
          g.addColorStop(1, 'transparent')
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill()
        }
        s.x += s.vx; s.y += s.vy
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0
      })

      // Shooting stars
      if (ts - lastShooter > 8000 + Math.random() * 6000) { spawnShooter(); lastShooter = ts }
      shooters = shooters.filter(sh => !sh.done)
      shooters.forEach(sh => {
        sh.trail.push({ x: sh.x, y: sh.y })
        if (sh.trail.length > sh.maxTrail) sh.trail.shift()
        sh.x += sh.vx; sh.y += sh.vy
        if (sh.x < -50 || sh.x > W + 50 || sh.y > H + 50) sh.done = true
        for (let i = 1; i < sh.trail.length; i++) {
          const prog = i / sh.trail.length
          ctx.beginPath()
          ctx.moveTo(sh.trail[i-1].x, sh.trail[i-1].y)
          ctx.lineTo(sh.trail[i].x, sh.trail[i].y)
          ctx.strokeStyle = `rgba(${sh.c[0]},${sh.c[1]},${sh.c[2]},${prog * 0.7})`
          ctx.lineWidth = prog * 1.5; ctx.stroke()
        }
      })

      animId = requestAnimationFrame(draw)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    animId = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animId); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0, ...style
      }}
    />
  )
}
