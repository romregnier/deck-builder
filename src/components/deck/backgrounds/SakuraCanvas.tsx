import { useRef, useEffect } from 'react'

interface SakuraCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

interface Petal {
  x: number; y: number
  size: number
  speedY: number; speedX: number
  rotation: number; rotSpeed: number
  opacity: number; sway: number; swayOffset: number
  color: string
}

const PETAL_COLORS = ['#FFB7C5', '#FFCDD5', '#FDE2E8', '#F9A8B8', '#FFD6E0', '#FADADD']

export function SakuraCanvas({ style }: SakuraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let petals: Petal[] = []
    let t = 0

    const mkPetal = (startY?: number): Petal => ({
      x: Math.random() * (W || 800),
      y: startY ?? -(Math.random() * 200),
      size: Math.random() * 8 + 5,
      speedY: Math.random() * 1.2 + 0.6,
      speedX: (Math.random() - 0.5) * 0.5,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.5 + 0.35,
      sway: Math.random() * 1.5 + 0.5,
      swayOffset: Math.random() * Math.PI * 2,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    })

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      petals = Array.from({ length: 55 }, () => mkPetal(Math.random() * H))
    }

    const drawPetal = (p: Petal) => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color

      // Forme pétale ovale
      ctx.beginPath()
      ctx.ellipse(0, 0, p.size * 0.45, p.size, 0, 0, Math.PI * 2)
      ctx.fill()

      // Petite nervure centrale
      ctx.globalAlpha = p.opacity * 0.3
      ctx.strokeStyle = '#ff8fa3'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, -p.size)
      ctx.lineTo(0, p.size)
      ctx.stroke()

      ctx.restore()
    }

    const draw = () => {
      t += 0.012
      ctx.clearRect(0, 0, W, H)

      // Fond doux crème/blanc très léger
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#FFF5F7')
      bg.addColorStop(1, '#FDE8EE')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Brume légère en bas
      const mist = ctx.createLinearGradient(0, H * 0.7, 0, H)
      mist.addColorStop(0, 'rgba(255,245,247,0)')
      mist.addColorStop(1, 'rgba(253,232,238,0.6)')
      ctx.fillStyle = mist
      ctx.fillRect(0, H * 0.7, W, H * 0.3)

      for (const p of petals) {
        p.y += p.speedY
        p.x += p.speedX + Math.sin(t + p.swayOffset) * p.sway * 0.03
        p.rotation += p.rotSpeed
        if (p.y > H + 20) {
          const np = mkPetal()
          Object.assign(p, np)
        }
        drawPetal(p)
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={style} />
}
