/**
 * SlideRenderer.tsx — Template engine pour les slides
 * TK-0034-0039 / TK-0040 (charts module)
 * DB-12 — Drag-and-drop réordonnancement via @dnd-kit
 * DB-13 — Redimensionner le texte inline via A−/A+
 *
 * Rend une slide selon son type en utilisant les classes CSS d'Aria.
 * TK-0040: 4 types de graphiques SVG natif — Bar, Line, Pie, Donut
 * FIX-VISUAL: glow atmosphérique, gradient text hero, typographie agrandie,
 *             card glow stats/quote, pillar line content
 */
import './aria-deck.css'
import React from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SlideJSON, DeckTheme, DeckThemeJSON, SlideBackground } from '../../types/deck'
import { BACKGROUND_PRESETS } from '../../types/deck'
import { EditableField } from './EditableField'

// ── DB-12 — SortableItem wrapper ─────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 4,
        width: '100%',
      }}
      {...attributes}
    >
      {/* Drag handle */}
      <span
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '2px 4px',
          color: 'rgba(255,255,255,0.2)',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          userSelect: 'none',
          touchAction: 'none',
        }}
        title="Glisser pour réordonner"
      >
        ⠿
      </span>
      {children}
    </div>
  )
}

// ── Background CSS helper ─────────────────────────────────────────────────────
function getSlideBackground(bg?: SlideBackground, theme?: DeckThemeJSON): string {
  if (!bg || bg.mode === 'theme') return theme?.bgColor ?? ''
  if (bg.mode === 'solid') return bg.solidColor ?? ''
  if (bg.mode === 'gradient') {
    const angle = bg.gradientAngle ?? 135
    const c1 = bg.gradientColor1 ?? '#1A0533'
    const c2 = bg.gradientColor2 ?? '#0D1B4A'
    return `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`
  }
  if (bg.mode === 'preset') {
    const preset = BACKGROUND_PRESETS.find(p => p.id === bg.presetId)
    return preset?.css ?? (theme?.bgColor ?? '')
  }
  return theme?.bgColor ?? ''
}

// Map theme key → data-theme attribute
const THEME_MAP: Record<string, string> = {
  dark_premium: 'DARK_PREMIUM',
  light_clean: 'LIGHT_CLEAN',
  gradient_bold: 'GRADIENT_BOLD',
  corporate: 'CORPORATE',
  DARK_PREMIUM: 'DARK_PREMIUM',
  LIGHT_CLEAN: 'LIGHT_CLEAN',
  GRADIENT_BOLD: 'GRADIENT_BOLD',
  CORPORATE: 'CORPORATE',
}

// ── Atmospheric glow per slide type ─────────────────────────────────────────
const SLIDE_GLOWS: Record<string, string> = {
  hero:       'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(225,31,123,0.10) 0%, transparent 70%)',
  content:    'radial-gradient(ellipse 60% 60% at 20% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)',
  stats:      'radial-gradient(ellipse 60% 60% at 80% 50%, rgba(0,212,255,0.07) 0%, transparent 70%)',
  quote:      'radial-gradient(ellipse 50% 70% at 30% 50%, rgba(124,58,237,0.09) 0%, transparent 70%)',
  cta:        'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(225,31,123,0.12) 0%, rgba(124,58,237,0.06) 50%, transparent 80%)',
  chart:      'radial-gradient(ellipse 60% 60% at 70% 50%, rgba(0,212,255,0.07) 0%, transparent 70%)',
  timeline:   'radial-gradient(ellipse 60% 80% at 50% 40%, rgba(124,58,237,0.10) 0%, transparent 70%)',
  comparison: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(225,31,123,0.08) 0%, rgba(0,212,255,0.05) 60%, transparent 80%)',
  features:   'radial-gradient(ellipse 70% 70% at 50% 30%, rgba(124,58,237,0.08) 0%, transparent 70%)',
  pricing:    'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(225,31,123,0.08) 0%, rgba(124,58,237,0.05) 60%, transparent 80%)',
  team:       'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(0,212,255,0.07) 0%, transparent 70%)',
  roadmap:    'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(225,31,123,0.07) 0%, rgba(0,212,255,0.04) 60%, transparent 80%)',
  market:     'radial-gradient(ellipse 60% 70% at 80% 50%, rgba(225,31,123,0.08) 0%, transparent 70%)',
  orbit:      'radial-gradient(ellipse 60% 70% at 30% 50%, rgba(124,58,237,0.09) 0%, transparent 70%)',
  mockup:     'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,212,255,0.07) 0%, transparent 70%)',
}

// ── DB-10 P2-2 — hex to RGB components helper ────────────────────────────────
function hexToRgbComponents(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '124, 58, 237'
  return `${r}, ${g}, ${b}`
}

// ── Eyebrow component ────────────────────────────────────────────────────────
export function Eyebrow({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
      textTransform: 'uppercase', color: 'var(--accent, #E11F7B)',
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 20, ...style,
    }}>
      <span style={{ width: 24, height: 1.5, background: 'var(--accent, #E11F7B)', display: 'block', flexShrink: 0 }} />
      {text}
    </div>
  )
}

export interface SlideRendererProps {
  slide: SlideJSON
  theme: DeckTheme | string
  /** CSS variables injected from theme_json (accent, bg, gradient, text) */
  themeJSON?: DeckThemeJSON
  /** Si true, affiche en mode miniature (désactive les animations) */
  thumbnail?: boolean
  // ── Inline edit ──
  editMode?: boolean
  selectedFieldId?: string | null
  onFieldSelect?: (fieldId: string) => void
  onFieldSave?: (fieldId: string, value: string) => void
  onImageClick?: (fieldId: string) => void
  // DB-11 — Supprimer un item de liste
  onRemoveItem?: (path: string, index: number) => void
  // DB-14 — Ajouter un item de liste
  onAddItem?: (path: string, defaultValue: unknown) => void
  // DB-12 — Réordonner un item de liste
  onReorderItems?: (path: string, newArray: unknown[]) => void
  // DB-13 — Redimensionner le texte inline
  onUpdateFontSize?: (path: string, delta: number) => void
}

export function SlideRenderer({
  slide, theme, themeJSON, thumbnail = false,
  editMode, selectedFieldId, onFieldSelect, onFieldSave, onImageClick,
  onRemoveItem, onAddItem, onReorderItems, onUpdateFontSize,
}: SlideRendererProps) {
  const dataTheme = THEME_MAP[theme] || 'DARK_PREMIUM'
  const glowEnabled = themeJSON?.glowEffect !== false // default ON
  const gradientTextEnabled = themeJSON?.gradientText !== false // default ON

  // Build CSS vars from themeJSON
  const cssVars: React.CSSProperties = {}
  if (themeJSON?.accentColor) (cssVars as Record<string, string>)['--accent'] = themeJSON.accentColor
  if (themeJSON?.bgColor) {
    (cssVars as Record<string, string>)['--bg'] = themeJSON.bgColor
    ;(cssVars as Record<string, string>)['--slide-bg'] = themeJSON.bgColor
    // FIX C2 — n'appliquer le background solide que si pas de fond animé actif
    if (!themeJSON.bgAnimation || themeJSON.bgAnimation === 'none') {
      ;(cssVars as Record<string, string>)['background'] = themeJSON.bgColor
    }
  }
  if (themeJSON?.accentGradient) (cssVars as Record<string, string>)['--gradient'] = themeJSON.accentGradient
  if (themeJSON?.textColor) {
    (cssVars as Record<string, string>)['--text-pri'] = themeJSON.textColor
    ;(cssVars as Record<string, string>)['--text'] = themeJSON.textColor
  }
  // Sprint 3 — CSS vars supplémentaires
  ;(cssVars as Record<string, string>)['--accent-secondary'] =
    themeJSON?.secondaryAccent || themeJSON?.accentColor || '#7C3AED'
  // DB-10 P2-2 — accent-secondary-rgb pour rgba() dans les stats cards
  ;(cssVars as Record<string, string>)['--accent-secondary-rgb'] = hexToRgbComponents(
    themeJSON?.secondaryAccent || '#7C3AED'
  )
  // Sprint 3 — Stagger animatino delay as CSS var (ms)
  ;(cssVars as Record<string, string>)['--stagger'] =
    `${themeJSON?.animationStagger ?? 100}ms`
  if (themeJSON?.textPrimary) {
    (cssVars as Record<string, string>)['--text-pri'] = themeJSON.textPrimary
    ;(cssVars as Record<string, string>)['--text'] = themeJSON.textPrimary
  }
  if (themeJSON?.textSecondary) {
    (cssVars as Record<string, string>)['--text-sec'] = themeJSON.textSecondary === 'auto'
      ? `${themeJSON.textPrimary || '#F5F0F7'}80`
      : themeJSON.textSecondary
  }

  // Apply per-slide background override
  const slideBg = (slide.content as { slideBackground?: SlideBackground }).slideBackground
  const slideBgCSS = getSlideBackground(slideBg, themeJSON)
  if (slideBgCSS) {
    (cssVars as Record<string, string>)['background'] = slideBgCSS
  }

  return (
    <div
      data-theme={dataTheme}
      data-thumbnail={thumbnail ? 'true' : undefined}
      data-animated={themeJSON?.bgAnimation && themeJSON.bgAnimation !== 'none' ? 'true' : undefined}
      data-da={themeJSON?.da}
      style={{
        width: '100%',
        height: '100%',
        fontFamily: `${themeJSON?.fontFamily || 'Poppins'}, sans-serif`,
        overflow: 'hidden',
        position: 'relative',
        ...cssVars,
      }}
    >
      {/* Atmospheric glow layer — FIX D: zIndex 3 + overlay blend */}
      {glowEnabled && !thumbnail && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: SLIDE_GLOWS[slide.type] || SLIDE_GLOWS.content,
            zIndex: 3,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {/* Noise grain overlay — Sprint 3 — FIX G: screen blend + 0.08 default */}
      {!thumbnail && themeJSON?.noiseEnabled && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
            opacity: themeJSON.noiseOpacity ?? 0.08,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            mixBlendMode: 'screen',
          }}
        />
      )}
      {/* Slide content */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        {renderSlide(slide, thumbnail, gradientTextEnabled, themeJSON, {
          editMode: thumbnail ? false : editMode,
          selectedFieldId,
          onFieldSelect,
          onFieldSave,
          onImageClick,
          onRemoveItem: thumbnail ? undefined : onRemoveItem,
          onAddItem: thumbnail ? undefined : onAddItem,
          onReorderItems: thumbnail ? undefined : onReorderItems,
          onUpdateFontSize: thumbnail ? undefined : onUpdateFontSize,
        })}
      </div>
    </div>
  )
}

interface EditProps {
  editMode?: boolean
  selectedFieldId?: string | null
  onFieldSelect?: (fieldId: string) => void
  onFieldSave?: (fieldId: string, value: string) => void
  onImageClick?: (fieldId: string) => void
  onRemoveItem?: (path: string, index: number) => void
  onAddItem?: (path: string, defaultValue: unknown) => void
  onReorderItems?: (path: string, newArray: unknown[]) => void
  onUpdateFontSize?: (path: string, delta: number) => void
}

