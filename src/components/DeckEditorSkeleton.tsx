/**
 * DeckEditorSkeleton.tsx — DB-50
 * Skeleton placeholder affiché pendant le chargement initial du deck.
 * Imite la structure 3 colonnes : sidebar slides | canvas | props panel.
 */
import { motion } from 'framer-motion'

function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = 8,
  delay = 0,
  style,
  children,
}: {
  width?: string | number
  height?: number
  borderRadius?: number
  delay?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{
        duration: 1.6,
        repeat: Infinity,
        ease: 'easeInOut' as const,
        delay,
      }}
      style={{
        width,
        height,
        borderRadius,
        background: 'rgba(255,255,255,0.07)',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

export function DeckEditorSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B090D',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Poppins, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Topbar skeleton ─────────────────────────────────────────────── */}
      <div style={{
        height: 56,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
      }}>
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkeletonBlock width={30} height={30} borderRadius={6} />
          <SkeletonBlock width={180} height={20} delay={0.05} />
          <SkeletonBlock width={60} height={20} borderRadius={99} delay={0.1} />
        </div>
        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SkeletonBlock width={80} height={30} borderRadius={7} delay={0.08} />
          <SkeletonBlock width={70} height={30} borderRadius={7} delay={0.12} />
          <SkeletonBlock width={80} height={30} borderRadius={7} delay={0.16} />
          <SkeletonBlock width={90} height={30} borderRadius={7} delay={0.2} style={{ background: 'rgba(225,31,123,0.12)' }} />
          <SkeletonBlock width={32} height={32} borderRadius={6} delay={0.24} />
        </div>
      </div>

      {/* ── Main body: 3 colonnes ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* ── Colonne gauche: slides sidebar ────────────────────────── */}
        <div style={{
          width: 240,
          minWidth: 240,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'hidden',
        }}>
          {/* 4 slide thumbnails */}
          {[0, 0.08, 0.16, 0.24].map((delay, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Slide number row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                <SkeletonBlock width={14} height={10} borderRadius={3} delay={delay} />
                <SkeletonBlock width={36} height={10} borderRadius={3} delay={delay + 0.02} />
              </div>
              {/* Thumbnail */}
              <SkeletonBlock
                width="100%"
                height={110}
                borderRadius={8}
                delay={delay}
                style={{
                  background: i === 0
                    ? 'rgba(225,31,123,0.1)'
                    : 'rgba(255,255,255,0.06)',
                  border: i === 0
                    ? '1px solid rgba(225,31,123,0.25)'
                    : '1px solid rgba(255,255,255,0.06)',
                }}
              />
            </div>
          ))}

          {/* Add slide button */}
          <SkeletonBlock width="100%" height={34} borderRadius={6} delay={0.3} style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }} />
        </div>

        {/* ── Canvas central ─────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 16,
        }}>
          {/* Hint bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
            <SkeletonBlock width={260} height={14} borderRadius={4} delay={0.1} />
          </div>

          {/* Main canvas placeholder */}
          <SkeletonBlock
            width="100%"
            height={0}
            borderRadius={12}
            delay={0.05}
            style={{
              height: 'clamp(280px, calc((100vw - 520px) * 9/16), 500px)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Inner skeleton content */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '40px 60px',
            }}>
              <SkeletonBlock width="50%" height={28} borderRadius={6} delay={0.15} />
              <SkeletonBlock width="70%" height={16} borderRadius={4} delay={0.2} />
              <SkeletonBlock width="55%" height={16} borderRadius={4} delay={0.25} />
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <SkeletonBlock width={100} height={36} borderRadius={8} delay={0.3} style={{ background: 'rgba(225,31,123,0.12)' }} />
                <SkeletonBlock width={100} height={36} borderRadius={8} delay={0.35} />
              </div>
            </div>
          </SkeletonBlock>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonBlock width={32} height={32} borderRadius={8} delay={0.15} />
            <SkeletonBlock width={60} height={16} borderRadius={4} delay={0.2} />
            <SkeletonBlock width={32} height={32} borderRadius={8} delay={0.25} />
            <SkeletonBlock width={32} height={32} borderRadius={8} delay={0.3} />
          </div>
        </div>

        {/* ── Panneau droit: props ─────────────────────────────────── */}
        <div style={{
          width: 280,
          minWidth: 280,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '8px 16px 0',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <SkeletonBlock width="50%" height={34} borderRadius={8} delay={0.1} style={{ background: 'rgba(225,31,123,0.1)' }} />
            <SkeletonBlock width="50%" height={34} borderRadius={8} delay={0.15} />
          </div>

          {/* Props content */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Type badge + regen */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <SkeletonBlock width={60} height={22} borderRadius={99} delay={0.1} style={{ background: 'rgba(225,31,123,0.12)' }} />
              <SkeletonBlock width={88} height={28} borderRadius={6} delay={0.15} />
            </div>

            {/* Section label */}
            <SkeletonBlock width={60} height={10} borderRadius={3} delay={0.18} />

            {/* Field items */}
            {[0.2, 0.25, 0.3].map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                <SkeletonBlock width="70%" height={12} borderRadius={3} delay={d} />
                <SkeletonBlock width={16} height={16} borderRadius={3} delay={d + 0.02} />
              </div>
            ))}

            {/* Add button */}
            <SkeletonBlock width="100%" height={28} borderRadius={6} delay={0.35} style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.06)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
