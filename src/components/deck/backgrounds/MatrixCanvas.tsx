import { useRef, useEffect } from 'react'

interface MatrixCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF'
const COL_WIDTH = 16
const FONT_SIZE = 14

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [225, 31, 123]
}

export function MatrixCanvas({ style, accentColor }: MatrixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let drops: number[] = []
    let speeds: number[] = []
    // 30% of columns use accent color
    let isAccent: boolean[] = []
    const accent = accentColor ? hexToRgb(accentColor) : null

    const resize = () => {
      W = cv.width = cv.offsetWidth
      H = cv.height = cv.offsetHeight
      const cols = Math.floor(W / COL_WIDTH)
      drops = Array.from({ length: cols }, () => -Math.floor(Math.random() * (H / FONT_SIZE)))
      speeds = Array.from({ length: cols }, () => Math.random() * 0.4 + 0.3)
      isAccent = Array.from({ length: cols }, () => Math.random() < 0.3)
    }

    const draw = () => {
      // Trail effect
      ctx.fillStyle = 'rgba(0,0,0,0.05)'
      ctx.fillRect(0, 0, W, H)

      ctx.font = `${FONT_SIZE}px monospace`
      const cols = Math.floor(W / COL_WIDTH)

      for (let i = 0; i < cols; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const x = i * COL_WIDTH
        const y = drops[i] * FONT_SIZE

        // Head: bright cyan-green
        ctx.fillStyle = '#00ffaa'
        ctx.fillText(char, x, y)

        // Body: dimmer color a few rows above
        if (drops[i] > 2) {
          if (accent && isAccent[i]) {
            ctx.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.7)`
          } else {
            ctx.fillStyle = '#008822'
          }
          const bodyChar = CHARS[Math.floor(Math.random() * CHARS.length)]
          ctx.fillText(bodyChar, x, y - FONT_SIZE * 2)
        }

        drops[i] += speeds[i]

        // Reset when past bottom
        if (drops[i] * FONT_SIZE > H && Math.random() > 0.975) {
          drops[i] = 0
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
    }
  }, [accentColor])

  return <canvas ref={canvasRef} style={style} />
}
