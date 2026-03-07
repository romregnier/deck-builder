import { useRef, useEffect } from 'react'

interface WavesCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

const WAVES = [
  { color: [225, 31, 123]  as [number,number,number], alpha: 0.06, speed: 0.0008, freq: 0.012, amp: 30, yBase: 0.75 },
  { color: [124, 58, 237]  as [number,number,number], alpha: 0.08, speed: 0.0005, freq: 0.009, amp: 45, yBase: 0.80 },
  { color: [0, 212, 255]   as [number,number,number], alpha: 0.05, speed: 0.001,  freq: 0.015, amp: 20, yBase: 0.85 },
  { color: [124, 58, 237]  as [number,number,number], alpha: 0.10, speed: 0.0003, freq: 0.007, amp: 60, yBase: 0.70 },
]

export function WavesCanvas({ style }: WavesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    const phases = WAVES.map(() => Math.random() * Math.PI * 2)

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#06040A'
      ctx.fillRect(0, 0, W, H)

      for (let wi = 0; wi < WAVES.length; wi++) {
        const wave = WAVES[wi]
        phases[wi] += wave.speed

        const [r, g, b] = wave.color

        ctx.beginPath()
        ctx.moveTo(0, H)

        for (let x = 0; x <= W; x += 4) {
          const y = wave.yBase * H + Math.sin(x * wave.freq + phases[wi]) * wave.amp
          ctx.lineTo(x, y)
        }

        ctx.lineTo(W, H)
        ctx.closePath()

        // Vertical gradient fill
        const topY = wave.yBase * H - wave.amp * 2
        const grad = ctx.createLinearGradient(0, topY, 0, H)
        grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
        grad.addColorStop(0.3, `rgba(${r},${g},${b},${wave.alpha * 0.5})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},${wave.alpha})`)
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
