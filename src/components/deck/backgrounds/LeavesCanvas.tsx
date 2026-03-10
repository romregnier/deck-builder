import { useRef, useEffect } from 'react'

interface LeavesCanvasProps {
  style?: React.CSSProperties
  accentColor?: string
}

interface Leaf {
  x: number; y: number
  size: number
  speedY: number; speedX: number
  rotation: number; rotSpeed: number
  opacity: number
  sway: number; swayOffset: number
  color: string; type: number
}

const LEAF_COLORS = ['#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9', '#D4A762', '#E8C27A', '#B8860B']

export function LeavesCanvas({ style }: LeavesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let W: number, H: number
    let animId: number
    let leaves: Leaf[] = []
    let t = 0

    const mkLeaf = (startY?: number): Leaf => ({
      x: Math.random() * (W || 800),
      y: startY ?? -(Math.random() * 150),
      size: Math.random() * 12 + 7,
      speedY: Math.random() * 1.0 + 0.5,
      speedX: (Math.random() - 0.5) * 0.6,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      opacity: Math.random() * 0.55 + 0.25,
      sway: Math.random() * 2 + 0.5,
      swayOffset: Math.random() * Math.PI * 2,
      color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
      type: Math.floor(Math.random() * 3),
    })

    const drawLeaf = (l: Leaf) => {
      ctx.save()
      ctx.translate(l.x, l.y)
      ctx.rotate(l.rotation)
      ctx.globalAlpha = l.opacity
      ctx.fillStyle = l.color

      if (l.type === 0) {
        // Feuille ovale simple
        ctx.beginPath()
        ctx.ellipse(0, 0, l.size * 0.4, l.size, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (l.type === 1) {
        // Feuille en amande
        ctx.beginPath()
        ctx.moveTo(0, -l.size)
        ctx.quadraticCurveTo(l.size * 0.6, 0, 0, l.size)
        ctx.quadraticCurveTo(-l.size * 0.6, 0, 0, -l.size)
        ctx.fill()
      } else {
        // Petite feuille avec tige
        ctx.beginPath()
        ctx.ellipse(0, -l.size * 0.2, l.size * 0.35, l.size * 0.7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = l.opacity * 0.5
        ctx.strokeStyle = '#2E7D32'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.moveTo(0, l.size * 0.5)
        ctx.lineTo(0, -l.size)
        ctx.stroke()
      }

      ctx.restore()
    }

    const draw = () => {
      t += 0.01
      ctx.clearRect(0, 0, W, H)

      // Fond naturel chaud
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#F1F8E9')
      bg.addColorStop(0.5, '#E8F5E9')
      bg.addColorStop(1, '#FFF8E1')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Lumière diagonale douce
      const light = ctx.createLinearGradient(W * 0.8, 0, W * 0.2, H)
      light.addColorStop(0, 'rgba(255,249,196,0.12)')
      light.addColorStop(1, 'rgba(200,230,201,0.05)')
      ctx.fillStyle = light
      ctx.fillRect(0, 0, W, H)

      for (const l of leaves) {
        l.y += l.speedY
        l.x += l.speedX + Math.sin(t + l.swayOffset) * l.sway * 0.04
        l.rotation += l.rotSpeed
        if (l.y > H + 20) { const nl = mkLeaf(); Object.assign(l, nl) }
        drawLeaf(l)
      }

      animId = requestAnimationFrame(draw)
    }

    function resize() {
      if (!canvasRef.current) return
      W = canvasRef.current.width = canvasRef.current.offsetWidth
      H = canvasRef.current.height = canvasRef.current.offsetHeight
      leaves = Array.from({ length: 40 }, () => mkLeaf(Math.random() * H))
    }

    resize()
    window.addEventListener('resize', resize)
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={canvasRef} style={style} />
}
