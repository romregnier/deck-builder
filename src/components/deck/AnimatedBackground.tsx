import { GalaxyCanvas } from './GalaxyCanvas'
import { ParticlesCanvas } from './backgrounds/ParticlesCanvas'
import { AuroraCanvas } from './backgrounds/AuroraCanvas'
import { MatrixCanvas } from './backgrounds/MatrixCanvas'
import { BokehCanvas } from './backgrounds/BokehCanvas'
import { GeometricCanvas } from './backgrounds/GeometricCanvas'
import { WavesCanvas } from './backgrounds/WavesCanvas'

export type BgType = 'galaxy' | 'particles' | 'aurora' | 'matrix' | 'bokeh' | 'geometric' | 'waves' | 'none'

interface AnimatedBackgroundProps {
  type: BgType
  accentColor?: string
  style?: React.CSSProperties
}

const CANVAS_STYLE: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  pointerEvents: 'none', zIndex: 0,
}

export function AnimatedBackground({ type, accentColor, style }: AnimatedBackgroundProps) {
  if (type === 'none') return null
  const props = { style: { ...CANVAS_STYLE, ...style }, accentColor }
  switch (type) {
    case 'galaxy':    return <GalaxyCanvas {...props} />
    case 'particles': return <ParticlesCanvas {...props} />
    case 'aurora':    return <AuroraCanvas {...props} />
    case 'matrix':    return <MatrixCanvas {...props} />
    case 'bokeh':     return <BokehCanvas {...props} />
    case 'geometric': return <GeometricCanvas {...props} />
    case 'waves':     return <WavesCanvas {...props} />
    default:          return null
  }
}
