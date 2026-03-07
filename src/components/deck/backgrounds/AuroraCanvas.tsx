import { useRef, useEffect } from 'react'

interface AuroraCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

const BANDS = [
  { color: [0, 212, 255]   as [number,number,number], alpha: 0.18, speed: 0.0008, freq: 0.004,  amp: 80,  yBase: 0.3  },
  { color: [124, 58, 237]  as [number,number,number], alpha: 0.15, speed: 0.0006, freq: 0.003,  amp: 100, yBase: 0.45 },
  { color: [225, 31, 123]  as [number,number,number], alpha: 0.12, speed: 0.001,  freq: 0.005,  amp: 60,  yBase: 0.6  },
  { color: [0, 255, 157]   as [number,number,number], alpha: 0.10, speed: 0.0007, freq: 0.0035, amp: 90,  yBase: 0.25 },
]

export function AuroraCanvas({ style }: AuroraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    const phases = BANDS.map(() => Math.random() * Math.PI * 2)

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#030A0F'
      ctx.fillRect(0, 0, W, H)

      for (let b = 0; b < BANDS.length; b++) {
        const band = BANDS[b]
        phases[b] += band.speed

        // Build the path
        ctx.beginPath()
        ctx.moveTo(0, H)

        const points: Array<{x: number; y: number}> = []
        const step = 8
        for (let x = 0; x <= W; x += step) {
          const y = band.yBase * H + Math.sin(x * band.freq + phases[b]) * band.amp
          points.push({ x, y })
        }
        if (points.length === 0) { animId = requestAnimationFrame(draw); return }

        ctx.lineTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length - 1; i++) {
          const cpx = (points[i].x + points[i + 1].x) / 2
          const cpy = (points[i].y + points[i + 1].y) / 2
          ctx.quadraticCurveTo(points[i].x, points[i].y, cpx, cpy)
        }
        const last = points[points.length - 1]
        ctx.lineTo(last.x, last.y)
        ctx.lineTo(W, H)
        ctx.closePath()

        // Gradient fill
        const minY = band.yBase * H - band.amp * 1.5
        const maxY = band.yBase * H + band.amp * 1.5
        const grad = ctx.createLinearGradient(0, minY, 0, maxY)
        const [r, g, bl] = band.color
        grad.addColorStop(0, `rgba(${r},${g},${bl},${band.alpha})`)
        grad.addColorStop(1, `rgba(${r},${g},${bl},0)`)
        ctx.fillStyle = grad
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
  }, [])

  return <canvas ref={canvasRef} style={style} />
}
