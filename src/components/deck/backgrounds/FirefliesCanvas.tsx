import { useRef, useEffect } from 'react'

interface FirefliesCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

interface Firefly {
  x: number; y: number
  vx: number; vy: number
  r: number
  t: number; ts: number    // pulse phase + speed
  trail: Array<{ x: number; y: number }>
  color: [number, number, number]
}

const WARM_COLORS: Array<[number,number,number]> = [
  [255, 220, 80],   // jaune chaud
  [255, 190, 50],   // orange-or
  [180, 255, 120],  // vert lime
  [120, 220, 255],  // bleu ciel doux
]

export function FirefliesCanvas({ style, accentColor }: FirefliesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let flies: Firefly[] = []

    const colors = [...WARM_COLORS]
    if (accentColor) colors.push(hexToRgb(accentColor))

    const mkFly = (): Firefly => ({
      x: Math.random() * (W || 800),
      y: Math.random() * (H || 600),
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2.5 + 1.5,
      t: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.025 + 0.01,
      trail: [],
      color: colors[Math.floor(Math.random() * colors.length)],
    })

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      flies = Array.from({ length: 30 }, mkFly)
    }

    const draw = () => {
      // Fond nuit douce — pas trop sombre
      ctx.fillStyle = 'rgba(8, 12, 28, 0.18)'
      ctx.fillRect(0, 0, W, H)

      for (const f of flies) {
        f.t += f.ts
        // Mouvement fluide avec légère dérive
        f.vx += (Math.random() - 0.5) * 0.02
        f.vy += (Math.random() - 0.5) * 0.015
        f.vx *= 0.98; f.vy *= 0.98
        f.x += f.vx; f.y += f.vy

        // Rebond doux sur les bords
        if (f.x < 0) f.vx += 0.1
        if (f.x > W) f.vx -= 0.1
        if (f.y < 0) f.vy += 0.1
        if (f.y > H) f.vy -= 0.1

        // Trail
        f.trail.push({ x: f.x, y: f.y })
        if (f.trail.length > 12) f.trail.shift()

        const pulse = (Math.sin(f.t) + 1) / 2  // 0..1
        const [cr, cg, cb] = f.color

        // Dessiner le trail
        for (let i = 0; i < f.trail.length - 1; i++) {
          const alpha = (i / f.trail.length) * 0.08 * pulse
          ctx.beginPath()
          ctx.moveTo(f.trail[i].x, f.trail[i].y)
          ctx.lineTo(f.trail[i + 1].x, f.trail[i + 1].y)
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`
          ctx.lineWidth = 0.8
          ctx.stroke()
        }

        // Halo
        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 8)
        glow.addColorStop(0,   `rgba(${cr},${cg},${cb},${0.12 * pulse})`)
        glow.addColorStop(0.4, `rgba(${cr},${cg},${cb},${0.05 * pulse})`)
        glow.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`)
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r * 8, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // Point central lumineux
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r * (0.5 + pulse * 0.5), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.7 + pulse * 0.3})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)

    // Init fond nuit
    const cv2 = canvasRef.current; if (!cv2) return
    const ctx2 = cv2.getContext('2d')!
    const night = ctx2.createLinearGradient(0, 0, 0, cv2.height)
    night.addColorStop(0, '#080C1C')
    night.addColorStop(1, '#0D1530')
    ctx2.fillStyle = night
    ctx2.fillRect(0, 0, cv2.width, cv2.height)

    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [accentColor])

  return <canvas ref={canvasRef} style={style} />
}
