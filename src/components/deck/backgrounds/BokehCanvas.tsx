import { useRef, useEffect } from 'react'

interface BokehCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

const ORBS_COUNT = 18

interface Orb {
  x: number; y: number; r: number
  vx: number; vy: number
  color: [number, number, number]
  alpha: number
  tw: number; ts: number
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

export function BokehCanvas({ style, accentColor }: BokehCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let orbs: Orb[] = []

    const COLORS: Array<[number,number,number]> = [
      [225, 31, 123],
      [124, 58, 237],
      [0, 212, 255],
      [255, 255, 255],
    ]
    if (accentColor) COLORS.push(hexToRgb(accentColor))

    const initOrbs = () => {
      orbs = Array.from({ length: ORBS_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 110 + 40,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.07 + 0.05,
        tw: Math.random() * Math.PI * 2,
        ts: Math.random() * 0.005 + 0.003,
      }))
    }

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      initOrbs()
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Dark radial background
      const bg = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.7)
      bg.addColorStop(0, '#1a1025')
      bg.addColorStop(1, '#06040A')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      for (const orb of orbs) {
        orb.tw += orb.ts
        const pulse = 1 + Math.sin(orb.tw) * 0.15
        const r = orb.r * pulse

        orb.x += orb.vx; orb.y += orb.vy
        if (orb.x < -orb.r) orb.x = W + orb.r
        if (orb.x > W + orb.r) orb.x = -orb.r
        if (orb.y < -orb.r) orb.y = H + orb.r
        if (orb.y > H + orb.r) orb.y = -orb.r

        const [cr, cg, cb] = orb.color
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r)
        g.addColorStop(0,   `rgba(${cr},${cg},${cb},${orb.alpha})`)
        g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${orb.alpha * 0.5})`)
        g.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`)

        ctx.beginPath()
        ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [accentColor])

  return <canvas ref={canvasRef} style={style} />
}
