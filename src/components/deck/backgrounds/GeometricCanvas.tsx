import { useRef, useEffect } from 'react'

interface GeometricCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

interface Shape {
  type: 'hex' | 'tri'
  x: number; y: number; r: number
  vx: number; vy: number
  rot: number; rotSpeed: number
  color: [number, number, number]
  alpha: number
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotation
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number) {
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 / 3) * i + rotation
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function GeometricCanvas({ style, accentColor }: GeometricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let shapes: Shape[] = []

    const SHAPE_COLORS: Array<[number,number,number]> = [
      [225, 31, 123],
      [124, 58, 237],
      [0, 212, 255],
      [255, 255, 255],
    ]
    if (accentColor) SHAPE_COLORS.push(hexToRgb(accentColor))

    const initShapes = () => {
      const count = 12 + Math.floor(Math.random() * 7)
      shapes = Array.from({ length: count }, () => ({
        type: Math.random() > 0.5 ? 'hex' : 'tri' as 'hex' | 'tri',
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 50 + 30,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.004,
        color: SHAPE_COLORS[Math.floor(Math.random() * SHAPE_COLORS.length)],
        alpha: Math.random() * 0.09 + 0.06,
      }))
    }

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      initShapes()
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0B090D'
      ctx.fillRect(0, 0, W, H)

      for (const s of shapes) {
        s.rot += s.rotSpeed
        s.x += s.vx; s.y += s.vy

        // Wrap around edges
        if (s.x < -s.r * 2) s.x = W + s.r * 2
        if (s.x > W + s.r * 2) s.x = -s.r * 2
        if (s.y < -s.r * 2) s.y = H + s.r * 2
        if (s.y > H + s.r * 2) s.y = -s.r * 2

        const [r, g, b] = s.color
        ctx.strokeStyle = `rgba(${r},${g},${b},${s.alpha})`
        ctx.lineWidth = 1

        if (s.type === 'hex') {
          drawHexagon(ctx, s.x, s.y, s.r, s.rot)
        } else {
          drawTriangle(ctx, s.x, s.y, s.r, s.rot)
        }
        ctx.stroke()
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
