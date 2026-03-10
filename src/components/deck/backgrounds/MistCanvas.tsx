import { useRef, useEffect } from 'react'

interface MistCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

interface Cloud {
  x: number; y: number
  w: number; h: number
  speed: number
  opacity: number
  t: number; ts: number
}

export function MistCanvas({ style }: MistCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let clouds: Cloud[] = []

    const mkCloud = (startX?: number): Cloud => ({
      x: startX ?? -(Math.random() * 400 + 200),
      y: Math.random() * H,
      w: Math.random() * 400 + 200,
      h: Math.random() * 120 + 60,
      speed: Math.random() * 0.25 + 0.05,
      opacity: Math.random() * 0.08 + 0.04,
      t: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.002 + 0.001,
    })

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      clouds = Array.from({ length: 14 }, () => mkCloud(Math.random() * W))
    }

    const drawCloud = (c: Cloud) => {
      const pulse = 1 + Math.sin(c.t) * 0.08
      const w = c.w * pulse
      const h = c.h * pulse

      ctx.save()
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w * 0.6)
      g.addColorStop(0, `rgba(255,255,255,${c.opacity * 1.4})`)
      g.addColorStop(0.5, `rgba(240,248,255,${c.opacity * 0.7})`)
      g.addColorStop(1, `rgba(220,235,255,0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, w * 0.6, h * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Fond très épuré blanc-bleu pâle
      const bg = ctx.createLinearGradient(0, 0, W * 0.3, H)
      bg.addColorStop(0, '#F8FBFF')
      bg.addColorStop(0.5, '#EEF4FF')
      bg.addColorStop(1, '#F5F0FF')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (const c of clouds) {
        c.t += c.ts
        c.x += c.speed
        if (c.x > W + c.w) { const nc = mkCloud(); Object.assign(c, nc) }
        drawCloud(c)
      }

      // Ligne d'horizon subtile
      ctx.globalAlpha = 0.04
      const horizon = ctx.createLinearGradient(0, H * 0.6, 0, H * 0.65)
      horizon.addColorStop(0, 'rgba(100,140,220,0)')
      horizon.addColorStop(0.5, 'rgba(100,140,220,1)')
      horizon.addColorStop(1, 'rgba(100,140,220,0)')
      ctx.fillStyle = horizon
      ctx.fillRect(0, H * 0.6, W, H * 0.05)
      ctx.globalAlpha = 1

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={style} />
}