function renderSlide(
  slide: SlideJSON,
  thumbnail: boolean,
  gradientText: boolean,
  themeJSON?: DeckThemeJSON,
  edit: EditProps = {},
) {
  const { editMode, selectedFieldId, onFieldSelect, onFieldSave, onImageClick, onRemoveItem, onAddItem, onReorderItems, onUpdateFontSize } = edit

  // DB-11/DB-14 — shared button styles
  const _removeItemBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)',
    cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
    opacity: 0.6, transition: 'opacity 0.15s', flexShrink: 0,
  }
  const _addItemBtnStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 8,
    padding: '6px 12px', borderRadius: 6,
    border: '1px dashed rgba(225,31,123,0.4)',
    background: 'rgba(225,31,123,0.05)',
    color: 'rgba(225,31,123,0.8)', fontSize: 12,
    cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.15s',
  }
  const { type, content } = slide

  // DB-13 — Extract font sizes stored in _fontSizes (must be after content is declared)
  const _fontSizes = (content as Record<string, unknown>)._fontSizes as Record<string, number> | undefined

  // Helper: get fontSize style override for a field
  function fs(path: string): React.CSSProperties {
    const val = _fontSizes?.[path]
    return val ? { fontSize: `${val}rem` } : {}
  }

  const fsize = themeJSON?.fontSize || 'md'

  // Font size multipliers
  const heroTitleSize = fsize === 'xl' ? 'clamp(60px, 8cqw, 108px)'
    : fsize === 'lg' ? 'clamp(52px, 6.5cqw, 96px)'
    : fsize === 'sm' ? 'clamp(32px, 4.5cqw, 64px)'
    : 'clamp(44px, 5.5cqw, 88px)' // md default

  const statsValSize = fsize === 'xl' ? 'clamp(40px, 5cqw, 70px)'
    : fsize === 'lg' ? 'clamp(36px, 4.5cqw, 62px)'
    : fsize === 'sm' ? 'clamp(24px, 3cqw, 42px)'
    : 'clamp(32px, 4cqw, 56px)' // md default

  // FIX E + B12 — gradient texte dynamique avec secondaryAccent
  const gradientTextStyle: React.CSSProperties = gradientText ? {
    background: `linear-gradient(135deg, ${themeJSON?.accentColor || '#E11F7B'} 0%, ${themeJSON?.secondaryAccent || '#7C3AED'} 50%, #00d4ff 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } : {}

  const cardGlowStyle: React.CSSProperties = {
    boxShadow: `0 0 40px rgba(225,31,123,0.12), inset 0 1px 0 rgba(255,255,255,0.06)`,
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
  }

  const slideLayout = (content as { layout?: string }).layout

  switch (type) {
    case 'hero': {
      // FIX B — keys alignées avec CSS: default/left/split/fullbleed
      const heroLayout = slideLayout || 'default'
      const layoutClass = heroLayout !== 'default' ? ` layout-${heroLayout}` : ''

      const heroTextContent = (
        <>
          {/* Image de fond — en mode édition, clic = file picker */}
          {content.imageUrl ? (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: editMode ? 'auto' : 'none' }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${content.imageUrl})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: 0.18, mixBlendMode: 'overlay',
              }} />
              {editMode && (
                <div
                  onClick={() => onImageClick?.('imageUrl')}
                  style={{
                    position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0)', transition: 'background 0.2s', zIndex: 2,
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(225,31,123,0.15)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '0' }}
                >
                  <span style={{ fontSize: 24, opacity: 0, transition: 'opacity 0.2s' }}>📷</span>
                </div>
              )}
            </div>
          ) : editMode ? (
            <div
              onClick={() => onImageClick?.('imageUrl')}
              style={{
                position: 'absolute', inset: 0, zIndex: 0, cursor: 'pointer',
                border: '2px dashed rgba(225,31,123,0.3)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0)', transition: 'background 0.2s',
                pointerEvents: 'auto',
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(225,31,123,0.08)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '0' }}
            >
              <span style={{ fontSize: 14, color: 'rgba(225,31,123,0.5)', opacity: 0, transition: 'opacity 0.2s' }}>📷 Ajouter une image</span>
            </div>
          ) : null}
          {/* Eyebrow */}
          {editMode ? (
            <EditableField
              as="div"
              className="tpl-hero__eyebrow"
              value={content.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              style={{ position: 'relative', zIndex: 1 }}
              placeholder="Eyebrow text..."
            />
          ) : content.eyebrow ? (
            <div className="tpl-hero__eyebrow" style={{ position: 'relative', zIndex: 1 }}>{content.eyebrow}</div>
          ) : null}
          {/* Title */}
          {editMode ? (
            <EditableField
              as="h1"
              className="tpl-hero__title"
              value={content.title || ''}
              fieldId="title"
              onSave={v => onFieldSave?.('title', v)}
              selected={selectedFieldId === 'title'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('title')}
              onUpdateFontSize={onUpdateFontSize}
              style={{
                fontSize: _fontSizes?.['title'] ? `${_fontSizes['title']}rem` : (heroLayout === 'fullbleed' ? 'clamp(48px, 7.5cqw, 108px)' : heroTitleSize),
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                position: 'relative', zIndex: 1,
                ...gradientTextStyle,
              }}
              placeholder="Titre principal..."
            />
          ) : content.title ? (
            <h1
              className="tpl-hero__title"
              style={{
                fontSize: _fontSizes?.['title'] ? `${_fontSizes['title']}rem` : (heroLayout === 'fullbleed' ? 'clamp(48px, 7.5cqw, 108px)' : heroTitleSize),
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                position: 'relative', zIndex: 1,
                ...gradientTextStyle,
              }}
            >
              {content.title}
            </h1>
          ) : null}
          {/* Subtitle */}
          {heroLayout !== 'fullbleed' && (editMode ? (
            <EditableField
              as="p"
              className="tpl-hero__sub"
              value={content.subtitle || ''}
              fieldId="subtitle"
              onSave={v => onFieldSave?.('subtitle', v)}
              selected={selectedFieldId === 'subtitle'}
              editMode={editMode}
              multiline
              onDoubleClick={() => onFieldSelect?.('subtitle')}
              style={{ position: 'relative', zIndex: 1 }}
              placeholder="Sous-titre..."
            />
          ) : content.subtitle ? (
            <p className="tpl-hero__sub" style={{ position: 'relative', zIndex: 1 }}>{content.subtitle}</p>
          ) : null)}
          {/* TK-0113 — Hero CTA button */}
          {(content as any).buttonText && (
            <div style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
              {(content as any).buttonUrl && !editMode ? (
                <a
                  href={(content as any).buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tpl-cta__btn"
                  style={{ display: 'inline-block', textDecoration: 'none' }}
                >
                  {(content as any).buttonText}
                </a>
              ) : (
                <button className="tpl-cta__btn" style={{ pointerEvents: editMode ? 'none' : 'auto' }}>
                  {editMode ? (
                    <EditableField
                      as="span"
                      value={(content as any).buttonText || ''}
                      fieldId="buttonText"
                      onSave={v => onFieldSave?.('buttonText', v)}
                      selected={selectedFieldId === 'buttonText'}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.('buttonText')}
                      placeholder="CTA..."
                    />
                  ) : (content as any).buttonText}
                </button>
              )}
            </div>
          )}
        </>
      )

      if (heroLayout === 'split') {
        return (
          <div className={`tpl-hero${layoutClass}`} data-layout={slideLayout || 'default'} style={{ height: '100%', position: 'relative' }}>
            <div className="tpl-hero__content">
              {editMode ? (
                <>
                  <EditableField as="div" className="tpl-hero__eyebrow" value={content.eyebrow || ''} fieldId="eyebrow" onSave={v => onFieldSave?.('eyebrow', v)} selected={selectedFieldId === 'eyebrow'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('eyebrow')} placeholder="Eyebrow..." />
                  <EditableField as="h1" className="tpl-hero__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={{ fontSize: heroTitleSize, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, ...gradientTextStyle }} placeholder="Titre..." />
                  <EditableField as="p" className="tpl-hero__sub" value={content.subtitle || ''} fieldId="subtitle" onSave={v => onFieldSave?.('subtitle', v)} selected={selectedFieldId === 'subtitle'} editMode={editMode} multiline onDoubleClick={() => onFieldSelect?.('subtitle')} placeholder="Sous-titre..." />
                </>
              ) : (
                <>
                  {content.eyebrow && <div className="tpl-hero__eyebrow">{content.eyebrow}</div>}
                  {content.title && (
                    <h1 className="tpl-hero__title" style={{ fontSize: heroTitleSize, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, ...gradientTextStyle }}>
                      {content.title}
                    </h1>
                  )}
                  {content.subtitle && <p className="tpl-hero__sub">{content.subtitle}</p>}
                </>
              )}
            </div>
            {/* DB-18 — hero split: image cover dans .tpl-hero__visual */}
            <div className="tpl-hero__visual">
              {content.imageUrl && (
                <img src={content.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
              )}
            </div>
          </div>
        )
      }

      return (
        <div className={`tpl-hero${layoutClass}`} data-layout={slideLayout || 'default'} style={{ height: '100%', position: 'relative' }}>
          {heroTextContent}
          {/* Hero footer badges */}
          {((content as {heroFooter?: Array<{icon: string; label: string}>}).heroFooter?.length || (content as {heroBadge?: string}).heroBadge) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 28, position: 'relative', zIndex: 1 }}>
              {((content as {heroFooter?: Array<{icon: string; label: string}>}).heroFooter || []).map((b, i) => (
                <div key={i} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {b.icon} {b.label}
                </div>
              ))}
              {(content as {heroBadge?: string}).heroBadge && (
                <div style={{ padding: '8px 16px', background: 'rgba(225,31,123,0.1)', border: '1px solid rgba(225,31,123,0.3)', borderRadius: 20, fontSize: 11, color: '#E11F7B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E11F7B', animation: 'blink 2s ease-in-out infinite', display: 'inline-block' }} />
                  {(content as {heroBadge: string}).heroBadge}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    case 'content': {
      // FIX B — keys alignées avec CSS: default/text-only/text-right/two-col
      const contentLayout = slideLayout || 'default'
      const contentLayoutClass = contentLayout !== 'default' ? ` layout-${contentLayout}` : ''

      // Editable bullets list — DB-11 (×) + DB-12 (DnD) + DB-14 (+)
      const bulletIds = (content.bullets || []).map((_: string, i: number) => String(i))
      const editableBullets = editMode ? (
        <ul className="tpl-content__bullets" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {onReorderItems ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const oldIndex = parseInt(active.id as string)
                  const newIndex = parseInt(over.id as string)
                  onReorderItems('bullets', arrayMove(content.bullets as unknown[], oldIndex, newIndex))
                }
              }}
            >
              <SortableContext items={bulletIds} strategy={verticalListSortingStrategy}>
                {(content.bullets || []).map((b: string, i: number) => (
                  <SortableItem key={i} id={String(i)}>
                    <EditableField
                      as="span"
                      fieldId={`bullets.${i}`}
                      value={b}
                      onSave={v => onFieldSave?.(`bullets.${i}`, v)}
                      selected={selectedFieldId === `bullets.${i}`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`bullets.${i}`)}
                      onUpdateFontSize={onUpdateFontSize}
                      style={{ flex: 1, ...fs(`bullets.${i}`) }}
                    />
                    {onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem('bullets', i)}
                        title="Supprimer"
                        style={_removeItemBtnStyle}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                      >×</button>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            (content.bullets || []).map((b: string, i: number) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <EditableField
                  as="span"
                  fieldId={`bullets.${i}`}
                  value={b}
                  onSave={v => onFieldSave?.(`bullets.${i}`, v)}
                  selected={selectedFieldId === `bullets.${i}`}
                  editMode={editMode}
                  onDoubleClick={() => onFieldSelect?.(`bullets.${i}`)}
                  onUpdateFontSize={onUpdateFontSize}
                  style={{ flex: 1, ...fs(`bullets.${i}`) }}
                />
                {onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem('bullets', i)}
                    title="Supprimer"
                    style={_removeItemBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >×</button>
                )}
              </li>
            ))
          )}
          {onAddItem && (
            <li style={{ listStyle: 'none', marginTop: 4 }}>
              <button
                onClick={() => onAddItem('bullets', 'Nouveau point')}
                style={_addItemBtnStyle}
              >+ Ajouter</button>
            </li>
          )}
        </ul>
      ) : (
        content.bullets && content.bullets.length > 0
          ? <ul className="tpl-content__bullets">{content.bullets.map((bullet, i) => <li key={i} style={fs(`bullets.${i}`)}>{bullet}</li>)}</ul>
          : null
      )

      // Content left inner (shared)
      const contentLeftInner = (
        <>
          {/* Pillar accent line */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0, top: '10%', bottom: '10%', width: 3,
              background: `linear-gradient(180deg, var(--accent, #E11F7B), transparent)`,
              borderRadius: 3,
            }}
          />
          <div style={{ paddingLeft: 16 }}>
            {editMode ? (
              <>
                <EditableField as="div" className="tpl-content__label" value={content.label || ''} fieldId="label" onSave={v => onFieldSave?.('label', v)} selected={selectedFieldId === 'label'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('label')} placeholder="Label..." />
                <EditableField as="h2" className="tpl-content__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
                <EditableField as="p" className="tpl-content__body" value={content.body || ''} fieldId="body" onSave={v => onFieldSave?.('body', v)} selected={selectedFieldId === 'body'} editMode={editMode} multiline onDoubleClick={() => onFieldSelect?.('body')} placeholder="Corps du texte..." />
                {editableBullets}
              </>
            ) : (
              <>
                {content.label && <div className="tpl-content__label">{content.label}</div>}
                {content.title && <h2 className="tpl-content__title" style={gradientText ? gradientTextStyle : {}}>{content.title}</h2>}
                {content.body && <p className="tpl-content__body">{content.body}</p>}
                {content.bullets && content.bullets.length > 0 && (
                  <ul className="tpl-content__bullets">
                    {content.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
      )

      // Image right — with edit overlay — DB-18: objectFit cover, full size
      const contentRightInner = content.imageUrl ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <img src={content.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="" />
          {editMode && (
            <div
              onClick={() => onImageClick?.('imageUrl')}
              style={{
                position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0)', transition: 'background 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(225,31,123,0.25)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(0,0,0,0)'); (e.currentTarget.querySelector('span') as HTMLElement).style.opacity = '0' }}
            >
              <span style={{ fontSize: 22, opacity: 0, transition: 'opacity 0.2s' }}>📷</span>
            </div>
          )}
        </div>
      ) : editMode ? (
        <div
          onClick={() => onImageClick?.('imageUrl')}
          style={{
            width: '60%', height: '60%', borderRadius: 16,
            border: '2px dashed rgba(225,31,123,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', background: 'rgba(225,31,123,0.04)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(225,31,123,0.12)') }}
          onMouseLeave={e => { (e.currentTarget.style.background = 'rgba(225,31,123,0.04)') }}
        >
          <span style={{ fontSize: 13, color: 'rgba(225,31,123,0.5)' }}>📷 Ajouter</span>
        </div>
      ) : (
        <div style={{ width: '60%', height: '60%', borderRadius: 16, background: 'var(--accent)', opacity: 0.15, transform: 'rotate(-8deg)' }} />
      )

      // FIX B — text-only (ex-centré): panneau centré plein largeur
      if (contentLayout === 'text-only') {
        return (
          <div className={`tpl-content${contentLayoutClass}`} data-layout="text-only" style={{ height: '100%' }}>
            <div className="tpl-content__left" style={{ position: 'relative', width: '100%', padding: '8% 14%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              {editMode ? (
                <>
                  <EditableField as="div" className="tpl-content__label" value={content.label || ''} fieldId="label" onSave={v => onFieldSave?.('label', v)} selected={selectedFieldId === 'label'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('label')} placeholder="Label..." />
                  <EditableField as="h2" className="tpl-content__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
                  <EditableField as="p" className="tpl-content__body" value={content.body || ''} fieldId="body" onSave={v => onFieldSave?.('body', v)} selected={selectedFieldId === 'body'} editMode={editMode} multiline onDoubleClick={() => onFieldSelect?.('body')} placeholder="Corps..." />
                  {editableBullets}
                </>
              ) : (
                <>
                  {content.label && <div className="tpl-content__label">{content.label}</div>}
                  {content.title && <h2 className="tpl-content__title" style={gradientText ? gradientTextStyle : {}}>{content.title}</h2>}
                  {content.body && <p className="tpl-content__body">{content.body}</p>}
                  {content.bullets && content.bullets.length > 0 && (
                    <ul className="tpl-content__bullets" style={{ columns: 2, gap: 24, textAlign: 'left', marginTop: 20 }}>
                      {content.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )
      }

      // FIX B — two-col (ex-grille): grille 2 colonnes
      if (contentLayout === 'two-col') {
        return (
          <div className={`tpl-content${contentLayoutClass}`} data-layout="two-col" style={{ height: '100%' }}>
            <div className="tpl-content__left" style={{ position: 'relative', padding: '7% 8%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto 1fr', gap: '0 32px', height: '100%' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                {editMode ? (
                  <>
                    <EditableField as="div" className="tpl-content__label" value={content.label || ''} fieldId="label" onSave={v => onFieldSave?.('label', v)} selected={selectedFieldId === 'label'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('label')} placeholder="Label..." />
                    <EditableField as="h2" className="tpl-content__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
                  </>
                ) : (
                  <>
                    {content.label && <div className="tpl-content__label">{content.label}</div>}
                    {content.title && <h2 className="tpl-content__title" style={gradientText ? gradientTextStyle : {}}>{content.title}</h2>}
                  </>
                )}
              </div>
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {editMode ? (
                  <EditableField as="p" className="tpl-content__body" value={content.body || ''} fieldId="body" onSave={v => onFieldSave?.('body', v)} selected={selectedFieldId === 'body'} editMode={editMode} multiline onDoubleClick={() => onFieldSelect?.('body')} placeholder="Corps..." />
                ) : content.body ? (
                  <p className="tpl-content__body">{content.body}</p>
                ) : null}
              </div>
              <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {editableBullets}
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className={`tpl-content${contentLayoutClass}`} data-layout={slideLayout || 'default'} style={{ height: '100%' }}>
          <div className="tpl-content__left" style={{ position: 'relative' }}>
            {contentLeftInner}
          </div>
          <div className="tpl-content__right">
            {contentRightInner}
          </div>
        </div>
      )
    }

    case 'stats': {
      // FIX B — keys alignées avec CSS: default/two-col/row
      const statsLayout = slideLayout || 'default'
      const statsLayoutClass = statsLayout !== 'default' ? ` layout-${statsLayout}` : ''
      const statsContent = content as {
        eyebrow?: string; title?: string; metrics?: Array<{value: string; label: string; desc?: string; baseline?: string; color?: string}>;
        stats?: Array<{value: string; desc?: string; baseline?: string; color?: string}>; footnote?: string
      }
      const statsItems = statsContent.stats || statsContent.metrics || []

      return (
        <div className={`tpl-stats${statsLayoutClass}`} data-layout={slideLayout || 'default'} style={{ height: '100%' }}>
          <div className="tpl-stats__header">
            {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={statsContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : statsContent.eyebrow ? (
            <Eyebrow text={statsContent.eyebrow} style={{ justifyContent: 'center' }} />
          ) : null}
            {editMode ? (
              <EditableField as="h2" className="tpl-stats__title" value={statsContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
            ) : statsContent.title ? (
              <h2 className="tpl-stats__title" style={gradientText ? gradientTextStyle : {}}>{statsContent.title}</h2>
            ) : null}
          </div>
          {/* DB-12 — DnD wrapper for metrics */}
          {onReorderItems && editMode ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const oldIndex = parseInt(active.id as string)
                  const newIndex = parseInt(over.id as string)
                  onReorderItems('metrics', arrayMove(statsItems as unknown[], oldIndex, newIndex))
                }
              }}
            >
              <SortableContext items={statsItems.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="tpl-stats__grid stats-grid">
                  {statsItems.slice(0, 4).map((metric, i) => (
                    <SortableItem key={i} id={String(i)}>
                      <div className="tpl-stat-card" style={{
                        ...cardGlowStyle,
                        ...(metric.color ? { background: `${metric.color.replace('linear-gradient', 'linear-gradient').replace(/,\s*#/g, ', #')}08` } : {}),
                        position: 'relative', flex: 1,
                      }}>
                        {onRemoveItem && (
                          <button onClick={() => onRemoveItem('metrics', i)} title="Supprimer" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>
                        )}
                        <EditableField as="div" className="tpl-stat-card__value" value={(metric as {value?: string}).value || ''} fieldId={`metrics.${i}.value`} onSave={v => onFieldSave?.(`metrics.${i}.value`, v)} selected={selectedFieldId === `metrics.${i}.value`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`metrics.${i}.value`)} onUpdateFontSize={onUpdateFontSize} style={{ fontSize: _fontSizes?.[`metrics.${i}.value`] ? `${_fontSizes[`metrics.${i}.value`]}rem` : statsValSize, fontWeight: 900, ...(metric.color ? { background: metric.color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}), ...(thumbnail ? { animation: 'none' } : undefined) }} placeholder="0" />
                        <EditableField as="div" className="tpl-stat-card__label" value={(metric as {label?: string}).label || ''} fieldId={`metrics.${i}.label`} onSave={v => onFieldSave?.(`metrics.${i}.label`, v)} selected={selectedFieldId === `metrics.${i}.label`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`metrics.${i}.label`)} onUpdateFontSize={onUpdateFontSize} placeholder="Label..." />
                        {editMode ? (
                          <EditableField as="div" className="tpl-stat-card__desc"
                            value={(metric as any).desc || (metric as any).baseline || ''}
                            fieldId={`metrics.${i}.desc`}
                            onSave={v => onFieldSave?.(`metrics.${i}.desc`, v)}
                            selected={selectedFieldId === `metrics.${i}.desc`}
                            editMode={editMode}
                            onDoubleClick={() => onFieldSelect?.(`metrics.${i}.desc`)}
                            placeholder="vs période précédente..."
                            style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}
                          />
                        ) : ((metric as any).desc || (metric as any).baseline) ? (
                          <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 6, lineHeight: 1.4, opacity: 0.8 }}>
                            {(metric as any).desc || (metric as any).baseline}
                          </div>
                        ) : null}
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="tpl-stats__grid stats-grid">
              {statsItems.slice(0, 4).map((metric, i) => (
                <div key={i} className="tpl-stat-card" style={{
                  ...cardGlowStyle,
                  ...(metric.color ? { background: `${metric.color.replace('linear-gradient', 'linear-gradient').replace(/,\s*#/g, ', #')}08` } : {}),
                  position: 'relative',
                }}>
                  {/* DB-11 — × supprimer métrique */}
                  {editMode && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem('metrics', i)}
                      title="Supprimer"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >×</button>
                  )}
                  {editMode ? (
                    <EditableField
                      as="div"
                      className="tpl-stat-card__value"
                      value={(metric as {value?: string}).value || ''}
                      fieldId={`metrics.${i}.value`}
                      onSave={v => onFieldSave?.(`metrics.${i}.value`, v)}
                      selected={selectedFieldId === `metrics.${i}.value`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`metrics.${i}.value`)}
                      onUpdateFontSize={onUpdateFontSize}
                      style={{ fontSize: _fontSizes?.[`metrics.${i}.value`] ? `${_fontSizes[`metrics.${i}.value`]}rem` : statsValSize, fontWeight: 900, ...(metric.color ? { background: metric.color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}), ...(thumbnail ? { animation: 'none' } : undefined) }}
                      placeholder="0"
                    />
                  ) : (
                    <div
                      className="tpl-stat-card__value"
                      style={{ fontSize: _fontSizes?.[`metrics.${i}.value`] ? `${_fontSizes[`metrics.${i}.value`]}rem` : statsValSize, fontWeight: 900, ...(metric.color ? { background: metric.color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}), ...(thumbnail ? { animation: 'none' } : undefined) }}
                    >
                      {(metric as {value?: string}).value}
                    </div>
                  )}
                  {editMode ? (
                    <EditableField
                      as="div"
                      className="tpl-stat-card__label"
                      value={(metric as {label?: string}).label || ''}
                      fieldId={`metrics.${i}.label`}
                      onSave={v => onFieldSave?.(`metrics.${i}.label`, v)}
                      selected={selectedFieldId === `metrics.${i}.label`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`metrics.${i}.label`)}
                      onUpdateFontSize={onUpdateFontSize}
                      placeholder="Label..."
                    />
                  ) : (
                    <div className="tpl-stat-card__label">{(metric as {label?: string}).label || ''}</div>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="tpl-stat-card__desc"
                      value={(metric as any).desc || (metric as any).baseline || ''}
                      fieldId={`metrics.${i}.desc`}
                      onSave={v => onFieldSave?.(`metrics.${i}.desc`, v)}
                      selected={selectedFieldId === `metrics.${i}.desc`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`metrics.${i}.desc`)}
                      placeholder="vs période précédente..."
                      style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}
                    />
                  ) : ((metric as any).desc || (metric as any).baseline) ? (
                    <div style={{ fontSize: 10, color: 'var(--text-sec)', marginTop: 6, lineHeight: 1.4, opacity: 0.8 }}>
                      {(metric as any).desc || (metric as any).baseline}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {/* DB-14 — + Ajouter une métrique (max 4) */}
          {editMode && onAddItem && statsItems.length < 4 && (
            <button
              onClick={() => onAddItem('metrics', { label: 'Métrique', value: '0' })}
              style={_addItemBtnStyle}
            >+ Ajouter une métrique</button>
          )}
          {/* TK-0088 — Stats footnote éditable */}
          {(editMode || statsContent.footnote) && (
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', width: '100%' }}>
              {editMode ? (
                <EditableField as="p" value={statsContent.footnote || ''}
                  fieldId="footnote" onSave={v => onFieldSave?.('footnote', v)}
                  selected={selectedFieldId === 'footnote'} editMode={editMode}
                  multiline onDoubleClick={() => onFieldSelect?.('footnote')}
                  style={{ fontSize: 'clamp(11px,1.2cqw,14px)', color: 'var(--text-sec)', fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center' }}
                  placeholder="Texte de conclusion..." />
              ) : (
                <p style={{ fontSize: 'clamp(11px,1.2cqw,14px)', color: 'var(--text-sec)', fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                  {statsContent.footnote}
                </p>
              )}
            </div>
          )}
        </div>
      )
    }

    case 'quote':
      return (
        <div className="tpl-quote" data-layout={slideLayout || 'default'} style={{ height: '100%' }}>
          {editMode ? (
            <EditableField
              as="blockquote"
              className="tpl-quote__text"
              value={content.text || ''}
              fieldId="text"
              onSave={v => onFieldSave?.('text', v)}
              selected={selectedFieldId === 'text'}
              editMode={editMode}
              multiline
              onDoubleClick={() => onFieldSelect?.('text')}
              style={cardGlowStyle}
              placeholder="Citation..."
            />
          ) : content.text ? (
            <blockquote className="tpl-quote__text" style={cardGlowStyle}>
              &ldquo;{content.text}&rdquo;
            </blockquote>
          ) : null}
          {editMode ? (
            <EditableField
              as="div"
              className="tpl-quote__author"
              value={content.author || ''}
              fieldId="author"
              onSave={v => onFieldSave?.('author', v)}
              selected={selectedFieldId === 'author'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('author')}
              placeholder="Auteur..."
            />
          ) : content.author ? (
            <div className="tpl-quote__author">{content.author}</div>
          ) : null}
          {editMode ? (
            <EditableField
              as="div"
              className="tpl-quote__role"
              value={content.role || ''}
              fieldId="role"
              onSave={v => onFieldSave?.('role', v)}
              selected={selectedFieldId === 'role'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('role')}
              placeholder="Rôle / Titre..."
            />
          ) : content.role ? (
            <div className="tpl-quote__role">{content.role}</div>
          ) : null}
        </div>
      )

    case 'cta': {
      const ctaContent = content as {
        eyebrow?: string; title?: string; subtitle?: string; buttonText?: string; cta?: string;
        allocations?: Array<{pct: string; title: string; desc?: string; color?: string}>
      }
      return (
        <div className="tpl-cta" data-layout={slideLayout || 'default'} style={{ height: '100%' }}>
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={ctaContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : ctaContent.eyebrow ? (
            <Eyebrow text={ctaContent.eyebrow} style={{ justifyContent: 'center' }} />
          ) : null}
          {editMode ? (
            <EditableField
              as="h2"
              className="tpl-cta__title"
              value={ctaContent.title || ''}
              fieldId="title"
              onSave={v => onFieldSave?.('title', v)}
              selected={selectedFieldId === 'title'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('title')}
              style={gradientText ? gradientTextStyle : {}}
              placeholder="Titre CTA..."
            />
          ) : ctaContent.title ? (
            <h2 className="tpl-cta__title" style={gradientText ? gradientTextStyle : {}}>{ctaContent.title}</h2>
          ) : null}
          {editMode ? (
            <EditableField
              as="p"
              className="tpl-cta__sub"
              value={ctaContent.subtitle || ''}
              fieldId="subtitle"
              onSave={v => onFieldSave?.('subtitle', v)}
              selected={selectedFieldId === 'subtitle'}
              editMode={editMode}
              multiline
              onDoubleClick={() => onFieldSelect?.('subtitle')}
              placeholder="Sous-titre..."
            />
          ) : ctaContent.subtitle ? (
            <p className="tpl-cta__sub">{ctaContent.subtitle}</p>
          ) : null}
          {ctaContent.allocations && ctaContent.allocations.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: '600px', marginTop: 28 }}>
              {ctaContent.allocations.map((a, i) => (
                <div key={i} style={{ padding: 18, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  {editMode ? (
                    <>
                      <EditableField as="div" value={a.pct || ''}
                        fieldId={`allocations.${i}.pct`}
                        onSave={v => onFieldSave?.(`allocations.${i}.pct`, v)}
                        selected={selectedFieldId === `allocations.${i}.pct`}
                        editMode={editMode}
                        onDoubleClick={() => onFieldSelect?.(`allocations.${i}.pct`)}
                        placeholder="42%"
                        style={{ fontSize: 'clamp(22px, 2.8cqw, 28px)', fontWeight: 900, color: a.color || '#E11F7B' }}
                      />
                      <EditableField as="div" value={a.title || ''}
                        fieldId={`allocations.${i}.title`}
                        onSave={v => onFieldSave?.(`allocations.${i}.title`, v)}
                        selected={selectedFieldId === `allocations.${i}.title`}
                        editMode={editMode}
                        onDoubleClick={() => onFieldSelect?.(`allocations.${i}.title`)}
                        placeholder="Titre..."
                        style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}
                      />
                      <EditableField as="div" value={a.desc || ''}
                        fieldId={`allocations.${i}.desc`}
                        onSave={v => onFieldSave?.(`allocations.${i}.desc`, v)}
                        selected={selectedFieldId === `allocations.${i}.desc`}
                        editMode={editMode}
                        onDoubleClick={() => onFieldSelect?.(`allocations.${i}.desc`)}
                        placeholder="Description..."
                        multiline
                        style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}
                      />
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 'clamp(22px, 2.8cqw, 28px)', fontWeight: 900, color: a.color || '#E11F7B' }}>{a.pct}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{a.title}</div>
                      {a.desc && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{a.desc}</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {(ctaContent.cta || ctaContent.buttonText) && (
            <button className="tpl-cta__btn">
              {editMode ? (
                <EditableField
                  as="span"
                  value={ctaContent.buttonText || ctaContent.cta || 'Commencer'}
                  fieldId="buttonText"
                  onSave={v => onFieldSave?.('buttonText', v)}
                  selected={selectedFieldId === 'buttonText'}
                  editMode={editMode}
                  onDoubleClick={() => onFieldSelect?.('buttonText')}
                  placeholder="Commencer"
                />
              ) : (
                ctaContent.cta || ctaContent.buttonText || 'Commencer'
              )}
            </button>
          )}
          {editMode && !ctaContent.cta && !ctaContent.buttonText && (
            <button className="tpl-cta__btn">
              <EditableField
                as="span"
                value=""
                fieldId="buttonText"
                onSave={v => onFieldSave?.('buttonText', v)}
                selected={selectedFieldId === 'buttonText'}
                editMode={editMode}
                onDoubleClick={() => onFieldSelect?.('buttonText')}
                placeholder="Texte du bouton"
              />
            </button>
          )}
        </div>
      )
    }

    case 'chart': {
      const chartData = content.data && content.data.length > 0 ? content.data : []
      const chartType = content.chartType || 'bar'
      // DB-10 P0-1 — unique chart IDs based on slide.id to avoid SVG gradient collisions
      const chartId = (slide.id || `p${slide.position}`).replace(/-/g, '').slice(0, 8)
      return (
        <div className="tpl-chart">
          {editMode ? (
            <EditableField as="h2" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={{ fontSize: 'clamp(20px, 2.8cqw, 36px)', fontWeight: 700, marginBottom: 32, textAlign: 'center', ...(gradientText ? gradientTextStyle : { color: 'var(--text-pri)' }) }} placeholder="Titre du graphique..." />
          ) : content.title ? (
            <h2 style={{
              fontSize: 'clamp(20px, 2.8cqw, 36px)', fontWeight: 700,
              marginBottom: 32, textAlign: 'center',
              ...(gradientText ? gradientTextStyle : { color: 'var(--text-pri)' }),
            }}>
              {content.title}
            </h2>
          ) : null}
          {chartData.length > 0 && (() => {
            switch (chartType) {
              case 'line':   return <LineChart data={chartData} thumbnail={thumbnail} chartId={chartId} />
              case 'pie':    return <PieChart data={chartData} />
              case 'donut':  return <DonutChart data={chartData} />
              default:       return <BarChart data={chartData} thumbnail={thumbnail} chartId={chartId} />
            }
          })()}
          {/* TK-0080 — Panneau d'édition des données graphique */}
          {editMode && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: 500 }}>
              <div style={{ fontSize: 11, color: 'var(--text-sec)', fontWeight: 600, marginBottom: 4 }}>Données du graphique</div>
              {chartData.map((pt: { label: string; value: number }, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <EditableField as="span" value={pt.label || ''} fieldId={`data.${i}.label`}
                    onSave={v => onFieldSave?.(`data.${i}.label`, v)}
                    selected={selectedFieldId === `data.${i}.label`}
                    editMode={editMode} onDoubleClick={() => onFieldSelect?.(`data.${i}.label`)}
                    style={{ flex: 1, fontSize: 12, color: 'var(--text-pri)' }} placeholder="Label..." />
                  <EditableField as="span" value={String(pt.value ?? '')} fieldId={`data.${i}.value`}
                    onSave={v => onFieldSave?.(`data.${i}.value`, v)}
                    selected={selectedFieldId === `data.${i}.value`}
                    editMode={editMode} onDoubleClick={() => onFieldSelect?.(`data.${i}.value`)}
                    style={{ width: 60, fontSize: 12, textAlign: 'right', color: 'var(--accent)' }} placeholder="0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    case 'timeline': {
      const accentColor = themeJSON?.accentColor || '#E11F7B'
      const bgColor2 = themeJSON?.bgColor || '#06040A'
      const textColor = themeJSON?.textPrimary || themeJSON?.textColor || '#F0EDF5'
      const events = content.events || []
      return (
        <div className="tpl-timeline" style={{ padding: thumbnail ? '12px 20px' : undefined, boxSizing: 'border-box' }}>
          {editMode ? (
            <EditableField as="h2" className="tpl-timeline__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={{ fontSize: thumbnail ? 10 : 'clamp(28px, 3cqw, 42px)', fontWeight: 800, marginBottom: thumbnail ? 8 : 48, ...(gradientText && !thumbnail ? gradientTextStyle : { color: textColor }) }} placeholder="Timeline..." />
          ) : (
            <h2 className="tpl-timeline__title" style={{ fontSize: thumbnail ? 10 : 'clamp(28px, 3cqw, 42px)', fontWeight: 800, marginBottom: thumbnail ? 8 : 48, ...(gradientText && !thumbnail ? gradientTextStyle : { color: textColor }) }}>
              {content.title || 'Timeline'}
            </h2>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', position: 'relative', minHeight: 0 }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: '50%', top: 0, bottom: 0, width: thumbnail ? 1 : 2,
              background: `linear-gradient(180deg, ${accentColor}, transparent)`,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }} />
            {/* DB-12 — DnD wrapper */}
            {onReorderItems && editMode && !thumbnail ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event
                  if (over && active.id !== over.id) {
                    const oldIndex = parseInt(active.id as string)
                    const newIndex = parseInt(over.id as string)
                    onReorderItems('events', arrayMove(events as unknown[], oldIndex, newIndex))
                  }
                }}
              >
                <SortableContext items={events.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                  {events.map((event, i) => (
                    <SortableItem key={i} id={String(i)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: thumbnail ? 6 : 24, position: 'relative', flex: 1 }}>
                        {editMode && onRemoveItem && !thumbnail && (
                          <button onClick={() => onRemoveItem('events', i)} title="Supprimer" style={{ position: 'absolute', top: 0, right: -24, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>
                        )}
                        <div style={{ flex: 1, textAlign: 'right', opacity: i % 2 === 0 ? 1 : 0 }}>
                          {editMode && i % 2 === 0 ? (
                            <>
                              <EditableField as="div" value={event.year || ''} fieldId={`events.${i}.year`} onSave={v => onFieldSave?.(`events.${i}.year`, v)} selected={selectedFieldId === `events.${i}.year`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.year`)} onUpdateFontSize={onUpdateFontSize} style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }} placeholder="2024" />
                              <EditableField as="div" value={event.label || ''} fieldId={`events.${i}.label`} onSave={v => onFieldSave?.(`events.${i}.label`, v)} selected={selectedFieldId === `events.${i}.label`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.label`)} onUpdateFontSize={onUpdateFontSize} style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }} placeholder="Événement..." />
                              {!thumbnail && <EditableField as="div" value={event.desc || ''} fieldId={`events.${i}.desc`} onSave={v => onFieldSave?.(`events.${i}.desc`, v)} selected={selectedFieldId === `events.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.desc`)} multiline style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }} placeholder="Description..." />}
                            </>
                          ) : (<><div style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }}>{event.year}</div><div style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }}>{event.label}</div>{event.desc && !thumbnail && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{event.desc}</div>}</>)}
                        </div>
                        <div style={{ width: thumbnail ? 6 : 14, height: thumbnail ? 6 : 14, borderRadius: '50%', background: accentColor, border: `${thumbnail ? 1 : 3}px solid ${bgColor2}`, boxShadow: thumbnail ? 'none' : `0 0 20px ${accentColor}66`, flexShrink: 0, zIndex: 1 }} />
                        <div style={{ flex: 1, opacity: i % 2 === 1 ? 1 : 0 }}>
                          {editMode && i % 2 === 1 ? (
                            <>
                              <EditableField as="div" value={event.year || ''} fieldId={`events.${i}.year`} onSave={v => onFieldSave?.(`events.${i}.year`, v)} selected={selectedFieldId === `events.${i}.year`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.year`)} onUpdateFontSize={onUpdateFontSize} style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }} placeholder="2024" />
                              <EditableField as="div" value={event.label || ''} fieldId={`events.${i}.label`} onSave={v => onFieldSave?.(`events.${i}.label`, v)} selected={selectedFieldId === `events.${i}.label`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.label`)} onUpdateFontSize={onUpdateFontSize} style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }} placeholder="Événement..." />
                              {!thumbnail && <EditableField as="div" value={event.desc || ''} fieldId={`events.${i}.desc`} onSave={v => onFieldSave?.(`events.${i}.desc`, v)} selected={selectedFieldId === `events.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.desc`)} multiline style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }} placeholder="Description..." />}
                            </>
                          ) : (<><div style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }}>{event.year}</div><div style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }}>{event.label}</div>{event.desc && !thumbnail && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{event.desc}</div>}</>)}
                        </div>
                      </div>
                    </SortableItem>
                  ))}
                </SortableContext>
              </DndContext>
            ) : null}
            {(!onReorderItems || !editMode || thumbnail) && events.map((event, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: thumbnail ? 6 : 24, position: 'relative' }}>
                {/* DB-11 — × supprimer événement */}
                {editMode && onRemoveItem && !thumbnail && (
                  <button
                    onClick={() => onRemoveItem('events', i)}
                    title="Supprimer"
                    style={{ position: 'absolute', top: 0, right: -24, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >×</button>
                )}
                {/* Left side (even) */}
                <div style={{ flex: 1, textAlign: 'right', opacity: i % 2 === 0 ? 1 : 0 }}>
                  {editMode && i % 2 === 0 ? (
                    <>
                      <EditableField as="div" value={event.year || ''} fieldId={`events.${i}.year`} onSave={v => onFieldSave?.(`events.${i}.year`, v)} selected={selectedFieldId === `events.${i}.year`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.year`)} style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }} placeholder="2024" />
                      <EditableField as="div" value={event.label || ''} fieldId={`events.${i}.label`} onSave={v => onFieldSave?.(`events.${i}.label`, v)} selected={selectedFieldId === `events.${i}.label`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.label`)} style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }} placeholder="Événement..." />
                      {!thumbnail && <EditableField as="div" value={event.desc || ''} fieldId={`events.${i}.desc`} onSave={v => onFieldSave?.(`events.${i}.desc`, v)} selected={selectedFieldId === `events.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.desc`)} multiline style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }} placeholder="Description..." />}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }}>{event.year}</div>
                      <div style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }}>{event.label}</div>
                      {event.desc && !thumbnail && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{event.desc}</div>}
                    </>
                  )}
                </div>
                {/* Center dot */}
                <div style={{
                  width: thumbnail ? 6 : 14, height: thumbnail ? 6 : 14, borderRadius: '50%',
                  background: accentColor,
                  border: `${thumbnail ? 1 : 3}px solid ${bgColor2}`,
                  boxShadow: thumbnail ? 'none' : `0 0 20px ${accentColor}66`,
                  flexShrink: 0, zIndex: 1,
                }} />
                {/* Right side (odd) */}
                <div style={{ flex: 1, opacity: i % 2 === 1 ? 1 : 0 }}>
                  {editMode && i % 2 === 1 ? (
                    <>
                      <EditableField as="div" value={event.year || ''} fieldId={`events.${i}.year`} onSave={v => onFieldSave?.(`events.${i}.year`, v)} selected={selectedFieldId === `events.${i}.year`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.year`)} style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }} placeholder="2024" />
                      <EditableField as="div" value={event.label || ''} fieldId={`events.${i}.label`} onSave={v => onFieldSave?.(`events.${i}.label`, v)} selected={selectedFieldId === `events.${i}.label`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.label`)} style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }} placeholder="Événement..." />
                      {!thumbnail && <EditableField as="div" value={event.desc || ''} fieldId={`events.${i}.desc`} onSave={v => onFieldSave?.(`events.${i}.desc`, v)} selected={selectedFieldId === `events.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`events.${i}.desc`)} multiline style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }} placeholder="Description..." />}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: thumbnail ? 5 : 13, fontWeight: 700, color: accentColor }}>{event.year}</div>
                      <div style={{ fontSize: thumbnail ? 6 : 15, fontWeight: 600, color: textColor }}>{event.label}</div>
                      {event.desc && !thumbnail && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{event.desc}</div>}
                    </>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: thumbnail ? 8 : 14 }}>
                Aucun événement
              </div>
            )}
          </div>
          {/* DB-14 — + Ajouter un événement */}
          {editMode && onAddItem && !thumbnail && (
            <button
              onClick={() => onAddItem('events', { year: 'Q?', label: 'Nouvel événement', desc: '' })}
              style={_addItemBtnStyle}
            >+ Ajouter un événement</button>
          )}
        </div>
      )
    }

    case 'comparison': {
      const accentColor = themeJSON?.accentColor || '#E11F7B'
      const textColor = themeJSON?.textPrimary || themeJSON?.textColor || '#F0EDF5'
      const left = content.left || { label: 'Colonne A', items: [] }
      const right = content.right || { label: 'Colonne B', items: [] }
      return (
        <div className="tpl-comparison" style={{ padding: thumbnail ? '10px 14px' : undefined, gap: thumbnail ? 8 : 32, boxSizing: 'border-box' }}>
          {editMode ? (
            <EditableField as="h2" className="tpl-comparison__title" value={content.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={{ fontSize: thumbnail ? 9 : 'clamp(28px, 3cqw, 48px)', fontWeight: 800, textAlign: 'center', ...(gradientText && !thumbnail ? gradientTextStyle : { color: textColor }) }} placeholder="Comparaison..." />
          ) : (
            <h2 className="tpl-comparison__title" style={{ fontSize: thumbnail ? 9 : 'clamp(28px, 3cqw, 48px)', fontWeight: 800, textAlign: 'center', ...(gradientText && !thumbnail ? gradientTextStyle : { color: textColor }) }}>
              {content.title || 'Comparaison'}
            </h2>
          )}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: thumbnail ? 6 : 24, minHeight: 0 }}>
            {[left, right].map((col, i) => {
              const isRight = i === 1
              const defaultAccent = isRight ? accentColor : 'rgba(255,255,255,0.3)'
              const colColor = (col as { color?: string }).color || defaultAccent
              const colAccent = colColor
              return (
                <div key={i} style={{
                  borderRadius: thumbnail ? 4 : 16,
                  border: `1px solid ${colAccent}33`,
                  background: isRight ? `${colAccent}0A` : 'rgba(255,255,255,0.03)',
                  overflow: 'hidden',
                  boxShadow: isRight && !thumbnail ? `0 0 32px ${colAccent}22` : 'none',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Header */}
                  <div style={{
                    padding: thumbnail ? '4px 6px' : '16px 24px',
                    background: isRight
                      ? `linear-gradient(135deg, ${colAccent}22, ${colAccent}11)`
                      : 'rgba(255,255,255,0.05)',
                    borderBottom: `1px solid ${colAccent}33`,
                    fontSize: thumbnail ? 6 : 18, fontWeight: 800,
                    color: colAccent,
                    textAlign: 'center',
                  }}>
                    {editMode ? (
                      <EditableField as="span" value={col.label || ''} fieldId={i === 0 ? 'left.label' : 'right.label'} onSave={v => onFieldSave?.(i === 0 ? 'left.label' : 'right.label', v)} selected={selectedFieldId === (i === 0 ? 'left.label' : 'right.label')} editMode={editMode} onDoubleClick={() => onFieldSelect?.(i === 0 ? 'left.label' : 'right.label')} style={{ color: 'inherit' }} placeholder={i === 0 ? 'Colonne A...' : 'Colonne B...'} />
                    ) : col.label}
                  </div>
                  {/* Items */}
                  <div style={{ padding: thumbnail ? '4px 6px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: thumbnail ? 3 : 12 }}>
                    {(col.items || []).map((item, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: thumbnail ? 3 : 10 }}>
                        <span style={{ color: colAccent, fontSize: thumbnail ? 6 : 16, flexShrink: 0, marginTop: 1 }}>
                          {isRight ? '✓' : '×'}
                        </span>
                        {editMode ? (
                          <EditableField as="span" value={item} fieldId={i === 0 ? `left.items.${j}` : `right.items.${j}`} onSave={v => onFieldSave?.(i === 0 ? `left.items.${j}` : `right.items.${j}`, v)} selected={selectedFieldId === (i === 0 ? `left.items.${j}` : `right.items.${j}`)} editMode={editMode} onDoubleClick={() => onFieldSelect?.(i === 0 ? `left.items.${j}` : `right.items.${j}`)} style={{ fontSize: thumbnail ? 5 : 14, color: isRight ? textColor : 'rgba(255,255,255,0.5)', lineHeight: 1.5 }} placeholder="Item..." />
                        ) : (
                          <span style={{ fontSize: thumbnail ? 5 : 14, color: isRight ? textColor : 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                            {item}
                          </span>
                        )}
                        {/* DB-11 — × supprimer item colonne */}
                        {editMode && onRemoveItem && !thumbnail && (
                          <button
                            onClick={() => onRemoveItem(i === 0 ? 'left.items' : 'right.items', j)}
                            title="Supprimer"
                            style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px', opacity: 0.6, flexShrink: 0, marginLeft: 4 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                          >×</button>
                        )}
                      </div>
                    ))}
                    {/* DB-14 — + Ajouter item colonne */}
                    {editMode && onAddItem && !thumbnail && (
                      <button
                        onClick={() => onAddItem(i === 0 ? 'left.items' : 'right.items', 'Nouvel élément')}
                        style={{ ...(_addItemBtnStyle as React.CSSProperties), marginTop: 4 }}
                      >+ Ajouter</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    case 'features': {
      const featContent = content as {eyebrow?: string; title?: string; subtitle?: string; features?: Array<{icon?: string; title?: string; desc?: string}>; items?: Array<{icon?: string; title?: string; desc?: string}>}
      const featureItems = featContent.features || (content as {items?: Array<{icon?: string; title?: string; desc?: string}>}).items || []
      return (
        <div className="tpl-features">
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={featContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : featContent.eyebrow ? (
            <Eyebrow text={featContent.eyebrow} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-features__title" value={featContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
          ) : featContent.title ? (
            <h2 className="tpl-features__title" style={gradientText ? gradientTextStyle : {}}>{featContent.title}</h2>
          ) : null}
          {editMode ? (
            <EditableField as="p" value={featContent.subtitle || ''} fieldId="subtitle" onSave={v => onFieldSave?.('subtitle', v)} selected={selectedFieldId === 'subtitle'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('subtitle')} multiline style={{ fontSize: 'clamp(12px,1.4cqw,15px)', color: 'var(--text-sec)', marginBottom: 8, textAlign: 'center' }} placeholder="Sous-titre..." />
          ) : featContent.subtitle ? (
            <p style={{ fontSize: 'clamp(12px,1.4cqw,15px)', color: 'var(--text-sec)', marginBottom: 8, textAlign: 'center' }}>{featContent.subtitle}</p>
          ) : null}
          {/* DB-12 — DnD features */}
          {onReorderItems && editMode ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const oldIndex = parseInt(active.id as string)
                  const newIndex = parseInt(over.id as string)
                  onReorderItems('features', arrayMove(featureItems as unknown[], oldIndex, newIndex))
                }
              }}
            >
              <SortableContext items={featureItems.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="features-grid" data-cols={featureItems.length === 2 ? '2' : featureItems.length >= 4 ? '4' : '3'}>
                  {featureItems.map((f, i) => (
                    <SortableItem key={i} id={String(i)}>
                      <div className="feature-card" style={{ position: 'relative', flex: 1 }}>
                        {onRemoveItem && <button onClick={() => onRemoveItem('features', i)} title="Supprimer" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>}
                        <EditableField as="div" className="feature-card__icon" value={f.icon || ''} fieldId={`features.${i}.icon`} onSave={v => onFieldSave?.(`features.${i}.icon`, v)} selected={selectedFieldId === `features.${i}.icon`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.icon`)} placeholder="🔥" />
                        <EditableField as="div" className="feature-card__title" value={f.title || ''} fieldId={`features.${i}.title`} onSave={v => onFieldSave?.(`features.${i}.title`, v)} selected={selectedFieldId === `features.${i}.title`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.title`)} onUpdateFontSize={onUpdateFontSize} placeholder="Titre..." />
                        <EditableField as="div" className="feature-card__desc" value={f.desc || ''} fieldId={`features.${i}.desc`} onSave={v => onFieldSave?.(`features.${i}.desc`, v)} selected={selectedFieldId === `features.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.desc`)} onUpdateFontSize={onUpdateFontSize} multiline placeholder="Description..." />
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="features-grid" data-cols={featureItems.length === 2 ? '2' : featureItems.length >= 4 ? '4' : '3'}>
              {featureItems.map((f, i) => (
                <div key={i} className="feature-card" style={{ position: 'relative' }}>
                  {/* DB-11 — × supprimer feature */}
                  {editMode && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem('features', i)}
                      title="Supprimer"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >×</button>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="feature-card__icon" value={f.icon || ''} fieldId={`features.${i}.icon`} onSave={v => onFieldSave?.(`features.${i}.icon`, v)} selected={selectedFieldId === `features.${i}.icon`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.icon`)} placeholder="🔥" />
                  ) : f.icon ? (
                    <div className="feature-card__icon">{f.icon}</div>
                  ) : null}
                  {editMode ? (
                    <EditableField as="div" className="feature-card__title" value={f.title || ''} fieldId={`features.${i}.title`} onSave={v => onFieldSave?.(`features.${i}.title`, v)} selected={selectedFieldId === `features.${i}.title`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.title`)} onUpdateFontSize={onUpdateFontSize} placeholder="Titre..." />
                  ) : f.title ? (
                    <div className="feature-card__title">{f.title}</div>
                  ) : null}
                  {editMode ? (
                    <EditableField as="div" className="feature-card__desc" value={f.desc || ''} fieldId={`features.${i}.desc`} onSave={v => onFieldSave?.(`features.${i}.desc`, v)} selected={selectedFieldId === `features.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`features.${i}.desc`)} onUpdateFontSize={onUpdateFontSize} multiline placeholder="Description..." />
                  ) : f.desc ? (
                    <div className="feature-card__desc">{f.desc}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {/* DB-14 — + Ajouter une feature */}
          {editMode && onAddItem && (
            <button
              onClick={() => onAddItem('features', { icon: '✨', title: 'Nouvelle feature', desc: 'Description' })}
              style={_addItemBtnStyle}
            >+ Ajouter une feature</button>
          )}
        </div>
      )
    }

    case 'pricing': {
      const pricingContent = content as {
        eyebrow?: string; title?: string; subtitle?: string;
        tiers?: Array<{name?: string; price?: string; per?: string; desc?: string; features?: string[]; featured?: boolean}>
      }
      const tiers = pricingContent.tiers || []
      return (
        <div className="tpl-pricing">
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={pricingContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : pricingContent.eyebrow ? (
            <Eyebrow text={pricingContent.eyebrow} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-pricing__title" value={pricingContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
          ) : pricingContent.title ? (
            <h2 className="tpl-pricing__title" style={gradientText ? gradientTextStyle : {}}>{pricingContent.title}</h2>
          ) : null}
          {editMode ? (
            <EditableField as="p" value={pricingContent.subtitle || ''} fieldId="subtitle" onSave={v => onFieldSave?.('subtitle', v)} selected={selectedFieldId === 'subtitle'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('subtitle')} multiline style={{ fontSize: 'clamp(12px,1.4cqw,14px)', color: 'var(--text-sec)', textAlign: 'center' }} placeholder="Sous-titre..." />
          ) : pricingContent.subtitle ? (
            <p style={{ fontSize: 'clamp(12px,1.4cqw,14px)', color: 'var(--text-sec)', textAlign: 'center' }}>{pricingContent.subtitle}</p>
          ) : null}
          {/* DB-12 — DnD tiers */}
          {onReorderItems && editMode ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const oldIndex = parseInt(active.id as string)
                  const newIndex = parseInt(over.id as string)
                  onReorderItems('tiers', arrayMove(tiers as unknown[], oldIndex, newIndex))
                }
              }}
            >
              <SortableContext items={tiers.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="pricing-grid">
                  {tiers.map((t, i) => (
                    <SortableItem key={i} id={String(i)}>
                      <div className={`pricing-card-wrap${t.featured ? ' featured' : ''}`} style={{ position: 'relative', flex: 1 }}>
                        {onRemoveItem && <button onClick={() => onRemoveItem('tiers', i)} title="Supprimer" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>}
                        <EditableField as="div" className="pricing-tier" value={t.name || ''} fieldId={`tiers.${i}.name`} onSave={v => onFieldSave?.(`tiers.${i}.name`, v)} selected={selectedFieldId === `tiers.${i}.name`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.name`)} onUpdateFontSize={onUpdateFontSize} placeholder="Nom du tier..." />
                        <div>
                          <EditableField as="span" className="pricing-price-val" value={t.price || ''} fieldId={`tiers.${i}.price`} onSave={v => onFieldSave?.(`tiers.${i}.price`, v)} selected={selectedFieldId === `tiers.${i}.price`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.price`)} onUpdateFontSize={onUpdateFontSize} placeholder="0€" />
                          <EditableField as="span" className="pricing-price-per" value={t.per || ''} fieldId={`tiers.${i}.per`} onSave={v => onFieldSave?.(`tiers.${i}.per`, v)} selected={selectedFieldId === `tiers.${i}.per`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.per`)} placeholder="/mois" />
                        </div>
                        <EditableField as="div" className="pricing-desc-text" value={t.desc || ''} fieldId={`tiers.${i}.desc`} onSave={v => onFieldSave?.(`tiers.${i}.desc`, v)} selected={selectedFieldId === `tiers.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.desc`)} multiline placeholder="Description..." />
                        {(t.features || []).length > 0 && (
                          <ul className="pricing-features-list">
                            {(t.features || []).map((f, j) => (
                              <li key={j} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <EditableField as="span" value={f}
                                  fieldId={`tiers.${i}.features.${j}`}
                                  onSave={v => onFieldSave?.(`tiers.${i}.features.${j}`, v)}
                                  selected={selectedFieldId === `tiers.${i}.features.${j}`}
                                  editMode={editMode}
                                  onDoubleClick={() => onFieldSelect?.(`tiers.${i}.features.${j}`)}
                                  style={{ flex: 1 }}
                                  placeholder="Feature..."
                                />
                                {onRemoveItem && (
                                  <button onClick={() => onRemoveItem(`tiers.${i}.features`, j)}
                                    style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.6)', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {onAddItem && (
                          <button onClick={() => onAddItem(`tiers.${i}.features`, 'Nouvelle feature')}
                            style={{ fontSize: 11, background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '2px 8px', marginTop: 4, width: '100%' }}>
                            + Feature
                          </button>
                        )}
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="pricing-grid">
              {tiers.map((t, i) => (
                <div key={i} className={`pricing-card-wrap${t.featured ? ' featured' : ''}`} style={{ position: 'relative' }}>
                  {/* DB-11 — × supprimer tier */}
                  {editMode && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem('tiers', i)}
                      title="Supprimer"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >×</button>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="pricing-tier" value={t.name || ''} fieldId={`tiers.${i}.name`} onSave={v => onFieldSave?.(`tiers.${i}.name`, v)} selected={selectedFieldId === `tiers.${i}.name`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.name`)} onUpdateFontSize={onUpdateFontSize} placeholder="Nom du tier..." />
                  ) : (
                    <div className="pricing-tier">{t.name}</div>
                  )}
                  <div>
                    {editMode ? (
                      <EditableField as="span" className="pricing-price-val" value={t.price || ''} fieldId={`tiers.${i}.price`} onSave={v => onFieldSave?.(`tiers.${i}.price`, v)} selected={selectedFieldId === `tiers.${i}.price`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.price`)} onUpdateFontSize={onUpdateFontSize} placeholder="0€" />
                    ) : (
                      <span className="pricing-price-val">{t.price}</span>
                    )}
                    {editMode ? (
                      <EditableField as="span" className="pricing-price-per" value={t.per || ''} fieldId={`tiers.${i}.per`} onSave={v => onFieldSave?.(`tiers.${i}.per`, v)} selected={selectedFieldId === `tiers.${i}.per`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.per`)} placeholder="/mois" />
                    ) : t.per ? (
                      <span className="pricing-price-per">{t.per}</span>
                    ) : null}
                  </div>
                  {editMode ? (
                    <EditableField as="div" className="pricing-desc-text" value={t.desc || ''} fieldId={`tiers.${i}.desc`} onSave={v => onFieldSave?.(`tiers.${i}.desc`, v)} selected={selectedFieldId === `tiers.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`tiers.${i}.desc`)} multiline placeholder="Description..." />
                  ) : t.desc ? (
                    <div className="pricing-desc-text">{t.desc}</div>
                  ) : null}
                  {(t.features || []).length > 0 && (
                    <ul className="pricing-features-list">
                      {(t.features || []).map((f, j) => (
                        <li key={j} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {editMode ? (
                            <EditableField as="span" value={f}
                              fieldId={`tiers.${i}.features.${j}`}
                              onSave={v => onFieldSave?.(`tiers.${i}.features.${j}`, v)}
                              selected={selectedFieldId === `tiers.${i}.features.${j}`}
                              editMode={editMode}
                              onDoubleClick={() => onFieldSelect?.(`tiers.${i}.features.${j}`)}
                              style={{ flex: 1 }}
                              placeholder="Feature..."
                            />
                          ) : f}
                          {editMode && onRemoveItem && (
                            <button onClick={() => onRemoveItem(`tiers.${i}.features`, j)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.6)', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}>×</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editMode && onAddItem && (
                    <button onClick={() => onAddItem(`tiers.${i}.features`, 'Nouvelle feature')}
                      style={{ fontSize: 11, background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 4, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '2px 8px', marginTop: 4, width: '100%' }}>
                      + Feature
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* DB-14 — + Ajouter un tier */}
          {editMode && onAddItem && (
            <button
              onClick={() => onAddItem('tiers', { name: 'Plan', price: '0€', per: '/mois', features: ['Feature 1'], featured: false })}
              style={_addItemBtnStyle}
            >+ Ajouter un plan</button>
          )}
        </div>
      )
    }

    case 'team': {
      const teamContent = content as {
        eyebrow?: string; title?: string; footnote?: string;
        members?: Array<{initial?: string; name?: string; role?: string; bio?: string; color?: string; open?: boolean; photoUrl?: string}>
      }
      const members = teamContent.members || []
      return (
        <div className="tpl-team">
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={teamContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : teamContent.eyebrow ? (
            <Eyebrow text={teamContent.eyebrow} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-team__title" value={teamContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
          ) : teamContent.title ? (
            <h2 className="tpl-team__title" style={gradientText ? gradientTextStyle : {}}>{teamContent.title}</h2>
          ) : null}
          {/* DB-12 — DnD members */}
          {onReorderItems && editMode ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event
                if (over && active.id !== over.id) {
                  const oldIndex = parseInt(active.id as string)
                  const newIndex = parseInt(over.id as string)
                  onReorderItems('members', arrayMove(members as unknown[], oldIndex, newIndex))
                }
              }}
            >
              <SortableContext items={members.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                <div className="team-grid">
                  {members.map((m, i) => (
                    <SortableItem key={i} id={String(i)}>
                      <div className="team-card" data-open={m.open ? 'true' : 'false'} style={{ position: 'relative', flex: 1 }}>
                        {onRemoveItem && <button onClick={() => onRemoveItem('members', i)} title="Supprimer" style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>×</button>}
                        {m.photoUrl ? (
                          <img src={m.photoUrl} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${m.color || '#E11F7B'}` }} alt={m.name || ''} />
                        ) : (
                          <div className="team-avatar-circle" style={{ color: m.color || '#E11F7B', borderColor: m.color || '#E11F7B', background: `${m.color || '#E11F7B'}18` }}>
                            <EditableField as="span" value={m.initial || ''} fieldId={`members.${i}.initial`} onSave={v => onFieldSave?.(`members.${i}.initial`, v)} selected={selectedFieldId === `members.${i}.initial`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.initial`)} placeholder="A" />
                          </div>
                        )}
                        <EditableField as="div" className="team-name" value={m.name || ''} fieldId={`members.${i}.name`} onSave={v => onFieldSave?.(`members.${i}.name`, v)} selected={selectedFieldId === `members.${i}.name`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.name`)} onUpdateFontSize={onUpdateFontSize} placeholder="Nom..." />
                        <EditableField as="div" className="team-role" value={m.role || ''} fieldId={`members.${i}.role`} onSave={v => onFieldSave?.(`members.${i}.role`, v)} selected={selectedFieldId === `members.${i}.role`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.role`)} onUpdateFontSize={onUpdateFontSize} placeholder="Rôle..." />
                        <EditableField as="div" className="team-bio" value={m.bio || ''} fieldId={`members.${i}.bio`} onSave={v => onFieldSave?.(`members.${i}.bio`, v)} selected={selectedFieldId === `members.${i}.bio`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.bio`)} multiline placeholder="Bio..." />
                      </div>
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="team-grid">
              {members.map((m, i) => (
                <div key={i} className="team-card" data-open={m.open ? 'true' : 'false'} style={{ position: 'relative' }}>
                  {/* DB-11 — × supprimer membre */}
                  {editMode && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem('members', i)}
                      title="Supprimer"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >×</button>
                  )}
                  {m.photoUrl ? (
                    <img src={m.photoUrl} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${m.color || '#E11F7B'}` }} alt={m.name || ''} />
                  ) : (
                    <div className="team-avatar-circle" style={{ color: m.color || '#E11F7B', borderColor: m.color || '#E11F7B', background: `${m.color || '#E11F7B'}18` }}>
                      {editMode ? (
                        <EditableField as="span" value={m.initial || ''} fieldId={`members.${i}.initial`} onSave={v => onFieldSave?.(`members.${i}.initial`, v)} selected={selectedFieldId === `members.${i}.initial`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.initial`)} placeholder="A" />
                      ) : m.initial}
                    </div>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="team-name" value={m.name || ''} fieldId={`members.${i}.name`} onSave={v => onFieldSave?.(`members.${i}.name`, v)} selected={selectedFieldId === `members.${i}.name`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.name`)} onUpdateFontSize={onUpdateFontSize} placeholder="Nom..." />
                  ) : (
                    <div className="team-name">{m.name}</div>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="team-role" value={m.role || ''} fieldId={`members.${i}.role`} onSave={v => onFieldSave?.(`members.${i}.role`, v)} selected={selectedFieldId === `members.${i}.role`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.role`)} onUpdateFontSize={onUpdateFontSize} placeholder="Rôle..." />
                  ) : (
                    <div className="team-role">{m.role}</div>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="team-bio" value={m.bio || ''} fieldId={`members.${i}.bio`} onSave={v => onFieldSave?.(`members.${i}.bio`, v)} selected={selectedFieldId === `members.${i}.bio`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`members.${i}.bio`)} multiline placeholder="Bio..." />
                  ) : m.bio ? (
                    <div className="team-bio">{m.bio}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {/* DB-14 — + Ajouter un membre */}
          {editMode && onAddItem && (
            <button
              onClick={() => onAddItem('members', { name: 'Prénom Nom', role: 'Rôle', bio: '', initial: 'P' })}
              style={_addItemBtnStyle}
            >+ Ajouter un membre</button>
          )}
          {(editMode || teamContent.footnote) && (
            editMode ? (
              <EditableField as="p" className="team-footnote"
                value={teamContent.footnote || ''}
                fieldId="footnote"
                onSave={v => onFieldSave?.('footnote', v)}
                selected={selectedFieldId === 'footnote'}
                editMode={editMode}
                multiline
                onDoubleClick={() => onFieldSelect?.('footnote')}
                style={{ fontSize: 'clamp(11px,1.2cqw,13px)', color: 'var(--text-sec)', fontStyle: 'italic' }}
                placeholder="Note de bas de slide..."
              />
            ) : (
              <p className="team-footnote">{teamContent.footnote}</p>
            )
          )}
        </div>
      )
    }

    case 'roadmap': {
      const accentColor = themeJSON?.accentColor || '#E11F7B'
      const roadmapContent = content as {
        eyebrow?: string; title?: string;
        phases?: Array<{icon?: string; quarter?: string; title?: string; items?: string[]; color?: string; current?: boolean; desc?: string; status?: string}>
      }
      const phases = roadmapContent.phases || []
      return (
        <div className="tpl-roadmap">
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={roadmapContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : roadmapContent.eyebrow ? (
            <Eyebrow text={roadmapContent.eyebrow} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-roadmap__title" value={roadmapContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre roadmap..." />
          ) : roadmapContent.title ? (
            <h2 className="tpl-roadmap__title" style={gradientText ? gradientTextStyle : {}}>{roadmapContent.title}</h2>
          ) : null}
          <div className="roadmap-grid">
            {phases.map((p, i) => (
              <div key={i} className="roadmap-phase" style={{ position: 'relative' }}>
                {/* DB-11 — × supprimer phase */}
                {editMode && onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem('phases', i)}
                    title="Supprimer"
                    style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', opacity: 0.6, zIndex: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >×</button>
                )}
                <div className="roadmap-dot" data-current={p.current ? 'true' : 'false'} style={{ color: p.color || (p.status === 'done' ? '#22C55E' : p.status === 'in-progress' || p.current ? accentColor : 'rgba(255,255,255,0.2)'), borderColor: p.color || (p.status === 'done' ? '#22C55E' : p.status === 'in-progress' || p.current ? accentColor : 'rgba(255,255,255,0.2)') }}>
                  {p.icon}
                </div>
                <div className="roadmap-content">
                  {editMode ? (
                    <EditableField as="div" className="roadmap-quarter" value={p.quarter || ''} fieldId={`phases.${i}.quarter`} onSave={v => onFieldSave?.(`phases.${i}.quarter`, v)} selected={selectedFieldId === `phases.${i}.quarter`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`phases.${i}.quarter`)} placeholder="Q1 2024..." />
                  ) : p.quarter ? (
                    <div className="roadmap-quarter">{p.quarter}</div>
                  ) : null}
                  {editMode ? (
                    <EditableField as="div" className="roadmap-phase-title" value={p.title || ''} fieldId={`phases.${i}.title`} onSave={v => onFieldSave?.(`phases.${i}.title`, v)} selected={selectedFieldId === `phases.${i}.title`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`phases.${i}.title`)} placeholder="Titre phase..." />
                  ) : p.title ? (
                    <div className="roadmap-phase-title">{p.title}</div>
                  ) : null}
                  {editMode && (
                    <EditableField as="div" value={p.desc || ''} fieldId={`phases.${i}.desc`} onSave={v => onFieldSave?.(`phases.${i}.desc`, v)} selected={selectedFieldId === `phases.${i}.desc`} editMode={editMode} onDoubleClick={() => onFieldSelect?.(`phases.${i}.desc`)} multiline style={{ fontSize: 11, color: 'var(--text-sec)', marginTop: 4 }} placeholder="Description..." />
                  )}
                  {editMode ? (
                    <>
                      {(p.items || []).map((item, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--accent)' }}>·</span>
                          <EditableField as="div" value={item}
                            fieldId={`phases.${i}.items.${j}`}
                            onSave={v => onFieldSave?.(`phases.${i}.items.${j}`, v)}
                            selected={selectedFieldId === `phases.${i}.items.${j}`}
                            editMode={editMode}
                            onDoubleClick={() => onFieldSelect?.(`phases.${i}.items.${j}`)}
                            style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', flex: 1 }}
                            placeholder="Item..."
                          />
                          {onRemoveItem && (
                            <button onClick={() => onRemoveItem(`phases.${i}.items`, j)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.5)', cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>×</button>
                          )}
                        </div>
                      ))}
                      {onAddItem && (
                        <button onClick={() => onAddItem(`phases.${i}.items`, 'Nouvel item')}
                          style={{ fontSize: 10, background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 3, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '1px 6px', marginTop: 2 }}>+ item</button>
                      )}
                    </>
                  ) : p.items && p.items.length > 0 ? (
                    <div className="roadmap-items">{p.items.map((item, j) => <div key={j}>· {item}</div>)}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {/* DB-14 — + Ajouter une phase */}
          {editMode && onAddItem && (
            <button
              onClick={() => onAddItem('phases', { quarter: 'Q?', title: 'Nouvelle phase', items: [], current: false })}
              style={_addItemBtnStyle}
            >+ Ajouter une phase</button>
          )}
        </div>
      )
    }

    case 'market': {
      const marketContent = content as {
        eyebrow?: string; title?: string; footnote?: string;
        bars?: Array<{label?: string; desc?: string; value?: string; width?: number; color?: string}>
      }
      const bars = marketContent.bars || []
      return (
        <div className="tpl-market">
          {editMode ? (
            <EditableField
              as="div"
              className="tpl-eyebrow"
              value={(content as any).eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ position: 'relative', zIndex: 1 }}
            />
          ) : (content as any).eyebrow ? (
            <Eyebrow text={(content as any).eyebrow} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-market__title" value={marketContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre marché..." />
          ) : marketContent.title ? (
            <h2 className="tpl-market__title" style={gradientText ? gradientTextStyle : {}}>{marketContent.title}</h2>
          ) : null}
          {/* TK-0149 — Barres horizontales TAM/SAM/SOM */}
          <div className="market-bars">
            {bars.map((b, i) => {
              const colors = ['#E11F7B', '#7C3AED', '#00d4ff']
              const widths = [100, 65, 35]
              const color = b.color || colors[i] || '#E11F7B'
              const width = b.width || widths[i] || 50
              return (
                <div key={i} className="market-bar-row">
                  {editMode ? (
                    <EditableField as="div" className="market-bar-label"
                      value={b.label || ''}
                      fieldId={`bars.${i}.label`}
                      onSave={v => onFieldSave?.(`bars.${i}.label`, v)}
                      selected={selectedFieldId === `bars.${i}.label`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`bars.${i}.label`)}
                      style={{ color }} placeholder="TAM..." />
                  ) : <div className="market-bar-label" style={{ color }}>{b.label}</div>}
                  <div className="market-bar-track">
                    <div className="market-bar-fill" style={{
                      width: `${width}%`,
                      background: `linear-gradient(90deg, ${color}33, ${color}88)`,
                      transition: thumbnail ? 'none' : 'width 1s ease',
                    }}>
                      {editMode ? (
                        <EditableField as="span" value={b.desc || ''}
                          fieldId={`bars.${i}.desc`}
                          onSave={v => onFieldSave?.(`bars.${i}.desc`, v)}
                          selected={selectedFieldId === `bars.${i}.desc`}
                          editMode={editMode}
                          onDoubleClick={() => onFieldSelect?.(`bars.${i}.desc`)}
                          style={{ fontSize: thumbnail ? 6 : 12, color: 'rgba(255,255,255,0.8)' }}
                          placeholder="Description..." />
                      ) : (b.desc && <span style={{ fontSize: thumbnail ? 6 : 12, color: 'rgba(255,255,255,0.8)' }}>{b.desc}</span>)}
                    </div>
                  </div>
                  {editMode ? (
                    <EditableField as="div" className="market-bar-value"
                      value={b.value || ''}
                      fieldId={`bars.${i}.value`}
                      onSave={v => onFieldSave?.(`bars.${i}.value`, v)}
                      selected={selectedFieldId === `bars.${i}.value`}
                      editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`bars.${i}.value`)}
                      style={{ color, fontSize: thumbnail ? 7 : 13 }} placeholder="$1T" />
                  ) : <div className="market-bar-value" style={{ color, fontSize: thumbnail ? 7 : 13 }}>{b.value}</div>}
                </div>
              )
            })}
          </div>
          {(editMode || marketContent.footnote) && (
            editMode ? (
              <EditableField as="p" className="market-footnote"
                value={marketContent.footnote || ''}
                fieldId="footnote"
                onSave={v => onFieldSave?.('footnote', v)}
                selected={selectedFieldId === 'footnote'}
                editMode={editMode}
                multiline
                onDoubleClick={() => onFieldSelect?.('footnote')}
                style={{ fontSize: 'clamp(11px,1.2cqw,13px)', color: 'var(--text-sec)', fontStyle: 'italic' }}
                placeholder="Note de bas de slide..."
              />
            ) : (
              <p className="market-footnote">{marketContent.footnote}</p>
            )
          )}
        </div>
      )
    }

    case 'orbit': {
      const orbitContent = content as {
        eyebrow?: string; title?: string;
        center?: {icon?: string};
        nodes?: Array<{initial?: string; label?: string; color?: string; bgColor?: string; position?: string}>;
        steps?: Array<{num?: number; title?: string; desc?: string}>
      }
      const nodes = orbitContent.nodes || []
      const steps = orbitContent.steps || []
      // Position offsets for orbit nodes
      const positionOffset: Record<string, {top?: string; bottom?: string; left?: string; right?: string; transform?: string}> = {
        'top':          { top: '0%',   left: '50%', transform: 'translateX(-50%)' },
        'bottom':       { bottom: '0%', left: '50%', transform: 'translateX(-50%)' },
        'top-right':    { top: '15%',  right: '5%' },
        'bottom-right': { bottom: '15%', right: '5%' },
        'top-left':     { top: '15%',  left: '5%' },
        'bottom-left':  { bottom: '15%', left: '5%' },
        'right':        { top: '50%',  right: '0%', transform: 'translateY(-50%)' },
        'left':         { top: '50%',  left: '0%',  transform: 'translateY(-50%)' },
      }
      return (
        <div className="tpl-orbit">
          {/* Left: visual */}
          <div>
            {editMode ? (
              <EditableField
                as="div"
                className="tpl-eyebrow"
                value={(content as any).eyebrow || ''}
                fieldId="eyebrow"
                onSave={v => onFieldSave?.('eyebrow', v)}
                selected={selectedFieldId === 'eyebrow'}
                editMode={editMode}
                onDoubleClick={() => onFieldSelect?.('eyebrow')}
                placeholder="Eyebrow..."
                style={{ position: 'relative', zIndex: 1 }}
              />
            ) : (content as any).eyebrow ? (
              <Eyebrow text={(content as any).eyebrow} />
            ) : null}
            {editMode ? (
              <EditableField as="h2" value={orbitContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={{ fontSize: 'clamp(24px, 3cqw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 32, ...(gradientText ? gradientTextStyle : {color:'var(--text-pri)'}) }} placeholder="Titre..." />
            ) : orbitContent.title ? (
              <h2 style={{ fontSize: 'clamp(24px, 3cqw, 40px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: 32, ...(gradientText ? gradientTextStyle : {color:'var(--text-pri)'}) }}>{orbitContent.title}</h2>
            ) : null}
            <div className="orbit-visual">
              {/* Rings */}
              <div className="orbit-ring-el" style={{ width: 240, height: 240 }} />
              <div className="orbit-ring-el" style={{ width: 160, height: 160 }} />
              {/* Center */}
              <div className="orbit-center-el">{orbitContent.center?.icon || '⬡'}</div>
              {/* Nodes */}
              {nodes.map((n, i) => (
                <div key={i} className="orbit-node-el" style={positionOffset[n.position || 'top'] || { top: `${20 + i * 20}%`, left: `${10 + i * 15}%` }}>
                  <div className="orbit-bubble-el" style={{ color: n.color || '#E11F7B', borderColor: n.color || '#E11F7B', background: n.bgColor || 'rgba(225,31,123,0.12)' }}>
                    {editMode ? (
                      <EditableField as="span" value={n.initial || ''} fieldId={`nodes.${i}.initial`}
                        onSave={v => onFieldSave?.(`nodes.${i}.initial`, v)}
                        selected={selectedFieldId === `nodes.${i}.initial`}
                        editMode={editMode} onDoubleClick={() => onFieldSelect?.(`nodes.${i}.initial`)}
                        placeholder="A" style={{ color: 'inherit' }} />
                    ) : n.initial}
                  </div>
                  {editMode ? (
                    <EditableField as="div" className="orbit-label-el" value={n.label || ''}
                      fieldId={`nodes.${i}.label`}
                      onSave={v => onFieldSave?.(`nodes.${i}.label`, v)}
                      selected={selectedFieldId === `nodes.${i}.label`}
                      editMode={editMode} onDoubleClick={() => onFieldSelect?.(`nodes.${i}.label`)}
                      placeholder="Label..." />
                  ) : <div className="orbit-label-el">{n.label}</div>}
                </div>
              ))}
            </div>
          </div>
          {/* Right: steps */}
          <div>
            <div className="steps-list-el">
              {steps.map((s, i) => (
                <div key={i} className="step-el">
                  <div className="step-num-el">{s.num || i + 1}</div>
                  <div>
                    {editMode ? (
                      <EditableField as="div" className="step-title-el" value={s.title || ''}
                        fieldId={`steps.${i}.title`}
                        onSave={v => onFieldSave?.(`steps.${i}.title`, v)}
                        selected={selectedFieldId === `steps.${i}.title`}
                        editMode={editMode} onDoubleClick={() => onFieldSelect?.(`steps.${i}.title`)}
                        placeholder="Étape..." />
                    ) : s.title ? <div className="step-title-el">{s.title}</div> : null}
                    {editMode ? (
                      <EditableField as="div" className="step-desc-el" value={s.desc || ''}
                        fieldId={`steps.${i}.desc`}
                        onSave={v => onFieldSave?.(`steps.${i}.desc`, v)}
                        selected={selectedFieldId === `steps.${i}.desc`}
                        editMode={editMode} multiline onDoubleClick={() => onFieldSelect?.(`steps.${i}.desc`)}
                        placeholder="Description..." />
                    ) : s.desc ? <div className="step-desc-el">{s.desc}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    case 'mockup': {
      const mockupContent = content as {
        eyebrow?: string; title?: string; appName?: string;
        cards?: Array<{status?: string; statusColor?: string; title?: string; progress?: number}>;
        agents?: Array<{name?: string; color?: string; blink?: boolean}>;
        agentCount?: string;
      }
      const cards = mockupContent.cards || []
      const agents = mockupContent.agents || []
      return (
        <div className="tpl-mockup">
          {editMode ? (
            <EditableField as="div" className="tpl-eyebrow"
              value={mockupContent.eyebrow || ''}
              fieldId="eyebrow"
              onSave={v => onFieldSave?.('eyebrow', v)}
              selected={selectedFieldId === 'eyebrow'}
              editMode={editMode}
              onDoubleClick={() => onFieldSelect?.('eyebrow')}
              placeholder="Eyebrow..."
              style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent, #E11F7B)', marginBottom: 8 }}
            />
          ) : mockupContent.eyebrow ? (
            <Eyebrow text={mockupContent.eyebrow} style={{ justifyContent: 'center' }} />
          ) : null}
          {editMode ? (
            <EditableField as="h2" className="tpl-mockup__title" value={mockupContent.title || ''} fieldId="title" onSave={v => onFieldSave?.('title', v)} selected={selectedFieldId === 'title'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('title')} style={gradientText ? gradientTextStyle : {}} placeholder="Titre..." />
          ) : mockupContent.title ? (
            <h2 className="tpl-mockup__title" style={gradientText ? gradientTextStyle : {}}>{mockupContent.title}</h2>
          ) : null}
          <div className="app-mockup">
            <div className="mockup-titlebar">
              <div className="mockup-mac-dot" style={{ background: '#FF5F57' }} />
              <div className="mockup-mac-dot" style={{ background: '#FFBD2E' }} />
              <div className="mockup-mac-dot" style={{ background: '#28C840' }} />
              {editMode ? (
                <EditableField as="span" className="mockup-app-title" value={mockupContent.appName || ''} fieldId="appName" onSave={v => onFieldSave?.('appName', v)} selected={selectedFieldId === 'appName'} editMode={editMode} onDoubleClick={() => onFieldSelect?.('appName')} placeholder="App name..." />
              ) : (
                <span className="mockup-app-title">{mockupContent.appName || 'Orion Launchpad'}</span>
              )}
            </div>
            <div className="mockup-cards-grid">
              {cards.map((c, i) => (
                <div key={i} className="mockup-task-card">
                  {editMode ? (
                    <EditableField as="div" className="mockup-status-tag" value={c.status || ''}
                      fieldId={`cards.${i}.status`} onSave={v => onFieldSave?.(`cards.${i}.status`, v)}
                      selected={selectedFieldId === `cards.${i}.status`} editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`cards.${i}.status`)}
                      style={{ background: `${c.statusColor || '#E11F7B'}22`, color: c.statusColor || '#E11F7B' }}
                      placeholder="Status..." />
                  ) : (
                    <div className="mockup-status-tag" style={{ background: `${c.statusColor || '#E11F7B'}22`, color: c.statusColor || '#E11F7B' }}>{c.status}</div>
                  )}
                  {editMode ? (
                    <EditableField as="div" className="mockup-task-name" value={c.title || ''}
                      fieldId={`cards.${i}.title`} onSave={v => onFieldSave?.(`cards.${i}.title`, v)}
                      selected={selectedFieldId === `cards.${i}.title`} editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`cards.${i}.title`)} placeholder="Tâche..." />
                  ) : (
                    <div className="mockup-task-name">{c.title}</div>
                  )}
                  <div className="mockup-progress-bar">
                    <div className="mockup-progress-fill" style={{ width: `${c.progress || 0}%`, background: c.statusColor || '#E11F7B' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mockup-agents-row">
              {agents.map((a, i) => (
                <div key={i} className="mockup-agent-pill">
                  <div className="mockup-agent-status-dot" style={{ background: a.color || '#E11F7B', animation: a.blink ? 'blink 2s ease-in-out infinite' : 'none' }} />
                  {editMode ? (
                    <EditableField as="span" className="mockup-agent-name-text" value={a.name || ''}
                      fieldId={`agents.${i}.name`} onSave={v => onFieldSave?.(`agents.${i}.name`, v)}
                      selected={selectedFieldId === `agents.${i}.name`} editMode={editMode}
                      onDoubleClick={() => onFieldSelect?.(`agents.${i}.name`)} placeholder="Agent..." />
                  ) : (
                    <span className="mockup-agent-name-text">{a.name}</span>
                  )}
                </div>
              ))}
              {mockupContent.agentCount && <span style={{ fontSize: 9, color: 'var(--text-sec)', marginLeft: 'auto' }}>{mockupContent.agentCount}</span>}
            </div>
          </div>
        </div>
      )
    }

    default:
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--text-sec)',
        }}>
          Slide type inconnu: {type}
        </div>
      )
  }
}

// ── Chart color palette ────────────────────────────────────────────────────────

// Hex colors for SVG fill (CSS vars don't work in SVG fill attributes)
const CHART_HEX = [
  '#E11F7B',
  '#c95ea0',
  '#9e4c7e',
  '#7a3a60',
  '#b450b4',
]

// ── BarChart ──────────────────────────────────────────────────────────────────

function BarChart({
  data,
  thumbnail,
  chartId = 'default',
}: {
  data: { label: string; value: number; color?: string }[]
  thumbnail?: boolean
  chartId?: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 600
  const H = 300
  const PAD_LEFT = 40
  const PAD_RIGHT = 20
  const PAD_TOP = 36
  const PAD_BOTTOM = 52
  const chartW = W - PAD_LEFT - PAD_RIGHT
  const chartH = H - PAD_TOP - PAD_BOTTOM
  const n = data.length
  const barW = Math.min(60, (chartW / n) * 0.55)
  const gap = chartW / n

  // DB-10 P0-1 — unique gradient IDs to avoid collisions when multiple charts in DOM
  const barGradId = `barGrad-${chartId}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: 600, height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label="Bar chart"
    >
      <defs>
        <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E11F7B" stopOpacity="1" />
          <stop offset="100%" stopColor="#E11F7B" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const y = PAD_TOP + chartH * (1 - frac)
        return (
          <g key={i}>
            <line
              x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
            {frac > 0 && (
              <text
                x={PAD_LEFT - 6} y={y + 4}
                textAnchor="end"
                fontSize="9"
                fill="rgba(255,255,255,0.25)"
                fontFamily="Poppins, sans-serif"
              >
                {Math.round(max * frac)}
              </text>
            )}
          </g>
        )
      })}

      {/* Bars */}
      {data.map((item, i) => {
        const barH = Math.max(4, (item.value / max) * chartH)
        const x = PAD_LEFT + gap * i + gap / 2 - barW / 2
        const y = PAD_TOP + chartH - barH
        const barFill = item.color ? item.color : `url(#${barGradId})`
        const barLabelColor = item.color || '#E11F7B'
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={4} ry={4}
              fill={barFill}
              style={thumbnail ? undefined : {
                transition: 'height 0.6s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            {/* Value label above bar */}
            <text
              x={x + barW / 2} y={y - 6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill={barLabelColor}
              fontFamily="Poppins, sans-serif"
            >
              {item.value}
            </text>
            {/* X-axis label */}
            <text
              x={x + barW / 2} y={PAD_TOP + chartH + 18}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
              fontFamily="Poppins, sans-serif"
            >
              {item.label.length > 10 ? item.label.slice(0, 10) + '…' : item.label}
            </text>
          </g>
        )
      })}

      {/* X baseline */}
      <line
        x1={PAD_LEFT} y1={PAD_TOP + chartH}
        x2={W - PAD_RIGHT} y2={PAD_TOP + chartH}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1"
      />
    </svg>
  )
}

// ── LineChart ─────────────────────────────────────────────────────────────────

function LineChart({
  data,
  thumbnail,
  chartId = 'default',
}: {
  data: { label: string; value: number }[]
  thumbnail?: boolean
  chartId?: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 600
  const H = 300
  const PAD_LEFT = 40
  const PAD_RIGHT = 20
  const PAD_TOP = 36
  const PAD_BOTTOM = 52
  const chartW = W - PAD_LEFT - PAD_RIGHT
  const chartH = H - PAD_TOP - PAD_BOTTOM
  const n = data.length

  const pts = data.map((d, i) => ({
    x: PAD_LEFT + (i / Math.max(n - 1, 1)) * chartW,
    y: PAD_TOP + chartH - (d.value / max) * chartH,
  }))

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = pts.length > 0
    ? `M ${pts[0].x},${PAD_TOP + chartH} ` +
      pts.map(p => `L ${p.x},${p.y}`).join(' ') +
      ` L ${pts[pts.length - 1].x},${PAD_TOP + chartH} Z`
    : ''

  // DB-10 P0-1 — unique gradient IDs to avoid collisions when multiple charts in DOM
  const lineAreaGradId = `lineAreaGrad-${chartId}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: 600, height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label="Line chart"
    >
      <defs>
        <linearGradient id={lineAreaGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E11F7B" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E11F7B" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
        const y = PAD_TOP + chartH * (1 - frac)
        return (
          <g key={i}>
            <line
              x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
            {frac > 0 && (
              <text
                x={PAD_LEFT - 6} y={y + 4}
                textAnchor="end" fontSize="9"
                fill="rgba(255,255,255,0.25)"
                fontFamily="Poppins, sans-serif"
              >
                {Math.round(max * frac)}
              </text>
            )}
          </g>
        )
      })}

      {/* Area fill */}
      {areaPath && (
        <path d={areaPath} fill={`url(#${lineAreaGradId})`} />
      )}

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#E11F7B"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={thumbnail ? undefined : { transition: 'opacity 0.4s' }}
      />

      {/* Points + labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#E11F7B" />
          <circle cx={p.x} cy={p.y} r={7} fill="#E11F7B" fillOpacity="0.2" />
          {/* Value */}
          <text
            x={p.x} y={p.y - 12}
            textAnchor="middle" fontSize="10" fontWeight="600"
            fill="#E11F7B" fontFamily="Poppins, sans-serif"
          >
            {data[i].value}
          </text>
          {/* X label */}
          <text
            x={p.x} y={PAD_TOP + chartH + 18}
            textAnchor="middle" fontSize="10"
            fill="rgba(255,255,255,0.45)"
            fontFamily="Poppins, sans-serif"
          >
            {data[i].label.length > 10 ? data[i].label.slice(0, 10) + '…' : data[i].label}
          </text>
        </g>
      ))}

      {/* X baseline */}
      <line
        x1={PAD_LEFT} y1={PAD_TOP + chartH}
        x2={W - PAD_RIGHT} y2={PAD_TOP + chartH}
        stroke="rgba(255,255,255,0.12)" strokeWidth="1"
      />
    </svg>
  )
}

// ── PieChart ──────────────────────────────────────────────────────────────────

function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const CX = 120
  const CY = 140
  const R = 100

  let cumAngle = -Math.PI / 2

  const slices = data.slice(0, 5).map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const startAngle = cumAngle
    cumAngle += angle
    const endAngle = cumAngle
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const path = `M ${CX},${CY} L ${x1},${y1} A ${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`
    const midAngle = startAngle + angle / 2
    const labelX = CX + (R * 0.6) * Math.cos(midAngle)
    const labelY = CY + (R * 0.6) * Math.sin(midAngle)
    const pct = Math.round((d.value / total) * 100)
    return { path, color: CHART_HEX[i % CHART_HEX.length], labelX, labelY, pct, ...d }
  })

  return (
    <svg
      viewBox="0 0 300 280"
      style={{ width: '100%', maxWidth: 300, height: 'auto' }}
      role="img"
      aria-label="Pie chart"
    >
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.path} fill={s.color} opacity="0.92" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
          {s.pct >= 8 && (
            <text
              x={s.labelX} y={s.labelY + 4}
              textAnchor="middle" fontSize="11" fontWeight="700"
              fill="rgba(255,255,255,0.9)"
              fontFamily="Poppins, sans-serif"
            >
              {s.pct}%
            </text>
          )}
        </g>
      ))}

      {/* Legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(250, ${30 + i * 40})`}>
          <rect x={0} y={0} width={12} height={12} rx={3} fill={s.color} />
          <text x={17} y={10} fontSize="11" fill="rgba(255,255,255,0.6)" fontFamily="Poppins, sans-serif">
            {s.label.length > 10 ? s.label.slice(0, 10) + '…' : s.label}
          </text>
          <text x={17} y={24} fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.35)" fontFamily="Poppins, sans-serif">
            {s.value}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const CX = 130
  const CY = 140
  const R = 100
  const INNER_R = 55

  let cumAngle = -Math.PI / 2

  const slices = data.slice(0, 5).map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const startAngle = cumAngle
    cumAngle += angle
    const endAngle = cumAngle
    const largeArc = angle > Math.PI ? 1 : 0
    // Outer arc
    const ox1 = CX + R * Math.cos(startAngle)
    const oy1 = CY + R * Math.sin(startAngle)
    const ox2 = CX + R * Math.cos(endAngle)
    const oy2 = CY + R * Math.sin(endAngle)
    // Inner arc
    const ix1 = CX + INNER_R * Math.cos(endAngle)
    const iy1 = CY + INNER_R * Math.sin(endAngle)
    const ix2 = CX + INNER_R * Math.cos(startAngle)
    const iy2 = CY + INNER_R * Math.sin(startAngle)
    const path = [
      `M ${ox1},${oy1}`,
      `A ${R},${R} 0 ${largeArc},1 ${ox2},${oy2}`,
      `L ${ix1},${iy1}`,
      `A ${INNER_R},${INNER_R} 0 ${largeArc},0 ${ix2},${iy2}`,
      'Z',
    ].join(' ')
    const pct = Math.round((d.value / total) * 100)
    return { path, color: CHART_HEX[i % CHART_HEX.length], pct, ...d }
  })

  return (
    <svg
      viewBox="0 0 320 280"
      style={{ width: '100%', maxWidth: 320, height: 'auto' }}
      role="img"
      aria-label="Donut chart"
    >
      {slices.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill={s.color}
          opacity="0.92"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="1"
        />
      ))}

      {/* Centre label */}
      <text
        x={CX} y={CY - 8}
        textAnchor="middle" fontSize="22" fontWeight="700"
        fill="rgba(255,255,255,0.9)"
        fontFamily="Poppins, sans-serif"
      >
        {total}
      </text>
      <text
        x={CX} y={CY + 14}
        textAnchor="middle" fontSize="10"
        fill="rgba(255,255,255,0.4)"
        fontFamily="Poppins, sans-serif"
      >
        total
      </text>

      {/* Legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(255, ${30 + i * 42})`}>
          <rect x={0} y={0} width={12} height={12} rx={3} fill={s.color} />
          <text x={17} y={10} fontSize="11" fill="rgba(255,255,255,0.6)" fontFamily="Poppins, sans-serif">
            {s.label.length > 9 ? s.label.slice(0, 9) + '…' : s.label}
          </text>
          <text x={17} y={24} fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.35)" fontFamily="Poppins, sans-serif">
            {s.value} · {s.pct}%
          </text>
        </g>
      ))}
    </svg>
  )
}

export default SlideRenderer
