import { useRef, useEffect } from 'react'

interface MinimalCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

export function MinimalCanvas({ style, accentColor = '#E11F7B' }: MinimalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let t = 0
    const [ar, ag, ab] = hexToRgb(accentColor)

    // 3 lignes diagonales + quelques points — ultra-épuré
    const lines = Array.from({ length: 3 }, (_, i) => ({
      y: 0.2 + i * 0.3,
      opacity: 0.03 + i * 0.01,
      speed: 0.00015 + i * 0.0001,
      offset: i * Math.PI * 0.7,
    }))

    const dots = Array.from({ length: 6 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 3 + 1,
      t: Math.random() * Math.PI * 2,
      ts: Math.random() * 0.008 + 0.004,
      opacity: Math.random() * 0.12 + 0.04,
    }))

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
    }

    const draw = () => {
      t += 0.005
      ctx.clearRect(0, 0, W, H)

      // Fond blanc-crème quasi blanc
      ctx.fillStyle = '#FAFAFA'
      ctx.fillRect(0, 0, W, H)

      // Lignes diagonales subtiles
      for (const l of lines) {
        const yPos = H * (l.y + Math.sin(t * l.speed * 200 + l.offset) * 0.03)
        ctx.beginPath()
        ctx.moveTo(-W * 0.1, yPos - W * 0.3)
        ctx.lineTo(W * 1.1, yPos + W * 0.3)
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${l.opacity})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Points pulsants
      for (const d of dots) {
        d.t += d.ts
        const pulse = 1 + Math.sin(d.t) * 0.3
        ctx.beginPath()
        ctx.arc(d.x * W, d.y * H, d.r * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ar},${ag},${ab},${d.opacity})`
        ctx.fill()
      }

      // Bordure subtile en dégradé
      const border = ctx.createLinearGradient(0, 0, W, H)
      border.addColorStop(0, `rgba(${ar},${ag},${ab},0.04)`)
      border.addColorStop(1, `rgba(${ar},${ag},${ab},0.01)`)
      ctx.strokeStyle = border
      ctx.lineWidth = 1
      ctx.strokeRect(8, 8, W - 16, H - 16)

      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [accentColor])

  return <canvas ref={canvasRef} style={style} />
}
