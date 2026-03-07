/**
 * DeckPresentPage.tsx — Mode présentation plein écran
 * Affiche les slides en plein écran avec navigation clavier
 * FIX-VISUAL: couleurs dynamiques theme_json → CSS vars + transitions animées
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { SlideRenderer } from '../components/deck/SlideRenderer'
import { AnimatedBackground } from '../components/deck/AnimatedBackground'
import type { BgType } from '../components/deck/AnimatedBackground'
import type { SlideJSON, DeckTheme, DeckThemeJSON, SlideTransition } from '../types/deck'

// ── useSwipe hook (FIX 6b — Sprint 2) ────────────────────────────────────────
function useSwipe(onLeft: () => void, onRight: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startX = 0
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX
      if (dx < -50) onLeft()
      else if (dx > 50) onRight()
    }
    el.addEventListener('touchstart', onTouchStart)
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onLeft, onRight])
  return ref
}

interface DeckData {
  id: string
  title: string
  theme_json: string | null
}

interface SlideData extends SlideJSON {
  id: string
  deck_id: string
}

// ── useSlideTheme — parse theme_json into typed object ─────────────────────
function useSlideTheme(themeJsonStr: string | null): {
  preset: DeckTheme
  themeJSON: DeckThemeJSON
  bgColor: string
  transition: SlideTransition
} {
  if (!themeJsonStr) {
    const defaultAccent = '#E11F7B'
    return {
      preset: 'dark_premium',
      themeJSON: {
        preset: 'dark_premium',
        accentColor: defaultAccent,
        bgColor: '#06040A',
        accentGradient: `linear-gradient(135deg, ${defaultAccent}, #7C3AED)`,
        textColor: '#F0EDF5',
        gradientText: true,
        glowEffect: true,
        fontSize: 'md',
        transition: 'slide-up',
        // ── Sprint 3+ defaults ──
        bgAnimation: undefined,
        secondaryAccent: undefined,
        textPrimary: undefined,
        textSecondary: undefined,
        noiseEnabled: false,
        noiseOpacity: 0.04,
        animationStagger: 100,
      },
      bgColor: '#06040A',
      transition: 'slide-up',
    }
  }

  try {
    const parsed = JSON.parse(themeJsonStr) as Record<string, unknown>

    // Map legacy theme key
    const rawPreset = (parsed.preset as string) || (parsed.theme as string) || 'DARK_PREMIUM'
    const presetMap: Record<string, DeckTheme> = {
      DARK_PREMIUM: 'dark_premium',
      LIGHT_CLEAN: 'light_clean',
      GRADIENT_BOLD: 'gradient_bold',
      CORPORATE: 'corporate',
      dark_premium: 'dark_premium',
      light_clean: 'light_clean',
      gradient_bold: 'gradient_bold',
      corporate: 'corporate',
    }
    const preset: DeckTheme = presetMap[rawPreset] || 'dark_premium'
    const isLight = preset === 'light_clean' || preset === 'corporate'

    const accentColor = (parsed.accentColor as string) || '#E11F7B'
    const bgColor = (parsed.bgColor as string) || (isLight ? '#FFFFFF' : '#06040A')
    const textColor = (parsed.textColor as string) || (isLight ? '#1A1520' : '#F0EDF5')
    // FIX E — accentGradient dynamique avec secondaryAccent
    const secondaryAccentPP = (parsed.secondaryAccent as string) || undefined
    const accentGradient = (parsed.accentGradient as string)
      || `linear-gradient(135deg, ${accentColor}, ${secondaryAccentPP || '#7C3AED'})`
    const gradientText = parsed.gradientText !== false
    const glowEffect = parsed.glowEffect !== false
    const fontSize = (parsed.fontSize as DeckThemeJSON['fontSize']) || 'md'
    const transition: SlideTransition = (parsed.transition as SlideTransition) || 'slide-up'

    return {
      preset,
      themeJSON: {
        preset,
        accentColor,
        bgColor,
        accentGradient,
        textColor,
        gradientText,
        glowEffect,
        fontSize,
        transition,
        // ── Sprint 3+ ──
        bgAnimation: (parsed.bgAnimation as DeckThemeJSON['bgAnimation']) || undefined,
        secondaryAccent: secondaryAccentPP,
        textPrimary: (parsed.textPrimary as string) || undefined,
        textSecondary: (parsed.textSecondary as string) || undefined,
        noiseEnabled: (parsed.noiseEnabled as boolean) || false,
        noiseOpacity: (parsed.noiseOpacity as number) ?? 0.04,
        animationStagger: (parsed.animationStagger as 0 | 50 | 100 | 200) ?? 100,
        // FIX H + I
        fontFamily: (parsed.fontFamily as DeckThemeJSON['fontFamily']) || undefined,
        lang: (parsed.lang as 'Français' | 'English') || 'Français',
      },
      bgColor,
      transition,
    }
  } catch {
    return {
      preset: 'dark_premium',
      themeJSON: {
        preset: 'dark_premium',
        accentColor: '#E11F7B',
        bgColor: '#06040A',
        accentGradient: 'linear-gradient(135deg, #E11F7B, #7C3AED)',
        textColor: '#F0EDF5',
        gradientText: true,
        glowEffect: true,
        fontSize: 'md',
        transition: 'slide-up',
        // ── Sprint 3+ defaults ──
        bgAnimation: undefined,
        secondaryAccent: undefined,
        textPrimary: undefined,
        textSecondary: undefined,
        noiseEnabled: false,
        noiseOpacity: 0.04,
        animationStagger: 100,
      },
      bgColor: '#06040A',
      transition: 'slide-up',
    }
  }
}

// ── Slide transition variants ──────────────────────────────────────────────
function getTransitionVariants(transitionType: SlideTransition) {
  switch (transitionType) {
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.4 },
      }
    case 'scale':
      return {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.04 },
        transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      }
    case 'slide-up':
    default:
      return {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
        exit: { opacity: 0, y: -24, scale: 0.98, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
        transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      }
  }
}

export function DeckPresentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckData | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showControls, setShowControls] = useState(true)
  // Sprint 3 — Auto-play
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayInterval, setAutoPlayInterval] = useState(5)
  const [countdown, setCountdown] = useState(0)
  const rafRef = useRef<number | null>(null)

  const { preset: theme, themeJSON, bgColor, transition } = useSlideTheme(deck?.theme_json ?? null)

  // Analytics tracking — temps par slide, sessions, durée
  useAnalytics(deck?.id, currentIdx)
  const transitionVariants = getTransitionVariants(transition)

  useEffect(() => {
    if (id) fetchDeck(id)
  }, [id])

  async function fetchDeck(deckId: string) {
    setLoading(true)
    const { data: deckData } = await supabase
      .from('presentations')
      .select('id,title,theme_json')
      .eq('id', deckId)
      .single()

    if (deckData) setDeck(deckData as DeckData)

    const { data: slidesData } = await supabase
      .from('slides')
      .select('*')
      .eq('deck_id', deckId)
      .order('position', { ascending: true })

    if (slidesData) {
      setSlides(slidesData.map(s => ({
        ...s,
        content: s.content_json || {},
      })) as SlideData[])
    }

    setLoading(false)
  }

  const prev = useCallback(() => setCurrentIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setCurrentIdx(i => Math.min(slides.length - 1, i + 1)), [slides.length])

  // Swipe navigation (FIX 6b)
  const swipeRef = useSwipe(next, prev)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') navigate(`/decks/${id}/edit`)
      if (e.key >= '1' && e.key <= '9') setCurrentIdx(Math.min(parseInt(e.key) - 1, slides.length - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, navigate, next, prev])

  // Auto-hide controls
  useEffect(() => {
    setShowControls(true)
    const t = setTimeout(() => setShowControls(false), 3000)
    return () => clearTimeout(t)
  }, [currentIdx])

  // Sprint 3 — Auto-play
  useEffect(() => {
    if (!autoPlay) {
      setCountdown(0)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const startTime = Date.now()
    const duration = autoPlayInterval * 1000
    const frame = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      setCountdown(progress)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        setCurrentIdx(s => {
          if (s >= slides.length - 1) { setAutoPlay(false); return s }
          return s + 1
        })
      }
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [autoPlay, autoPlayInterval, currentIdx, slides.length])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B090D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 40 }}>✨</div>
      </div>
    )
  }

  const currentSlide = slides[currentIdx]
  const progress = ((currentIdx + 1) / slides.length) * 100

  // CSS vars from theme
  const themeCssVars: React.CSSProperties = {
    '--accent': themeJSON.accentColor,
    '--bg': themeJSON.bgColor,
    '--gradient': themeJSON.accentGradient,
    '--text': themeJSON.textColor,
    background: bgColor,
  } as React.CSSProperties

  return (
    <div
      ref={swipeRef}
      data-animated={(() => {
        const bgType: BgType = (themeJSON?.bgAnimation as BgType) ?? (themeJSON?.galaxyBg !== false ? 'galaxy' : 'none')
        return bgType !== 'none' ? 'true' : 'false'
      })()}
      style={{
        width: '100vw', height: '100vh',
        position: 'relative', overflow: 'hidden', cursor: 'none',
        ...themeCssVars,
      }}
      onMouseMove={() => setShowControls(true)}
      onTouchStart={() => setShowControls(true)}
      onClick={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('a, button, [role="button"], select')) return
        next()
      }}
    >
      {/* Animated background */}
      {(() => {
        const bgType: BgType = (themeJSON?.bgAnimation as BgType) ?? (themeJSON?.galaxyBg !== false ? 'galaxy' : 'none')
        return <AnimatedBackground type={bgType} accentColor={themeJSON?.accentColor} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      })()}

      {/* Slide counter top right */}
      <div style={{
        position: 'fixed', top: 20, right: 40,
        fontSize: 12, color: 'rgba(255,255,255,0.5)',
        fontWeight: 500, letterSpacing: '0.08em', zIndex: 100,
        fontFamily: 'Poppins, sans-serif',
      }}>
        {currentIdx + 1} / {slides.length}
      </div>

      {/* Dots navigation */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, alignItems: 'center', zIndex: 100,
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentIdx(i) }}
            style={{
              width: i === currentIdx ? 20 : 6,
              height: 6, borderRadius: i === currentIdx ? 3 : '50%',
              background: i === currentIdx ? (themeJSON.accentColor || '#E11F7B') : 'rgba(255,255,255,0.2)',
              border: 'none', cursor: 'pointer',
              transition: 'all 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Slide */}
      <AnimatePresence mode="wait">
        {currentSlide && (
          <motion.div
            key={currentSlide.id}
            initial={transitionVariants.initial}
            animate={transitionVariants.animate}
            exit={transitionVariants.exit}
            transition={transitionVariants.transition}
            style={{ position: 'absolute', inset: 0, zIndex: 2 }}
          >
            <SlideRenderer
              slide={currentSlide}
              theme={theme}
              themeJSON={themeJSON}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              cursor: 'default',
            }}
          >
            {/* Close */}
            <button
              onClick={e => { e.stopPropagation(); navigate(`/decks/${id}/edit`) }}
              style={{
                position: 'absolute', top: 20, right: 20,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'all',
              }}
            >
              <X size={16} />
            </button>

            {/* Prev / Next */}
            <button
              onClick={e => { e.stopPropagation(); prev() }}
              disabled={currentIdx === 0}
              style={{
                position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: currentIdx === 0 ? 0.3 : 1,
                pointerEvents: 'all',
              }}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={e => { e.stopPropagation(); next() }}
              disabled={currentIdx === slides.length - 1}
              style={{
                position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: currentIdx === slides.length - 1 ? 0.3 : 1,
                pointerEvents: 'all',
              }}
            >
              <ChevronRight size={20} />
            </button>

            {/* Slide counter + auto-play controls */}
            <div style={{
              position: 'absolute', bottom: 20, right: 20,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Poppins, sans-serif',
              pointerEvents: 'all',
            }}>
              {currentIdx + 1} / {slides.length}
              {/* Auto-play toggle */}
              <button
                onClick={e => { e.stopPropagation(); setAutoPlay(p => !p) }}
                style={{
                  background: autoPlay ? 'rgba(225,31,123,0.3)' : 'rgba(255,255,255,0.1)',
                  border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer',
                  padding: '2px 8px', fontSize: 14, lineHeight: 1,
                }}
              >
                {autoPlay ? '⏸' : '▶'}
              </button>
              {autoPlay && (
                <select
                  value={autoPlayInterval}
                  onChange={e => { e.stopPropagation(); setAutoPlayInterval(Number(e.target.value)) }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                    borderRadius: 4, padding: '2px 4px', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                </select>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar — slide position */}
      {!autoPlay && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          background: 'rgba(255,255,255,0.08)',
        }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            style={{
              height: '100%',
              background: themeJSON.accentGradient || 'linear-gradient(90deg, #E11F7B, #7C3AED)',
            }}
          />
        </div>
      )}

      {/* Auto-play countdown bar — Sprint 3 */}
      {autoPlay && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 3, zIndex: 100,
          background: 'rgba(255,255,255,0.1)',
        }}>
          <div style={{
            height: '100%', background: '#E11F7B',
            width: `${(1 - countdown) * 100}%`,
            transition: 'none',
          }} />
        </div>
      )}
    </div>
  )
}

export default DeckPresentPage
