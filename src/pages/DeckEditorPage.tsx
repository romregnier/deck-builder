/**
 * DeckEditorPage.tsx — Éditeur CMS 3 colonnes
 * TK-0042
 *
 * Layout:
 * - Colonne gauche (240px): liste des slides avec miniatures
 * - Canvas central: preview live de la slide active
 * - Panneau droit (280px): propriétés éditables
 * - Toolbar top: titre + actions
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Maximize2, Eye, Globe, EyeOff,
  RefreshCw, ArrowUp, ArrowDown, Trash2, Download, Loader2, LayoutTemplate, X,
  Image as ImageIcon, BarChart2,
} from 'lucide-react'
// ── DB-33 — DnD imports ───────────────────────────────────────────────────────
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { SlideRenderer } from '../components/deck/SlideRenderer'
import { AnimatedBackground } from '../components/deck/AnimatedBackground'
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal'
import { DeckEditorSkeleton } from '../components/DeckEditorSkeleton'
import { regenerateSlide } from '../lib/deckGenerator'
import { publishDeck, generateHTMLForExport } from '../lib/deckPublisher'
import type { SlideJSON, DeckTheme, SlideContent, DeckThemeJSON, SlideTransition, FontSize, SlideBackground, SlideType } from '../types/deck'
import type { BgType } from '../components/deck/AnimatedBackground'
import { BACKGROUND_PRESETS } from '../types/deck'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeckData {
  id: string
  title: string
  theme_json: string | null
  status: string
  slide_count: number
  published_url?: string | null
}

interface TemplateRecord {
  id: string
  name: string
  label?: string
  theme_config: Record<string, unknown>
  slide_structure?: unknown[]
}

interface SlideData extends SlideJSON {
  id: string
  deck_id: string
}

function getTheme(deck: DeckData | null): DeckTheme {
  if (!deck?.theme_json) return 'dark_premium'
  try {
    const parsed = JSON.parse(deck.theme_json) as { theme?: string; preset?: string }
    const raw = parsed.preset || parsed.theme || 'DARK_PREMIUM'
    const map: Record<string, DeckTheme> = {
      DARK_PREMIUM: 'dark_premium',
      LIGHT_CLEAN: 'light_clean',
      GRADIENT_BOLD: 'gradient_bold',
      CORPORATE: 'corporate',
      dark_premium: 'dark_premium',
      light_clean: 'light_clean',
      gradient_bold: 'gradient_bold',
      corporate: 'corporate',
    }
    return map[raw] || 'dark_premium'
  } catch {
    return 'dark_premium'
  }
}

function parseThemeJSON(deck: DeckData | null): DeckThemeJSON {
  const preset = getTheme(deck)
  const isLight = preset === 'light_clean' || preset === 'corporate'
  if (!deck?.theme_json) {
    return {
      preset,
      accentColor: '#E11F7B',
      bgColor: isLight ? '#FFFFFF' : '#06040A',
      accentGradient: 'linear-gradient(135deg, #E11F7B, #7C3AED)',
      textColor: isLight ? '#1A1520' : '#F0EDF5',
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
    }
  }
  try {
    const parsed = JSON.parse(deck.theme_json) as Record<string, unknown>
    const accentColor = (parsed.accentColor as string) || '#E11F7B'
    const bgColor = (parsed.bgColor as string) || (isLight ? '#FFFFFF' : '#06040A')
    const textColor = (parsed.textColor as string) || (isLight ? '#1A1520' : '#F0EDF5')
    const secondaryAccent = (parsed.secondaryAccent as string) || undefined
    // FIX E — accentGradient dynamique avec secondaryAccent
    const accentGradient = (parsed.accentGradient as string)
      || `linear-gradient(135deg, ${accentColor}, ${secondaryAccent || '#7C3AED'})`
    return {
      preset,
      accentColor,
      bgColor,
      accentGradient,
      textColor,
      gradientText: parsed.gradientText !== false,
      glowEffect: parsed.glowEffect !== false,
      fontSize: (parsed.fontSize as FontSize) || 'md',
      transition: (parsed.transition as SlideTransition) || 'slide-up',
      // ── Sprint 3+ ──
      bgAnimation: (parsed.bgAnimation as DeckThemeJSON['bgAnimation']) || undefined,
      secondaryAccent,
      textPrimary: (parsed.textPrimary as string) || undefined,
      textSecondary: (parsed.textSecondary as string) || undefined,
      noiseEnabled: (parsed.noiseEnabled as boolean) || false,
      noiseOpacity: (parsed.noiseOpacity as number) ?? 0.04,
      animationStagger: (parsed.animationStagger as 0 | 50 | 100 | 200) ?? 100,
      // FIX H+I — Police + Langue
      fontFamily: (parsed.fontFamily as DeckThemeJSON['fontFamily']) || undefined,
      lang: (parsed.lang as 'Français' | 'English') || 'Français',
    }
  } catch {
    return {
      preset,
      accentColor: '#E11F7B',
      bgColor: isLight ? '#FFFFFF' : '#06040A',
      accentGradient: 'linear-gradient(135deg, #E11F7B, #7C3AED)',
      textColor: isLight ? '#1A1520' : '#F0EDF5',
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
    }
  }
}

// ── DB-16 — SlideField supprimé : les champs texte sont désormais éditables inline sur le canvas ──
// Le PropsPanel ne contient plus que des contrôles de styling (layout, fond, image, items structurels)

// ── DB-36 — AccordionSection ──────────────────────────────────────────────────

interface AccordionSectionProps {
  id: string
  label: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function AccordionSection({ id, label, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 0 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: isOpen ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          transition: 'color 0.15s',
        }}>
          {label}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          style={{ color: isOpen ? '#E11F7B' : 'rgba(255,255,255,0.3)', display: 'flex' }}
        >
          <ChevronDown size={14} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingBottom: 12 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TK-0120 — Emoji picker : liste d'emojis courants pour les feature cards ──
const FEATURE_EMOJIS = [
  '✨','🔥','⚡','🚀','💡','🎯','🌟','💎','🔐','📊',
  '🤖','🌍','🛡️','⚙️','🔗','🎨','📱','💬','🔔','📈',
  '🎁','⏱️','🔄','🌈','🏆','💪','🔍','📌','🎉','💼',
  '🌊','🎸','🧩','🧠','🔮','📡','🛠️','🎓','🌺','🦋',
  '⭐','🌙','☀️','❄️','🌿','🦄','🐉','🔑','🪄','🎪',
]

// ── PropsPanel ────────────────────────────────────────────────────────────────

function PropsPanel({
  slide,
  deckTitle,
  deckId,
  themeJSON,
  onUpdate,
  onRegenerate,
  onChangeType,
  onUpdateTheme,
}: {
  slide: SlideData
  deckTitle: string
  deckId?: string
  themeJSON: DeckThemeJSON
  onUpdate: (content: SlideContent) => void
  onRegenerate: () => void
  onChangeType?: (newType: SlideType) => void
  onUpdateTheme: (updates: Partial<DeckThemeJSON>) => Promise<void>
}) {
  const [regenerating, setRegenerating] = useState(false)
  // TK-0120 — Index de la feature card dont le picker d'emoji est ouvert
  const [emojiPickerIndex, setEmojiPickerIndex] = useState<number | null>(null)
  // DB-47 — Tab Props/Style
  const [propsPanelTab, setPropsPanelTab] = useState<'props' | 'style'>('props')
  // DB-36 — Accordion sections
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['content']))
  // Reset tab + accordion on slide change
  useEffect(() => {
    setPropsPanelTab('props')
    setOpenSections(new Set(['content']))
  }, [slide.id])

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const content = slide.content

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: '#F5F0F7',
    fontSize: 12,
    fontFamily: 'Poppins, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const fieldLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  // FIX F — passe la langue du deck au régénérateur
  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const lang = themeJSON?.lang || 'Français'
      const newContent = await regenerateSlide(deckTitle, slide.type, content as Record<string, unknown>, lang)
      onUpdate(newContent as SlideContent)
    } catch (err) {
      console.error('[PropsPanel] regenerate error:', err)
    }
    setRegenerating(false)
    onRegenerate()
  }

  const SlideType = slide.type

  return (
    <div>
      {/* DB-47 — Tabs Props | Style */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {(['props', 'style'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setPropsPanelTab(tab)}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: '8px 8px 0 0',
              border: propsPanelTab === tab
                ? '1px solid rgba(225,31,123,0.5)'
                : '1px solid transparent',
              borderBottom: 'none',
              background: propsPanelTab === tab
                ? 'rgba(225,31,123,0.15)'
                : 'transparent',
              color: propsPanelTab === tab
                ? '#E11F7B'
                : 'rgba(255,255,255,0.4)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Poppins, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'props' ? 'Props' : 'Style'}
          </button>
        ))}
      </div>

      {propsPanelTab === 'style' ? (
        <StylePanelInline themeJSON={themeJSON} onUpdate={onUpdateTheme} />
      ) : (
      <div style={{ overflowY: 'auto' }}>
      <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, paddingBottom: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: 'rgba(225,31,123,0.15)', color: '#E11F7B',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {SlideType}
        </span>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)',
            fontSize: 11, fontWeight: 600, cursor: regenerating ? 'wait' : 'pointer',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          <RefreshCw size={11} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          Régénérer
        </button>
      </div>

      {/* DB-36 — Accordion Contenu */}
      <AccordionSection id="content" label="Contenu" isOpen={openSections.has('content')} onToggle={() => toggleSection('content')}>

      {/* DB-16 — Types sans contrôles structurels → édition directe sur le canvas */}
      {!['content','stats','chart','timeline','comparison','features','pricing','team','roadmap','market','orbit','mockup','cta','hero'].includes(SlideType) && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px 0', fontFamily: 'Poppins, sans-serif' }}>
          ✏️ Édition directe sur le canvas
        </p>
      )}

      {(SlideType === 'content') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={fieldLabel}>Points clés ({(content.bullets || []).length})</label>
          </div>
          {(content.bullets || []).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* DB-37 — Preview 30 chars */}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {typeof _ === 'string' && _.length > 0 ? (_.length > 30 ? _.slice(0, 30) + '…' : _) : `Point ${i + 1}`}
              </span>
              <button
                onClick={() => {
                  const bullets = (content.bullets || []).filter((__, j) => j !== i)
                  onUpdate({ ...content, bullets })
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, bullets: [...(content.bullets || []), 'Nouveau point'] })}
            style={{
              background: 'none', border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'rgba(255,255,255,0.3)',
              fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4,
              fontFamily: 'Poppins, sans-serif',
            }}
          >+ Ajouter un point</button>
        </div>
      )}

      {(SlideType === 'stats') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={fieldLabel}>Métriques ({(content.metrics || []).length})</label>
          </div>
          {(content.metrics || []).map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* TK-0138 — color picker */}
              <input type="color"
                value={(m as any).color || '#E11F7B'}
                onChange={e => {
                  const metrics = [...((content as any).metrics || [])]
                  metrics[i] = { ...metrics[i], color: e.target.value }
                  onUpdate({ ...content, metrics } as SlideContent)
                }}
                title="Couleur de la valeur"
                style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginLeft: 6 }}>{m.value || '—'}</span>
              <button
                onClick={() => {
                  const metrics = (content.metrics || []).filter((__, j) => j !== i)
                  onUpdate({ ...content, metrics })
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, metrics: [...(content.metrics || []), { value: '—', label: 'Nouvelle métrique' }] })}
            style={{
              background: 'none', border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'rgba(255,255,255,0.3)',
              fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4,
              fontFamily: 'Poppins, sans-serif',
            }}
          >+ Ajouter une métrique</button>
        </div>
      )}

      {(SlideType === 'chart') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Type de graphique</label>
          <select
            value={content.chartType || 'bar'}
            onChange={e => onUpdate({ ...content, chartType: e.target.value as 'bar' | 'line' | 'pie' | 'donut' })}
            style={{ ...fieldStyle, cursor: 'pointer' }}
          >
            <option value="bar">📊 Bar</option>
            <option value="line">📈 Line</option>
            <option value="pie">🥧 Pie</option>
            <option value="donut">🍩 Donut</option>
          </select>
          <div style={{ marginTop: 12 }}>
            <label style={fieldLabel}>Données ({((content as any).data || []).length} points)</label>
            {((content as any).data || []).map((_: unknown, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Color picker */}
                <input
                  type="color"
                  value={((content as any).data?.[i] as any)?.color || '#E11F7B'}
                  onChange={e => {
                    const data = [...((content as any).data || [])]
                    data[i] = { ...data[i], color: e.target.value }
                    onUpdate({ ...content, data } as SlideContent)
                  }}
                  style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0, background: 'none', flexShrink: 0 }}
                />
                {/* DB-37 — Preview chart data */}
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(() => { const d = ((content as any).data?.[i] as any); const label = d?.label; return typeof label === 'string' && label.length > 0 ? (label.length > 30 ? label.slice(0, 30) + '…' : label) : `Point ${i + 1}` })()}
                </span>
                <button
                  onClick={() => {
                    const data = ((content as any).data || []).filter((_: unknown, j: number) => j !== i)
                    onUpdate({ ...content, data } as SlideContent)
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                >×</button>
              </div>
            ))}
            <button
              onClick={() => onUpdate({ ...content, data: [...((content as any).data || []), { label: 'Nouveau', value: 0 }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
            >+ Ajouter un point</button>
          </div>
        </div>
      )}

      {/* Timeline — gestion événements (pas d'édition texte — édition inline) */}
      {(SlideType === 'timeline') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={fieldLabel}>Événements ({(content.events || []).length})</label>
          </div>
          {(content.events || []).map((evt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>{evt.year || `Étape ${i + 1}`} — {evt.label || '…'}</span>
              <button
                onClick={() => {
                  const events = (content.events || []).filter((__, j) => j !== i)
                  onUpdate({ ...content, events })
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, events: [...(content.events || []), { year: '', label: 'Nouvel événement', desc: '' }] })}
            style={{
              background: 'none', border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'rgba(255,255,255,0.3)',
              fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4,
              fontFamily: 'Poppins, sans-serif',
            }}
          >+ Ajouter un événement</button>
        </div>
      )}

      {/* Comparison — gestion colonnes (pas d'édition texte — édition inline) */}
      {(SlideType === 'comparison') && (
        <>
          {(['left', 'right'] as const).map(side => {
            const col = content[side] || { label: side === 'left' ? 'Avant' : 'Après', items: [] }
            const sideLabel = side === 'left' ? '⬅ Gauche' : '➡ Droite'
            return (
              <div key={side} style={{ marginBottom: 12 }}>
                <label style={fieldLabel}>{sideLabel} ({(col.items || []).length} items)</label>
                {/* Color picker pour la colonne */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input
                    type="color"
                    value={col.color || (side === 'left' ? '#E11F7B' : '#7C3AED')}
                    onChange={e => onUpdate({ ...content, [side]: { ...col, color: e.target.value } })}
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                    title={`Couleur ${sideLabel}`}
                  />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Couleur de la colonne</span>
                </div>
                {(col.items || []).map((_, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Item {j + 1}</span>
                    <button
                      onClick={() => {
                        const items = (col.items || []).filter((__, k) => k !== j)
                        onUpdate({ ...content, [side]: { ...col, items } })
                      }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={() => onUpdate({ ...content, [side]: { ...col, items: [...(col.items || []), 'Nouvel item'] } })}
                  style={{
                    background: 'none', border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 6, color: 'rgba(255,255,255,0.3)',
                    fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 2,
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >+ Ajouter un point</button>
              </div>
            )
          })}
        </>
      )}

      {/* Features — gestion items + TK-0120 emoji picker */}
      {(SlideType === 'features') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Features ({((content as any).features || []).length})</label>
          {((content as any).features || []).map((f: { icon?: string; title?: string; desc?: string }, i: number) => (
            <div key={i} style={{ marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', gap: 6 }}>
                {/* TK-0120 — Emoji picker button */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setEmojiPickerIndex(emojiPickerIndex === i ? null : i)}
                    title="Changer l'emoji"
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 5, cursor: 'pointer', fontSize: 15, width: 28, height: 28,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    {f.icon || '✨'}
                  </button>
                  {emojiPickerIndex === i && (
                    <div style={{
                      position: 'absolute', top: 32, left: 0, zIndex: 200,
                      background: '#2C272F', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10, padding: 8,
                      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      minWidth: 176,
                    }}>
                      {FEATURE_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            const features = [...((content as any).features || [])]
                            features[i] = { ...features[i], icon: emoji }
                            onUpdate({ ...content, features } as SlideContent)
                            setEmojiPickerIndex(null)
                          }}
                          style={{
                            background: f.icon === emoji ? 'rgba(225,31,123,0.25)' : 'transparent',
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                            fontSize: 16, width: 26, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.title || `Feature ${i + 1}`}
                </span>
                <button
                  onClick={() => {
                    const features = ((content as any).features || []).filter((_: unknown, j: number) => j !== i)
                    onUpdate({ ...content, features } as SlideContent)
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            </div>
          ))}
          {/* TK-0121 — Label spécifique */}
          <button
            onClick={() => onUpdate({ ...content, features: [...((content as any).features || []), { icon: '✨', title: 'Nouvelle feature', desc: 'Description' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Ajouter</button>
        </div>
      )}

      {/* Pricing — gestion tiers */}
      {(SlideType === 'pricing') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Offres ({((content as any).tiers || []).length})</label>
          {((content as any).tiers || []).map((t: { name?: string; features?: string[] }, i: number) => (
            <div key={i} style={{ marginBottom: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Tier {i + 1}{t.name ? ` — ${t.name}` : ''}</span>
                <button
                  onClick={() => {
                    const tiers = ((content as any).tiers || []).filter((_: unknown, j: number) => j !== i)
                    onUpdate({ ...content, tiers } as SlideContent)
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                >×</button>
              </div>
              {/* TK-0130 — Features du tier avec add/remove */}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 3, fontFamily: 'Poppins, sans-serif' }}>Features ({(t.features || []).length})</div>
              {(t.features || []).map((f: string, j: number) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--accent, #E11F7B)' }}>·</span>
                  <input
                    type="text"
                    value={f}
                    onChange={e => {
                      const tiers = [...((content as any).tiers || [])]
                      const features = [...(tiers[i].features || [])]
                      features[j] = e.target.value
                      tiers[i] = { ...tiers[i], features }
                      onUpdate({ ...content, tiers } as SlideContent)
                    }}
                    style={{ ...fieldStyle, flex: 1, padding: '3px 6px', fontSize: 10 }}
                    placeholder="Feature..."
                  />
                  <button
                    onClick={() => {
                      const tiers = [...((content as any).tiers || [])]
                      const features = (tiers[i].features || []).filter((_: string, k: number) => k !== j)
                      tiers[i] = { ...tiers[i], features }
                      onUpdate({ ...content, tiers } as SlideContent)
                    }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.5)', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => {
                  const tiers = [...((content as any).tiers || [])]
                  tiers[i] = { ...tiers[i], features: [...(tiers[i].features || []), 'Nouvelle feature'] }
                  onUpdate({ ...content, tiers } as SlideContent)
                }}
                style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 3, color: 'rgba(255,255,255,0.25)', fontSize: 10, cursor: 'pointer', padding: '1px 6px', marginTop: 2, width: '100%', fontFamily: 'Poppins, sans-serif' }}
              >+ Feature</button>
              {/* TK-0140 — Featured toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: (t as any).featured ? '#E11F7B' : 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                <input type="checkbox"
                  checked={!!(t as any).featured}
                  onChange={e => {
                    const tiers = [...((content as any).tiers || [])]
                    tiers[i] = { ...tiers[i], featured: e.target.checked }
                    onUpdate({ ...content, tiers } as SlideContent)
                  }}
                  style={{ accentColor: '#E11F7B' }}
                />
                Featured (mis en avant)
              </label>
            </div>
          ))}
          {/* TK-0121 — Label spécifique pricing */}
          <button
            onClick={() => onUpdate({ ...content, tiers: [...((content as any).tiers || []), { name: 'Nouveau tier', price: '—', per: '/mois', desc: '', features: [], featured: false }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Tier</button>
        </div>
      )}

      {/* Team — gestion membres */}
      {(SlideType === 'team') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Membres ({((content as any).members || []).length})</label>
          {((content as any).members || []).map((m: { initial?: string; name?: string; photoUrl?: string }, i: number) => (
            <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Membre {i + 1}{m.name ? ` — ${m.name}` : ''}</span>
                <button
                  onClick={() => {
                    const members = ((content as any).members || []).filter((_: unknown, j: number) => j !== i)
                    onUpdate({ ...content, members } as SlideContent)
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                >×</button>
              </div>
              {/* TK-0141 — color picker member */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Couleur</span>
                <input type="color"
                  value={(m as any).color || '#E11F7B'}
                  onChange={e => {
                    const members = [...((content as any).members || [])]
                    members[i] = { ...members[i], color: e.target.value }
                    onUpdate({ ...content, members } as SlideContent)
                  }}
                  title="Couleur du membre"
                  style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {m.photoUrl && (
                  <img src={m.photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = async () => {
                      const file = input.files?.[0]
                      if (!file) return
                      const ext = file.name.split('.').pop() || 'jpg'
                      const path = `team-photos/${deckId || slide.id}/${i}-${Date.now()}.${ext}`
                      const { error } = await supabase.storage.from('deck-exports').upload(path, file, { upsert: true })
                      if (error) { console.error('[PhotoUpload]', error); return }
                      const { data: urlData } = supabase.storage.from('deck-exports').getPublicUrl(path)
                      const url = urlData.publicUrl
                      const members = [...((content as any).members || [])]
                      members[i] = { ...members[i], photoUrl: url }
                      onUpdate({ ...content, members } as SlideContent)
                    }
                    input.click()
                  }}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
                >📷 Photo</button>
                {m.photoUrl && (
                  <button
                    onClick={() => {
                      const members = [...((content as any).members || [])]
                      const { photoUrl: _, ...rest } = members[i]
                      members[i] = rest
                      onUpdate({ ...content, members } as SlideContent)
                    }}
                    style={{ fontSize: 10, padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(255,100,100,0.2)', background: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
                  >✕</button>
                )}
              </div>
            </div>
          ))}
          {/* TK-0121 — Label spécifique team */}
          <button
            onClick={() => onUpdate({ ...content, members: [...((content as any).members || []), { initial: 'N', name: 'Prénom Nom', role: 'Rôle', bio: '' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Membre</button>
        </div>
      )}

      {/* Roadmap — gestion phases */}
      {(SlideType === 'roadmap') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Phases ({((content as any).phases || []).length})</label>
          {((content as any).phases || []).map((p: { quarter?: string; title?: string; current?: boolean; status?: string; icon?: string }, i: number) => {
            const STATUS_COLORS: Record<string, string> = { done: '#22C55E', 'in-progress': '#E11F7B', planned: 'rgba(255,255,255,0.3)' }
            const status = p.status || (p.current ? 'in-progress' : 'planned')
            const ROADMAP_ICONS = ['📌', '🚀', '✅', '🔧', '💡', '🎯', '⚡', '🏁', '🌱', '💎']
            return (
              <div key={i} style={{ marginBottom: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] || STATUS_COLORS.planned, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{p.quarter || `Phase ${i + 1}`} — {p.title || '…'}</span>
                  <button
                    onClick={() => { const phases = ((content as any).phases || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, phases } as SlideContent) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                  >×</button>
                </div>
                {/* TK-0142 — color picker phase */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Couleur</span>
                  <input type="color"
                    value={(p as any).color || '#E11F7B'}
                    onChange={e => {
                      const phases = [...((content as any).phases || [])]
                      phases[i] = { ...phases[i], color: e.target.value }
                      onUpdate({ ...content, phases } as SlideContent)
                    }}
                    title="Couleur de la phase"
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                </div>
                {/* TK-0132 — Icon emoji picker */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 2, fontFamily: 'Poppins, sans-serif' }}>Icône</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {ROADMAP_ICONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          const phases = [...((content as any).phases || [])]
                          phases[i] = { ...phases[i], icon: emoji }
                          onUpdate({ ...content, phases } as SlideContent)
                        }}
                        style={{ background: (p.icon || '📌') === emoji ? 'rgba(225,31,123,0.2)' : 'rgba(255,255,255,0.03)', border: (p.icon || '📌') === emoji ? '1px solid rgba(225,31,123,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 4, fontSize: 14, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                      >{emoji}</button>
                    ))}
                  </div>
                </div>
                <select
                  value={status}
                  onChange={e => {
                    const phases = [...((content as any).phases || [])]
                    phases[i] = { ...phases[i], status: e.target.value, current: e.target.value === 'in-progress' }
                    onUpdate({ ...content, phases } as SlideContent)
                  }}
                  style={{ width: '100%', padding: '3px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: STATUS_COLORS[status] || 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'Poppins, sans-serif', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="done">✅ Done</option>
                  <option value="in-progress">🔄 In Progress</option>
                  <option value="planned">📅 Planned</option>
                </select>
              </div>
            )
          })}
          {/* TK-0121 — Label spécifique roadmap */}
          <button
            onClick={() => onUpdate({ ...content, phases: [...((content as any).phases || []), { quarter: 'Q?', title: 'Nouvelle phase', items: [], status: 'planned', current: false, icon: '📌' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Phase</button>
        </div>
      )}

      {/* Market — gestion cercles TAM/SAM/SOM */}
      {(SlideType === 'market') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Cercles ({((content as any).bars || []).length}/3 max)</label>
          {((content as any).bars || []).map((b: { label?: string; color?: string; width?: number }, i: number) => (
            <div key={i} style={{ padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={b.color || (['#E11F7B', '#7C3AED', '#00d4ff'][i] || '#E11F7B')}
                onChange={e => {
                  const bars = [...((content as any).bars || [])]
                  bars[i] = { ...bars[i], color: e.target.value }
                  onUpdate({ ...content, bars } as SlideContent)
                }}
                style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                title="Couleur du cercle"
              />
              <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>
                {b.label || (['TAM', 'SAM', 'SOM'][i] || `Cercle ${i + 1}`)}
              </span>
              <button
                onClick={() => {
                  const bars = ((content as any).bars || []).filter((_: unknown, j: number) => j !== i)
                  onUpdate({ ...content, bars } as SlideContent)
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'Poppins, sans-serif', minWidth: 32 }}>Taille</span>
                <input
                  type="range" min={10} max={100} step={1}
                  value={b.width ?? [100, 65, 35][i] ?? 50}
                  onChange={e => {
                    const bars = [...((content as any).bars || [])]
                    bars[i] = { ...bars[i], width: Number(e.target.value) }
                    onUpdate({ ...content, bars } as SlideContent)
                  }}
                  style={{ flex: 1, accentColor: b.color || '#E11F7B' }}
                />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'Poppins, sans-serif', minWidth: 24, textAlign: 'right' }}>{b.width ?? [100, 65, 35][i] ?? 50}%</span>
              </div>
            </div>
          ))}
          {((content as any).bars || []).length < 3 && (
            <button
              onClick={() => {
                const defaults = [
                  { label: 'TAM', value: '$100B', color: '#E11F7B', width: 100 },
                  { label: 'SAM', value: '$10B', color: '#7C3AED', width: 65 },
                  { label: 'SOM', value: '$1B', color: '#00d4ff', width: 35 },
                ]
                const idx = ((content as any).bars || []).length
                const bars = [...((content as any).bars || []), defaults[idx] || { label: `Cercle ${idx + 1}`, value: '—', color: '#E11F7B', width: 30 }]
                onUpdate({ ...content, bars } as SlideContent)
              }}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
            >+ Ajouter un cercle</button>
          )}
        </div>
      )}

      {/* TK-0108 — Orbit : nodes + steps */}
      {(SlideType === 'orbit') && (
        <>
          {/* TK-0143 — center.icon input */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Icône centrale</label>
            <input type="text"
              value={(content as any).center?.icon || '⬡'}
              onChange={e => onUpdate({ ...content, center: { ...((content as any).center || {}), icon: e.target.value } } as SlideContent)}
              placeholder="⬡"
              style={{ ...fieldStyle, width: 60 }}
            />
          </div>
          {/* Nodes */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Nodes ({((content as any).nodes || []).length})</label>
            {((content as any).nodes || []).map((n: unknown, i: number) => (
              <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Node {i + 1}</span>
                  <button onClick={() => { const nodes = ((content as any).nodes || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, nodes } as SlideContent) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
                {/* TK-0143 — node color + bgColor pickers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Color</span>
                  <input type="color"
                    value={(n as any).color || '#E11F7B'}
                    onChange={e => { const nodes = [...((content as any).nodes || [])]; nodes[i] = { ...nodes[i], color: e.target.value }; onUpdate({ ...content, nodes } as SlideContent) }}
                    title="Couleur du node"
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>BG</span>
                  <input type="color"
                    value={(n as any).bgColor || '#1a0a2e'}
                    onChange={e => { const nodes = [...((content as any).nodes || [])]; nodes[i] = { ...nodes[i], bgColor: e.target.value }; onUpdate({ ...content, nodes } as SlideContent) }}
                    title="Couleur de fond du node"
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                </div>
              </div>
            ))}
            <button onClick={() => onUpdate({ ...content, nodes: [...((content as any).nodes || []), { initial: 'N', label: 'Nouveau node' }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}>
              + Ajouter un node
            </button>
          </div>
          {/* Steps */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Étapes ({((content as any).steps || []).length})</label>
            {((content as any).steps || []).map((_: unknown, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Étape {i + 1}</span>
                <button onClick={() => { const steps = ((content as any).steps || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, steps } as SlideContent) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={() => onUpdate({ ...content, steps: [...((content as any).steps || []), { num: ((content as any).steps || []).length + 1, title: 'Nouvelle étape', desc: '' }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}>
              + Ajouter une étape
            </button>
          </div>
        </>
      )}

      {/* TK-0109 — Mockup : cards + agents */}
      {(SlideType === 'mockup') && (
        <>
          {/* Cards */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Cards ({((content as any).cards || []).length})</label>
            {((content as any).cards || []).map((c: { title?: string; progress?: number }, i: number) => (
              <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Card {i + 1}{c.title ? ` — ${c.title}` : ''}</span>
                  <button onClick={() => { const cards = ((content as any).cards || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, cards } as SlideContent) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
                {/* TK-0137 — Progress slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif', flexShrink: 0 }}>Progress</span>
                  <input type="range" min="0" max="100"
                    value={c.progress ?? 0}
                    onChange={e => {
                      const cards = [...((content as any).cards || [])]
                      cards[i] = { ...cards[i], progress: Number(e.target.value) }
                      onUpdate({ ...content, cards } as SlideContent)
                    }}
                    style={{ flex: 1, accentColor: '#E11F7B' }}
                  />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 28, fontFamily: 'Poppins, sans-serif' }}>{c.progress ?? 0}%</span>
                </div>
                {/* TK-0144 — statusColor picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Status color</span>
                  <input type="color"
                    value={(c as any).statusColor || '#6366f1'}
                    onChange={e => {
                      const cards = [...((content as any).cards || [])]
                      cards[i] = { ...cards[i], statusColor: e.target.value }
                      onUpdate({ ...content, cards } as SlideContent)
                    }}
                    title="Couleur du statut"
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                </div>
              </div>
            ))}
            <button onClick={() => onUpdate({ ...content, cards: [...((content as any).cards || []), { status: 'todo', statusColor: '#6366f1', title: 'Nouvelle tâche', progress: 0 }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}>
              + Ajouter une card
            </button>
          </div>
          {/* Agents */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Agents ({((content as any).agents || []).length})</label>
            {((content as any).agents || []).map((ag: unknown, i: number) => (
              <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Agent {i + 1}</span>
                  <button onClick={() => { const agents = ((content as any).agents || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, agents } as SlideContent) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
                {/* TK-0144 — agent color picker (dot) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Couleur dot</span>
                  <input type="color"
                    value={(ag as any).color || '#E11F7B'}
                    onChange={e => { const agents = [...((content as any).agents || [])]; agents[i] = { ...agents[i], color: e.target.value }; onUpdate({ ...content, agents } as SlideContent) }}
                    title="Couleur du dot agent"
                    style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                  />
                </div>
              </div>
            ))}
            <button onClick={() => onUpdate({ ...content, agents: [...((content as any).agents || []), { name: 'Nouvel agent', role: '', color: '#E11F7B' }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}>
              + Ajouter un agent
            </button>
          </div>
          {/* TK-0145 — agentCount */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Compteur agents (agentCount)</label>
            <input type="text"
              value={(content as any).agentCount || ''}
              onChange={e => onUpdate({ ...content, agentCount: e.target.value } as SlideContent)}
              placeholder="Ex: 12 agents actifs"
              style={fieldStyle}
            />
          </div>
        </>
      )}

      {/* ── TK-0133 — CTA allocations ────────────────────────────────── */}
      {SlideType === 'cta' && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Allocations ({((content as any).allocations || []).length})</label>
          {((content as any).allocations || []).map((a: { pct?: string; title?: string; desc?: string; color?: string }, i: number) => (
            <div key={i} style={{ marginBottom: 4, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Allocation {i + 1}{a.title ? ` — ${a.title}` : ''}</span>
                <button
                  onClick={() => {
                    const allocations = ((content as any).allocations || []).filter((_: unknown, j: number) => j !== i)
                    onUpdate({ ...content, allocations } as SlideContent)
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="text" value={a.pct || ''} onChange={e => { const allocs = [...((content as any).allocations || [])]; allocs[i] = { ...allocs[i], pct: e.target.value }; onUpdate({ ...content, allocations: allocs } as SlideContent) }} placeholder="42%" style={{ ...fieldStyle, width: 60, padding: '3px 6px', fontSize: 10 }} />
                <input type="text" value={a.title || ''} onChange={e => { const allocs = [...((content as any).allocations || [])]; allocs[i] = { ...allocs[i], title: e.target.value }; onUpdate({ ...content, allocations: allocs } as SlideContent) }} placeholder="Titre..." style={{ ...fieldStyle, flex: 1, padding: '3px 6px', fontSize: 10 }} />
              </div>
              <input type="text" value={a.desc || ''} onChange={e => { const allocs = [...((content as any).allocations || [])]; allocs[i] = { ...allocs[i], desc: e.target.value }; onUpdate({ ...content, allocations: allocs } as SlideContent) }} placeholder="Description..." style={{ ...fieldStyle, padding: '3px 6px', fontSize: 10, marginTop: 3 }} />
              {/* TK-0139 — color picker allocation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Poppins, sans-serif' }}>Couleur</span>
                <input type="color"
                  value={a.color || '#E11F7B'}
                  onChange={e => { const allocs = [...((content as any).allocations || [])]; allocs[i] = { ...allocs[i], color: e.target.value }; onUpdate({ ...content, allocations: allocs } as SlideContent) }}
                  title="Couleur de l'allocation"
                  style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none', padding: 0 }}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, allocations: [...((content as any).allocations || []), { pct: '0%', title: 'Nouvelle allocation', desc: '', color: '#E11F7B' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Allocation</button>
        </div>
      )}

      {/* ── TK-0134 — Hero heroBadge + heroFooter ───────────────────── */}
      {SlideType === 'hero' && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Badge (heroBadge)</label>
          <input
            type="text"
            value={(content as any).heroBadge || ''}
            onChange={e => onUpdate({ ...content, heroBadge: e.target.value } as SlideContent)}
            placeholder="Ex: Nouveau ✨"
            style={{ ...fieldStyle }}
          />
          <label style={{ ...fieldLabel, marginTop: 8 }}>Footer badges ({((content as any).heroFooter || []).length})</label>
          {((content as any).heroFooter || []).map((b: { icon: string; label: string }, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
              <input type="text" value={b.icon} onChange={e => { const hf = [...((content as any).heroFooter || [])]; hf[i] = { ...hf[i], icon: e.target.value }; onUpdate({ ...content, heroFooter: hf } as SlideContent) }} placeholder="🌟" style={{ ...fieldStyle, width: 40, padding: '4px 6px' }} />
              <input type="text" value={b.label} onChange={e => { const hf = [...((content as any).heroFooter || [])]; hf[i] = { ...hf[i], label: e.target.value }; onUpdate({ ...content, heroFooter: hf } as SlideContent) }} placeholder="Label badge..." style={{ ...fieldStyle, flex: 1, padding: '4px 6px' }} />
              <button onClick={() => { const hf = ((content as any).heroFooter || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, heroFooter: hf } as SlideContent) }} style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.5)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, heroFooter: [...((content as any).heroFooter || []), { icon: '⚡', label: 'Badge' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Badge</button>
        </div>
      )}

      {/* ── TK-0113 — URL du bouton CTA ──────────────────────────────── */}
      {(SlideType === 'hero' || SlideType === 'cta') && (content as any).buttonText && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>URL du bouton CTA</label>
          <input
            type="url"
            value={(content as any).buttonUrl || ''}
            onChange={e => onUpdate({ ...content, buttonUrl: e.target.value } as SlideContent)}
            placeholder="https://..."
            style={{ ...fieldStyle }}
          />
        </div>
      )}

      </AccordionSection>

      {/* DB-36 — Accordion Style */}
      <AccordionSection id="style" label="Style" isOpen={openSections.has('style')} onToggle={() => toggleSection('style')}>

      {/* TK-0110 — Type selector */}
      {onChangeType && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Type de slide</label>
          <select
            value={SlideType}
            onChange={e => onChangeType(e.target.value as SlideType)}
            style={{ ...fieldStyle, cursor: 'pointer' }}
          >
            {(['hero','content','stats','quote','cta','chart','timeline','comparison','features','pricing','team','roadmap','market','orbit','mockup'] as const).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Layout Variants ─────────────────────────────────────────────── */}
      {(['hero', 'content', 'stats'] as const).includes(SlideType as 'hero' | 'content' | 'stats') && (() => {
        // FIX B — Keys alignées avec sélecteurs CSS aria-deck.css
        const layouts: Record<string, { key: string; label: string }[]> = {
          hero: [
            { key: 'default',   label: 'Centré' },     // base CSS .tpl-hero
            { key: 'left',      label: 'Gauche' },      // .tpl-hero[data-layout="left"]
            { key: 'split',     label: 'Split' },       // .tpl-hero[data-layout="split"]
            { key: 'fullbleed', label: 'Plein écran' }, // .tpl-hero[data-layout="fullbleed"]
          ],
          content: [
            { key: 'default',    label: 'Gauche' },     // base CSS (grid 60/40)
            { key: 'text-only',  label: 'Texte seul' }, // .tpl-content[data-layout="text-only"]
            { key: 'text-right', label: 'Droite' },     // .tpl-content[data-layout="text-right"]
            { key: 'two-col',    label: 'Grille' },     // .tpl-content[data-layout="two-col"]
          ],
          stats: [
            { key: 'default',  label: '4 col' },  // base CSS (2×2 grid)
            { key: 'two-col',  label: '2 col' },  // .tpl-stats[data-layout="two-col"]
            { key: 'row',      label: 'Ligne' },  // .tpl-stats[data-layout="row"]
          ],
        }
        const options = layouts[SlideType] || []
        const currentLayout = (content as { layout?: string }).layout
        return (
          <div style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Layout
            </div>
            <div className="layout-selector">
              {options.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => onUpdate({ ...content, layout: opt.key } as SlideContent)}
                  className={`layout-option${currentLayout === opt.key || (!currentLayout && opt.key === 'default') ? ' active' : ''}`}
                >
                  <span className="layout-option__label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Fond de slide ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Fond de slide
        </div>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {([
            { key: 'theme', label: 'Thème' },
            { key: 'solid', label: 'Couleur' },
            { key: 'gradient', label: 'Dégradé' },
            { key: 'preset', label: 'Preset' },
          ] as const).map(mode => {
            const bg = (content as { slideBackground?: SlideBackground }).slideBackground
            const currentMode = bg?.mode || 'theme'
            return (
              <button
                key={mode.key}
                onClick={() => onUpdate({ ...content, slideBackground: { ...((content as { slideBackground?: SlideBackground }).slideBackground || {}), mode: mode.key } } as SlideContent)}
                style={{
                  fontSize: 10, padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                  background: currentMode === mode.key ? '#E11F7B' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (currentMode === mode.key ? '#E11F7B' : 'rgba(255,255,255,0.1)'),
                  color: currentMode === mode.key ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
        {/* Mode-specific controls */}
        {(() => {
          const bg = (content as { slideBackground?: SlideBackground }).slideBackground
          const mode = bg?.mode || 'theme'
          const updateBg = (patch: Partial<SlideBackground>) => onUpdate({ ...content, slideBackground: { ...bg, mode, ...patch } } as SlideContent)
          if (mode === 'solid') {
            return (
              <div className="bg-color-row">
                <input type="color" className="bg-color-input"
                  value={bg?.solidColor || '#0B090D'}
                  onChange={e => updateBg({ solidColor: e.target.value })} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{bg?.solidColor || '#0B090D'}</span>
                <button onClick={() => onUpdate({ ...content, slideBackground: { mode: 'theme' } } as SlideContent)}
                  style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
                  Reset
                </button>
              </div>
            )
          }
          if (mode === 'gradient') {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" className="bg-color-input" value={bg?.gradientColor1 || '#1A0533'} onChange={e => updateBg({ gradientColor1: e.target.value })} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>→</span>
                  <input type="color" className="bg-color-input" value={bg?.gradientColor2 || '#0D1B4A'} onChange={e => updateBg({ gradientColor2: e.target.value })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>Angle: {bg?.gradientAngle ?? 135}°</span>
                  <input type="range" min={0} max={360} className="bg-slider"
                    value={bg?.gradientAngle ?? 135}
                    onChange={e => updateBg({ gradientAngle: Number(e.target.value) })} />
                </div>
              </div>
            )
          }
          if (mode === 'preset') {
            return (
              <div className="bg-presets">
                {BACKGROUND_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => updateBg({ presetId: preset.id })}
                    className={`bg-preset-swatch${bg?.presetId === preset.id ? ' active' : ''}`}
                    style={{ background: preset.css }}
                    title={preset.label}
                  />
                ))}
              </div>
            )
          }
          return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Fond du thème global</span>
        })()}
      </div>

      {/* TK-0048 — Upload image (commun à tous les types) */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
          Image de la slide
        </label>
        {content.imageUrl ? (
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <img
              src={content.imageUrl}
              style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
              alt="slide"
            />
            <button
              onClick={() => onUpdate({ ...content, imageUrl: undefined })}
              style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4,
                color: '#fff', padding: '2px 6px', fontSize: 11, cursor: 'pointer',
              }}
            >✕</button>
          </div>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          id={`img-upload-${slide.id}`}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file || file.size > 3 * 1024 * 1024) return
            const reader = new FileReader()
            reader.onload = (ev) => {
              const base64 = ev.target?.result as string
              onUpdate({ ...content, imageUrl: base64 })
            }
            reader.readAsDataURL(file)
          }}
        />
        <label
          htmlFor={`img-upload-${slide.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', fontFamily: 'Poppins, sans-serif',
          }}
        >
          <ImageIcon size={14} />
          {content.imageUrl ? "Changer l'image" : 'Ajouter une image'}
        </label>
        {/* DB-38 — Hint upload */}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, display: 'block', fontFamily: 'Poppins, sans-serif' }}>
          JPG, PNG, WebP · max 3 Mo
        </span>
      </div>

      </AccordionSection>

      {/* DB-36 — Accordion Options */}
      <AccordionSection id="options" label="Options" isOpen={openSections.has('options')} onToggle={() => toggleSection('options')}>
        {SlideType === 'pricing' ? (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 0', fontFamily: 'Poppins, sans-serif' }}>
            Les toggles <strong>Featured</strong> sont disponibles dans chaque offre (section Contenu).
          </p>
        ) : SlideType === 'roadmap' ? (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 0', fontFamily: 'Poppins, sans-serif' }}>
            Le statut et les icônes sont configurables dans chaque phase (section Contenu).
          </p>
        ) : (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', padding: '4px 0', fontFamily: 'Poppins, sans-serif' }}>
            Aucune option pour ce type.
          </p>
        )}
      </AccordionSection>

    </div>
    </div>
    )}
    </div>
  )
}

// ── DB-34 — Type badge colors ──────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  hero: '#E11F7B', stats: '#3B82F6', cta: '#10B981', features: '#8B5CF6',
  pricing: '#F59E0B', team: '#06B6D4', roadmap: '#F97316', market: '#EC4899',
  orbit: '#6366F1', mockup: '#14B8A6', content: '#94A3B8', quote: '#A78BFA',
  chart: '#22C55E', timeline: '#EAB308', comparison: '#64748B',
}

// ── SlideThumbnail ────────────────────────────────────────────────────────────

function SlideThumbnail({
  slide,
  theme,
  themeJSON,
  index,
  active,
  onClick,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDuplicate,
  isFirst,
  isLast,
}: {
  slide: SlideData
  theme: DeckTheme
  themeJSON?: DeckThemeJSON
  index: number
  active: boolean
  onClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onDuplicate: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const [hovered, setHovered] = useState(false)
  // DB-35 — Auto-scroll vers slide active
  const thumbRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (active && thumbRef.current) {
      thumbRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [active])

  return (
    <div
      ref={thumbRef}
      style={{ marginBottom: 8, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Number + type */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4, padding: '0 2px',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#E11F7B' : 'rgba(255,255,255,0.25)' }}>
          {index + 1}
        </span>
        {/* DB-34 — Badge type coloré */}
        <span style={{
          fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          background: `${TYPE_COLORS[slide.type] || '#94A3B8'}22`,
          color: TYPE_COLORS[slide.type] || '#94A3B8',
          letterSpacing: '0.03em', textTransform: 'uppercase',
          border: `1px solid ${TYPE_COLORS[slide.type] || '#94A3B8'}44`,
        }}>
          {slide.type}
        </span>
      </div>

      {/* Thumbnail preview */}
      <div
        className={`slide-thumb${active ? ' active' : ''}`}
        onClick={onClick}
        style={{ position: 'relative' }}
      >
        <div style={{ transform: 'scale(0.25)', transformOrigin: '0 0', width: '400%', height: '400%', pointerEvents: 'none' }}>
          <SlideRenderer slide={slide} theme={theme} themeJSON={themeJSON} thumbnail />
        </div>

        {/* Hover controls */}
        {hovered && (
          <div style={{
            position: 'absolute', top: 2, right: 2,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {!isFirst && (
              <button onClick={e => { e.stopPropagation(); onMoveUp() }} style={iconBtnStyle}>
                <ArrowUp size={10} />
              </button>
            )}
            {!isLast && (
              <button onClick={e => { e.stopPropagation(); onMoveDown() }} style={iconBtnStyle}>
                <ArrowDown size={10} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDuplicate() }}
              title="Dupliquer"
              style={{ ...iconBtnStyle }}
            >
              ⧉
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={{ ...iconBtnStyle, color: '#EF4444' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 4,
  border: 'none', background: 'rgba(0,0,0,0.7)',
  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// ── DB-33 — SortableSlideThumbnail ────────────────────────────────────────────

interface SlideThumbnailProps {
  slide: SlideData
  theme: DeckTheme
  themeJSON?: DeckThemeJSON
  index: number
  active: boolean
  onClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onDuplicate: () => void
  isFirst: boolean
  isLast: boolean
}

function SortableSlideThumbnail(props: SlideThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.slide.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SlideThumbnail {...props} />
    </div>
  )
}

// ── DeckEditorPage ────────────────────────────────────────────────────────────

// TK-0112 — Slide type presets
const SLIDE_TYPE_PRESETS: Array<{ type: SlideType; icon: string; label: string; defaultContent: Record<string, unknown> }> = [
  { type: 'hero',       icon: '🦸', label: 'Hero',        defaultContent: { title: 'Titre principal', subtitle: 'Sous-titre accrocheur', eyebrow: 'Eyebrow' } },
  { type: 'content',    icon: '📄', label: 'Contenu',     defaultContent: { label: 'Section', title: 'Titre', body: 'Corps du texte...', bullets: ['Point 1', 'Point 2'] } },
  { type: 'stats',      icon: '📊', label: 'Stats',       defaultContent: { title: 'Métriques clés', metrics: [{ value: '1M+', label: 'Utilisateurs' }, { value: '99%', label: 'Satisfaction' }] } },
  { type: 'quote',      icon: '💬', label: 'Citation',    defaultContent: { text: 'Une citation inspirante.', author: 'Auteur', role: 'Rôle' } },
  { type: 'cta',        icon: '🚀', label: 'CTA',         defaultContent: { title: "Passez à l'action", subtitle: 'Description', buttonText: 'Commencer' } },
  { type: 'chart',      icon: '📈', label: 'Graphique',   defaultContent: { title: 'Graphique', chartType: 'bar', data: [{ label: 'A', value: 40 }, { label: 'B', value: 70 }, { label: 'C', value: 55 }] } },
  { type: 'timeline',   icon: '⏳', label: 'Timeline',    defaultContent: { title: 'Historique', events: [{ year: '2023', label: 'Lancement', desc: '' }, { year: '2024', label: 'Croissance', desc: '' }] } },
  { type: 'comparison', icon: '⚖️', label: 'Comparaison', defaultContent: { title: 'Avant / Après', left: { label: 'Avant', items: ['Item 1'] }, right: { label: 'Après', items: ['Item 1'] } } },
  { type: 'features',   icon: '✨', label: 'Features',    defaultContent: { title: 'Fonctionnalités', features: [{ icon: '🔥', title: 'Feature 1', desc: 'Description' }, { icon: '⚡', title: 'Feature 2', desc: 'Description' }] } },
  { type: 'pricing',    icon: '💰', label: 'Pricing',     defaultContent: { title: 'Tarifs', tiers: [{ name: 'Starter', price: '0€', per: '/mois', desc: '', features: [], featured: false }, { name: 'Pro', price: '29€', per: '/mois', desc: '', features: [], featured: true }] } },
  { type: 'team',       icon: '👥', label: 'Équipe',      defaultContent: { title: 'Notre équipe', members: [{ initial: 'A', name: 'Alice', role: 'CEO', bio: '' }] } },
  { type: 'roadmap',    icon: '🗺️', label: 'Roadmap',     defaultContent: { title: 'Roadmap', phases: [{ quarter: 'Q1', title: 'Phase 1', items: [], current: true }] } },
  { type: 'market',     icon: '🎯', label: 'Marché',      defaultContent: { title: 'Marché', bars: [{ label: 'TAM', value: '$100B', color: '#E11F7B', width: 100 }, { label: 'SAM', value: '$10B', color: '#7C3AED', width: 65 }, { label: 'SOM', value: '$1B', color: '#00d4ff', width: 35 }] } },
  { type: 'orbit',      icon: '🌐', label: 'Orbit',       defaultContent: { title: 'Écosystème', nodes: [{ initial: 'A', label: 'Node A' }], steps: [{ num: 1, title: 'Étape 1', desc: '' }] } },
  { type: 'mockup',     icon: '🖥️', label: 'Mockup',      defaultContent: { title: 'Interface', cards: [{ status: 'todo', statusColor: '#6366f1', title: 'Tâche', progress: 0 }], agents: [] } },
]

export function DeckEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckData | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  // DB-27 — Delete modal + countdown
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(3)
  // DB-28 — Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  // DB-30 — Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'warning'; message: string }>>([])
  // DB-32 — Overflow menu
  const [showOverflowMenu, setShowOverflowMenu] = useState(false)
  const [templatesList, setTemplatesList] = useState<TemplateRecord[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null)
  const [previousThemeJson, setPreviousThemeJson] = useState<string | null>(null)
  const [undoToast, setUndoToast] = useState(false)
  const [deleteToast, setDeleteToast] = useState(false)
  const [mobileTab, setMobileTab] = useState<'slides' | 'canvas' | 'props'>('canvas')
  const [showAddSlideModal, setShowAddSlideModal] = useState(false)
  // DB-45 — Cheat sheet modal
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  // DB-46 — Toggle Edit / Preview
  const [previewMode, setPreviewMode] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // TK-0118 — Undo/Redo stacks
  const undoStackRef = useRef<Array<{ slideId: string; content: SlideContent }[]>>([])
  const redoStackRef = useRef<Array<{ slideId: string; content: SlideContent }[]>>([])
  // DB-44 — Undo delete slide
  const deletedSlideRef = useRef<{ slide: SlideData; idx: number } | null>(null)
  const MAX_UNDO = 20
  // ── Inline edit state ──────────────────────────────────────────────────────
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  // ── DB-33 — DnD sensors ────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const theme = getTheme(deck)
  const themeJSON = parseThemeJSON(deck)
  const activeSlide = slides[activeIdx] || null

  async function updateThemeJSON(updates: Partial<DeckThemeJSON>) {
    if (!id) return
    const current = themeJSON
    const next: DeckThemeJSON = { ...current, ...updates }
    await supabase
      .from('presentations')
      .update({ theme_json: JSON.stringify(next) })
      .eq('id', id)
      .then(() => {})
    setDeck(d => d ? { ...d, theme_json: JSON.stringify(next) } : d)
  }

  useEffect(() => {
    if (id) fetchDeck(id)
  }, [id])

  // TK-0117 + TK-0118 — Raccourcis clavier : nav slides + suppr + escape + undo/redo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape — ferme la cheat sheet, quitte le preview, ou désélectionne
      if (e.key === 'Escape') {
        if (showShortcutsModal) { setShowShortcutsModal(false); return }
        if (previewMode) { setPreviewMode(false); return }
        setSelectedFieldId(null)
        return
      }

      // DB-45 — '?' ouvre la cheat sheet (sauf si modal déjà ouverte ou focus dans un input)
      if (e.key === '?' && !showShortcutsModal) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault()
          setShowShortcutsModal(true)
          return
        }
      }

      // Ctrl+Z — Undo (AVANT le guard tagName pour fonctionner même en édition inline)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      // Ctrl+Y ou Ctrl+Shift+Z — Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
        return
      }

      // Ne pas intercepter si focus dans un input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      // Arrow Left/Right — navigation entre slides
      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setActiveIdx(prev => Math.max(0, prev - 1))
      }
      if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setActiveIdx(prev => Math.min(slides.length - 1, prev + 1))
      }

      // Delete / Backspace — supprimer la slide active (avec garde)
      if ((e.key === 'Delete' || e.key === 'Backspace') && slides.length > 1) {
        e.preventDefault()
        deleteSlide(activeIdx)
      }

      // DB-39 — Ctrl+D dupliquer slide
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        duplicateSlide(activeIdx)
      }

      // DB-40 — Ctrl+Enter → présenter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        navigate(`/decks/${id}/present`)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [slides, activeIdx, showShortcutsModal, previewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // DB-27 — Countdown pour la modale de suppression
  useEffect(() => {
    if (!showDeleteModal) { setDeleteCountdown(3); return }
    if (deleteCountdown <= 0) return
    const t = setTimeout(() => setDeleteCountdown(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [showDeleteModal, deleteCountdown])

  // DB-30 — showToast helper
  function showToast(type: 'success' | 'error' | 'warning', message: string) {
    const toastId = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id: toastId, type, message }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 4000)
  }

  async function fetchDeck(deckId: string) {
    setLoading(true)
    const { data: deckData } = await supabase
      .from('presentations')
      .select('*')
      .eq('id', deckId)
      .single()

    if (deckData) {
      setDeck(deckData as DeckData)
      setTitleValue((deckData as DeckData).title)
    }

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

  // Debounced auto-save on slide update
  const autoSave = useCallback((slideId: string, content: SlideContent) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('pending')
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await supabase
          .from('slides')
          .update({ content_json: content })
          .eq('id', slideId)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 5000)
      } catch {
        setSaveStatus('error')
      }
    }, 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateSlideContent(content: SlideContent) {
    if (!activeSlide) return
    // TK-0118 — Sauvegarder snapshot avant modification
    const snapshot = slides.map(s => ({ slideId: s.id, content: s.content }))
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), snapshot]
    redoStackRef.current = []
    const updated = slides.map((s, i) =>
      i === activeIdx ? { ...s, content } : s
    )
    setSlides(updated)
    autoSave(activeSlide.id, content)
  }

  // TK-0118 — Undo
  function handleUndo() {
    // DB-44 — Priorité 1 : undo d'une suppression de slide
    if (deletedSlideRef.current) {
      const { slide, idx } = deletedSlideRef.current
      deletedSlideRef.current = null
      const restored = [...slides]
      restored.splice(idx, 0, slide)
      restored.forEach((s, i) => { s.position = i + 1 })
      setSlides(restored)
      setActiveIdx(idx)
      supabase.from('slides')
        .upsert({ id: slide.id, deck_id: slide.deck_id, position: slide.position, type: slide.type, content_json: slide.content })
        .then(() => {})
      return
    }
    if (undoStackRef.current.length === 0) return
    const currentSnapshot = slides.map(s => ({ slideId: s.id, content: s.content }))
    redoStackRef.current = [...redoStackRef.current, currentSnapshot]
    const prevSnapshot = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setSlides(prev => prev.map(s => {
      const saved = prevSnapshot.find(snap => snap.slideId === s.id)
      return saved ? { ...s, content: saved.content } : s
    }))
    prevSnapshot.forEach(snap => autoSave(snap.slideId, snap.content))
  }

  // TK-0118 — Redo
  function handleRedo() {
    if (redoStackRef.current.length === 0) return
    const currentSnapshot = slides.map(s => ({ slideId: s.id, content: s.content }))
    undoStackRef.current = [...undoStackRef.current, currentSnapshot]
    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    setSlides(prev => prev.map(s => {
      const saved = nextSnapshot.find(snap => snap.slideId === s.id)
      return saved ? { ...s, content: saved.content } : s
    }))
    nextSnapshot.forEach(snap => autoSave(snap.slideId, snap.content))
  }

  // TK-0110 — Changer le type d'une slide existante
  async function updateSlideType(newType: SlideType) {
    if (!activeSlide) return
    await supabase
      .from('slides')
      .update({ type: newType, content_json: {} })
      .eq('id', activeSlide.id)
    setSlides(prev => prev.map((s, i) =>
      i === activeIdx ? { ...s, type: newType, content: {} as SlideContent } : s
    ))
  }

  // ── Inline edit helpers ────────────────────────────────────────────────────

  // Deep set d'une valeur dans un objet selon un path 'a.b.2.c'
  function deepSet(obj: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
    const keys = path.split('.')
    const result = { ...obj }
    let current: Record<string, unknown> = result
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const nextKey = keys[i + 1]
      const isNextIndex = !isNaN(Number(nextKey))
      if (Array.isArray(current[key])) {
        current[key] = [...(current[key] as unknown[])]
      } else {
        current[key] = typeof current[key] === 'object' && current[key] !== null
          ? { ...(current[key] as Record<string, unknown>) }
          : (isNextIndex ? [] : {})
      }
      current = current[key] as Record<string, unknown>
    }
    current[keys[keys.length - 1]] = value
    return result
  }

  function handleFieldSave(fieldId: string, value: string) {
    if (!activeSlide) return
    const updated = deepSet(activeSlide.content as Record<string, unknown>, fieldId, value)
    updateSlideContent(updated as SlideContent)
  }

  function handleFieldSelect(fieldId: string) {
    setSelectedFieldId(fieldId)
  }

  // DB-11 — Supprimer un item de liste
  function handleRemoveItem(path: string, index: number) {
    if (!activeSlide) return
    const content = { ...(activeSlide.content as Record<string, unknown>) }
    const parts = path.split('.')
    if (parts.length === 1) {
      const arr = content[path]
      if (!Array.isArray(arr)) return
      content[path] = arr.filter((_, i) => i !== index)
    } else if (parts.length === 2) {
      // e.g. 'left.items' or 'right.items'
      const obj = (content[parts[0]] as Record<string, unknown>) || {}
      const arr = Array.isArray(obj[parts[1]]) ? obj[parts[1]] as unknown[] : []
      content[parts[0]] = { ...obj, [parts[1]]: arr.filter((_, i) => i !== index) }
    } else if (parts.length === 3) {
      // e.g. 'tiers.0.features' or 'phases.1.items'
      const parentArr = Array.isArray(content[parts[0]]) ? [...(content[parts[0]] as unknown[])] : []
      const parentIdx = parseInt(parts[1])
      const parentObj = { ...(parentArr[parentIdx] as Record<string, unknown>) }
      const arr = Array.isArray(parentObj[parts[2]]) ? parentObj[parts[2]] as unknown[] : []
      parentObj[parts[2]] = arr.filter((_, i) => i !== index)
      parentArr[parentIdx] = parentObj
      content[parts[0]] = parentArr
    }
    updateSlideContent(content as SlideContent)
  }

  // DB-14 — Ajouter un item de liste
  function handleAddItem(path: string, defaultValue: unknown) {
    if (!activeSlide) return
    const content = { ...(activeSlide.content as Record<string, unknown>) }
    const parts = path.split('.')
    if (parts.length === 1) {
      const arr = Array.isArray(content[path]) ? [...(content[path] as unknown[])] : []
      content[path] = [...arr, defaultValue]
    } else if (parts.length === 2) {
      // e.g. 'left.items' or 'right.items'
      const obj = (content[parts[0]] as Record<string, unknown>) || {}
      const arr = Array.isArray(obj[parts[1]]) ? [...(obj[parts[1]] as unknown[])] : []
      content[parts[0]] = { ...obj, [parts[1]]: [...arr, defaultValue] }
    } else if (parts.length === 3) {
      // e.g. 'tiers.0.features' or 'phases.1.items'
      const parentArr = Array.isArray(content[parts[0]]) ? [...(content[parts[0]] as unknown[])] : []
      const parentIdx = parseInt(parts[1])
      const parentObj = { ...(parentArr[parentIdx] as Record<string, unknown>) }
      const arr = Array.isArray(parentObj[parts[2]]) ? [...(parentObj[parts[2]] as unknown[])] : []
      parentObj[parts[2]] = [...arr, defaultValue]
      parentArr[parentIdx] = parentObj
      content[parts[0]] = parentArr
    }
    updateSlideContent(content as SlideContent)
  }

  // DB-12 — Réordonner un item de liste
  function handleReorderItems(path: string, newArray: unknown[]) {
    if (!activeSlide) return
    const content = { ...(activeSlide.content as Record<string, unknown>) }
    content[path] = newArray
    updateSlideContent(content as SlideContent)
  }

  // DB-13 — Redimensionner le texte inline (delta = ±1 en rem steps de 0.1)
  function handleUpdateFontSize(fieldPath: string, delta: number) {
    if (!activeSlide) return
    const content = { ...(activeSlide.content as Record<string, unknown>) }
    const fontSizes = { ...((content._fontSizes as Record<string, number>) || {}) }
    // Valeur courante : si non définie, on part de 1.0rem (base)
    const current = fontSizes[fieldPath] ?? 1.0
    const next = Math.max(0.5, Math.min(4.0, Math.round((current + delta * 0.1) * 10) / 10))
    fontSizes[fieldPath] = next
    content._fontSizes = fontSizes
    updateSlideContent(content as SlideContent)
  }

  function handleImageClick(fieldId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || file.size > 3 * 1024 * 1024) return
      const reader = new FileReader()
      reader.onload = () => handleFieldSave(fieldId, reader.result as string)
      reader.readAsDataURL(file)
    }
    input.click()
  }

  async function saveTitle() {
    if (!deck || !id) return
    setEditingTitle(false)
    if (titleValue === deck.title) return
    await supabase
      .from('presentations')
      .update({ title: titleValue })
      .eq('id', id)
    setDeck(d => d ? { ...d, title: titleValue } : d)
  }

  async function moveSlide(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= slides.length) return

    const updated = [...slides]
    const temp = updated[idx]
    updated[idx] = updated[targetIdx]
    updated[targetIdx] = temp

    // Update positions
    updated.forEach((s, i) => { s.position = i + 1 })
    setSlides(updated)
    setActiveIdx(targetIdx)

    // Save to Supabase
    await Promise.all([
      supabase.from('slides').update({ position: updated[idx].position }).eq('id', updated[idx].id),
      supabase.from('slides').update({ position: updated[targetIdx].position }).eq('id', updated[targetIdx].id),
    ])
  }

  // ── DB-33 — handleDragEnd ──────────────────────────────────────────────────
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = slides.findIndex(s => s.id === active.id)
    const newIndex = slides.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(slides, oldIndex, newIndex)
    reordered.forEach((s, i) => { s.position = i + 1 })
    setSlides(reordered)
    if (activeIdx === oldIndex) setActiveIdx(newIndex)
    else if (activeIdx > oldIndex && activeIdx <= newIndex) setActiveIdx(activeIdx - 1)
    else if (activeIdx < oldIndex && activeIdx >= newIndex) setActiveIdx(activeIdx + 1)

    // Batch save to Supabase
    await Promise.all(
      reordered.map(s => supabase.from('slides').update({ position: s.position }).eq('id', s.id))
    )
  }

  async function deleteSlide(idx: number) {
    if (slides.length <= 1) return
    const slide = slides[idx]
    // DB-44 — Sauvegarder pour undo
    deletedSlideRef.current = { slide, idx }
    await supabase.from('slides').delete().eq('id', slide.id)
    const updated = slides.filter((_, i) => i !== idx)
    updated.forEach((s, i) => { s.position = i + 1 })
    setSlides(updated)
    setActiveIdx(Math.min(activeIdx, updated.length - 1))
    // DB-44 — Toast "Slide supprimée — Ctrl+Z pour annuler"
    setDeleteToast(true)
    setTimeout(() => setDeleteToast(false), 3000)
  }

  async function duplicateSlide(idx: number) {
    if (!id) return
    const source = slides[idx]
    const newSlide = {
      deck_id: id,
      position: slides.length + 1,
      type: source.type,
      content_json: source.content,
    }
    const { data } = await supabase.from('slides').insert(newSlide).select().single()
    if (data) {
      setSlides(prev => [...prev, { ...data, content: data.content_json } as SlideData])
      setActiveIdx(slides.length)
    }
  }

  async function addSlideWithType(preset: typeof SLIDE_TYPE_PRESETS[0]) {
    if (!id) return
    const newSlide = {
      deck_id: id,
      position: slides.length + 1,
      type: preset.type,
      content_json: preset.defaultContent,
    }
    const { data } = await supabase.from('slides').insert(newSlide).select().single()
    if (data) {
      setSlides(prev => [...prev, { ...data, content: data.content_json } as SlideData])
      setActiveIdx(slides.length)
    }
    setShowAddSlideModal(false)
  }

  async function handleExportPDF() {
    if (!deck) return
    setExporting(true)
    try {
      const htmlContent = await generateHTMLForExport(deck, slides.map(s => ({
        id: s.id, deck_id: s.deck_id, position: s.position, type: s.type,
        content_json: s.content, created_at: '',
      })))
      const printCSS = `
        @media print {
          .slide-nav, .progress-bar, .keyboard-hint, .nav-hint, .counter { display: none !important; }
          .slide { page-break-after: always; height: 100vh !important; width: 100vw !important; }
          body { margin: 0; }
        }
        @page { size: A4 landscape; margin: 0; }
      `
      const blob = new Blob([htmlContent.replace('</style>', printCSS + '</style>')], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        }
      }
    } catch (err) {
      console.error('[DeckEditorPage] export PDF error:', err)
    }
    setExporting(false)
  }

  async function handlePublish() {
    if (!id || publishing) return
    setPublishing(true)
    try {
      const url = await publishDeck(id)
      if (url) {
        window.open(url, '_blank')
        setDeck(d => d ? { ...d, status: 'published', published_url: url } : d)
        showToast('success', 'Deck publié avec succès !')
      }
    } catch (err) {
      console.error('[DeckEditorPage] publish error:', err)
      showToast('error', 'Erreur lors de la publication: ' + (err instanceof Error ? err.message : 'Inconnu'))
    }
    setPublishing(false)
  }

  async function handleUnpublish() {
    if (!id || publishing) return
    setPublishing(true)
    await supabase.from('presentations').update({ status: 'draft' }).eq('id', id)
    setDeck(d => d ? { ...d, status: 'draft' } : d)
    setPublishing(false)
  }

  async function handleDelete() {
    if (!id) return
    // DB-27 — confirmation via modale branded, pas window.confirm
    await supabase.from('slides').delete().eq('deck_id', id)
    await supabase.from('presentations').delete().eq('id', id)
    navigate('/decks')
  }

  // Load templates when modal opens
  useEffect(() => {
    if (!showTemplateModal) return
    supabase.from('templates').select('*').then(({ data }) => {
      if (data) setTemplatesList(data as TemplateRecord[])
    })
  }, [showTemplateModal])

  async function applyTemplate(template: TemplateRecord) {
    if (!id) return
    const newThemeJson = JSON.stringify(template.theme_config)
    setPreviousThemeJson(deck?.theme_json || null)
    await supabase.from('presentations').update({ theme_json: newThemeJson }).eq('id', id)
    setDeck(d => d ? { ...d, theme_json: newThemeJson } : d)
    setShowTemplateModal(false)
    setSelectedTemplate(null)
    setUndoToast(true)
    setTimeout(() => setUndoToast(false), 5000)
  }

  async function undoTemplate() {
    if (!id || previousThemeJson === null) return
    await supabase.from('presentations').update({ theme_json: previousThemeJson }).eq('id', id)
    setDeck(d => d ? { ...d, theme_json: previousThemeJson } : d)
    setPreviousThemeJson(null)
    setUndoToast(false)
  }

  // DB-50 — Skeleton loading
  if (loading) {
    return <DeckEditorSkeleton />
  }

  return (
    <div data-theme="DARK_PREMIUM" className="deck-editor" style={{ fontFamily: 'Poppins, sans-serif' }}>

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="deck-topbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/decks')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Editable title */}
          {editingTitle ? (
            <input
              autoFocus
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(225,31,123,0.4)',
                borderRadius: 6, padding: '4px 10px', color: '#F5F0F7',
                fontSize: 14, fontWeight: 700, fontFamily: 'Poppins, sans-serif', outline: 'none',
                minWidth: 200,
              }}
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, color: '#F5F0F7',
                fontFamily: 'Poppins, sans-serif', padding: '4px 8px',
                borderRadius: 4,
              }}
              title="Cliquer pour modifier"
            >
              {deck?.title || 'Sans titre'}
            </button>
          )}

          {/* DB-42 — Badge statut deck */}
          {deck && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: deck.published_url || deck.status === 'published' ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
              color: deck.published_url || deck.status === 'published' ? '#4ade80' : 'rgba(255,255,255,0.35)',
              border: `1px solid ${deck.published_url || deck.status === 'published' ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
              fontFamily: 'Poppins, sans-serif',
            }}>
              {deck.published_url || deck.status === 'published' ? '● Publié' : '○ Brouillon'}
            </span>
          )}

          {/* DB-28 — Save indicator */}
          {saveStatus !== 'idle' && (
            <span style={{
              fontSize: 11, fontWeight: 600, fontFamily: 'Poppins, sans-serif',
              display: 'flex', alignItems: 'center', gap: 4,
              color: saveStatus === 'error' ? '#ff6b6b' : saveStatus === 'saved' ? '#4ade80' : saveStatus === 'pending' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              transition: 'color 0.3s',
            }}>
              {saveStatus === 'pending' && '● Modifications non sauvegardées'}
              {saveStatus === 'saving' && '↻ Sauvegarde...'}
              {saveStatus === 'saved' && '✓ Sauvegardé'}
              {saveStatus === 'error' && '⚠ Erreur de sauvegarde'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Slide counter */}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {activeIdx + 1} / {slides.length}
          </span>

          {/* Template swap */}
          <button
            onClick={() => setShowTemplateModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
            title="Changer de template"
          >
            🎨 Template
          </button>

          {/* DB-29/32 — Modèle+ déplacé dans le menu ··· */}

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: '#F5F0F7',
              fontSize: 12, fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontFamily: 'Poppins, sans-serif',
              opacity: exporting ? 0.6 : 1,
            }}
            title="Exporter en PDF"
          >
            {exporting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
            {exporting ? 'Export...' : 'PDF'}
          </button>

          {/* DB-46 — Toggle Edit / Preview */}
          <button
            onClick={() => setPreviewMode(v => !v)}
            title={previewMode ? 'Repasser en mode édition' : 'Aperçu sans contrôles'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 7,
              border: previewMode
                ? '1px solid rgba(225,31,123,0.5)'
                : '1px solid rgba(255,255,255,0.12)',
              background: previewMode
                ? 'rgba(225,31,123,0.15)'
                : 'rgba(255,255,255,0.05)',
              color: previewMode ? '#E11F7B' : 'rgba(255,255,255,0.5)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {previewMode ? <EyeOff size={13} /> : <Eye size={13} />}
            {previewMode ? 'Éditer' : 'Preview'}
          </button>

          <button
            onClick={() => navigate(`/decks/${id}/present`)}
            style={topbarBtnStyle(false)}
          >
            <Eye size={13} />
            Aperçu
          </button>

          {deck?.status === 'published' && (
            <button
              onClick={() => navigate(`/decks/${id}/analytics`)}
              style={{ ...topbarBtnStyle(false), gap: 5 }}
              title="Voir les analytics"
            >
              <BarChart2 size={13} />
              Analytics
            </button>
          )}

          {deck?.status === 'published' ? (
            <button
              onClick={handleUnpublish}
              disabled={publishing}
              title="Dépublier le deck"
              style={{ ...topbarBtnStyle(false), color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)' }}
            >
              <EyeOff size={13} />
              Dépublier
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              style={topbarBtnStyle(true)}
            >
              <Globe size={13} />
              {publishing ? 'Publication...' : 'Publier'}
            </button>
          )}

          {/* DB-32 — Menu ··· pour actions secondaires */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOverflowMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, fontFamily: 'Poppins, sans-serif' }}
              title="Plus d'options"
            >···</button>
            {showOverflowMenu && (
              <div
                style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#1a1520', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                onMouseLeave={() => setShowOverflowMenu(false)}
              >
                {/* DB-29 — Modèle + */}
                <button
                  onClick={() => { setShowSaveTemplate(true); setShowOverflowMenu(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, border: 'none', background: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  title="Sauvegarder comme modèle réutilisable"
                >
                  <LayoutTemplate size={13} />
                  Modèle +
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button
                  onClick={() => { setShowDeleteModal(true); setShowOverflowMenu(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, border: 'none', background: 'none', color: '#ff6b6b', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,80,80,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  🗑 Supprimer le deck
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Slides panel (DB-46 : caché en preview) ─────────────────────────── */}
      <div className={`deck-slides${mobileTab === 'slides' ? ' mobile-active' : ''}`} style={{ display: previewMode ? 'none' : undefined }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={slides.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((slide, i) => (
              <SortableSlideThumbnail
                key={slide.id}
                slide={slide}
                theme={theme}
                themeJSON={themeJSON}
                index={i}
                active={i === activeIdx}
                onClick={() => setActiveIdx(i)}
                onMoveUp={() => moveSlide(i, 'up')}
                onMoveDown={() => moveSlide(i, 'down')}
                onDelete={() => deleteSlide(i)}
                onDuplicate={() => duplicateSlide(i)}
                isFirst={i === 0}
                isLast={i === slides.length - 1}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={() => setShowAddSlideModal(true)}
          style={{
            width: '100%', padding: '8px', borderRadius: 6,
            border: '1px dashed rgba(255,255,255,0.12)',
            background: 'none', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            fontSize: 12, fontFamily: 'Poppins, sans-serif', marginTop: 4,
          }}
        >
          <Plus size={13} />
          Ajouter
        </button>

        {/* TK-0112 — Add slide type picker modal */}
        {showAddSlideModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowAddSlideModal(false)}>
            <div style={{
              background: '#1a1520', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 24, maxWidth: 480, width: '90%',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Poppins, sans-serif' }}>
                  Choisir un type de slide
                </span>
                <button onClick={() => setShowAddSlideModal(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {SLIDE_TYPE_PRESETS.map(preset => (
                  <button
                    key={preset.type}
                    onClick={() => addSlideWithType(preset)}
                    style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, padding: '10px 4px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s', fontFamily: 'Poppins, sans-serif',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,31,123,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(225,31,123,0.3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >
                    <span style={{ fontSize: 20 }}>{preset.icon}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Canvas zone ─────────────────────────────────────────────────────── */}
      <div className={`deck-canvas-zone${mobileTab !== 'canvas' ? ' mobile-canvas-hidden' : ''}`}>
        {activeSlide ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', height: '100%' }}>
            {/* Inline edit hint (DB-46 : caché en preview) */}
            {!previewMode && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', marginBottom: 0 }}>
                <span style={{ fontSize: 11, color: 'rgba(225,31,123,0.55)' }}>
                  ✏️ Cliquez sur un champ pour éditer • Escape pour désélectionner
                </span>
              </div>
            )}
            <div
              className="deck-slide-canvas"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {/* Animated background dans l'éditeur */}
              {(() => {
                const bgType: BgType = (themeJSON?.bgAnimation as BgType) ?? 'none'
                return bgType !== 'none' ? (
                  <AnimatedBackground type={bgType} accentColor={themeJSON?.accentColor} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
                ) : null
              })()}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlide.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
                >
                  {/* DB-46 : editMode=false en preview masque les contrôles */}
                  <SlideRenderer
                    slide={activeSlide}
                    theme={theme}
                    themeJSON={themeJSON}
                    editMode={!previewMode}
                    selectedFieldId={previewMode ? null : selectedFieldId}
                    onFieldSelect={previewMode ? undefined : handleFieldSelect}
                    onFieldSave={previewMode ? undefined : handleFieldSave}
                    onImageClick={previewMode ? undefined : handleImageClick}
                    onRemoveItem={previewMode ? undefined : handleRemoveItem}
                    onAddItem={previewMode ? undefined : handleAddItem}
                    onReorderItems={previewMode ? undefined : handleReorderItems}
                    onUpdateFontSize={previewMode ? undefined : handleUpdateFontSize}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                disabled={activeIdx === 0}
                style={{ ...navBtnStyle, opacity: activeIdx === 0 ? 0.3 : 1 }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 60, textAlign: 'center' }}>
                {activeIdx + 1} / {slides.length}
              </span>
              <button
                onClick={() => setActiveIdx(i => Math.min(slides.length - 1, i + 1))}
                disabled={activeIdx === slides.length - 1}
                style={{ ...navBtnStyle, opacity: activeIdx === slides.length - 1 ? 0.3 : 1 }}
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate(`/decks/${id}/present`)}
                style={{ ...navBtnStyle, marginLeft: 8 }}
                title="Plein écran"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* DB-51 — Empty state quand le deck n'a aucune slide */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 16, padding: 40,
            background: '#0B090D', borderRadius: 12,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 64, lineHeight: 1 }}>🎞️</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Poppins, sans-serif', marginBottom: 8,
              }}>
                Aucune slide
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.35)',
                fontFamily: 'Poppins, sans-serif',
              }}>
                Ajoute ta première slide pour commencer
              </div>
            </div>
            <button
              onClick={() => setShowAddSlideModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 8, border: 'none',
                background: '#E11F7B', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif',
                boxShadow: '0 4px 20px rgba(225,31,123,0.4)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={15} />
              Ajouter une slide
            </button>
          </div>
        )}
      </div>

      {/* ── Props panel (DB-46 : caché en preview) ──────────────────────────── */}
      <div className={`deck-props${mobileTab === 'props' ? ' mobile-active' : ''}`} style={{ padding: 0, display: previewMode ? 'none' : undefined }}>
        {activeSlide ? (
          <PropsPanel
            slide={activeSlide}
            deckTitle={deck?.title || ''}
            deckId={deck?.id}
            themeJSON={themeJSON}
            onUpdate={updateSlideContent}
            onRegenerate={() => { /* trigger refresh */ }}
            onChangeType={updateSlideType}
            onUpdateTheme={updateThemeJSON}
          />
        ) : (
          <div style={{ padding: 16, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Sélectionnez une slide pour éditer ses propriétés.
          </div>
        )}
      </div>

      {/* ── Save Template Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveTemplate && deck && (
          <SaveTemplateModal
            deck={deck}
            slides={slides}
            onClose={() => setShowSaveTemplate(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Template Swap Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showTemplateModal && (
          <TemplateSwapModal
            templates={templatesList}
            currentThemeJson={deck?.theme_json || null}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
            onApply={applyTemplate}
            onClose={() => { setShowTemplateModal(false); setSelectedTemplate(null) }}
          />
        )}
      </AnimatePresence>

      {/* ── Undo Toast ───────────────────────────────────────────────────── */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#2C272F', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
          color: '#F5F0F7', fontSize: 13, fontFamily: 'Poppins, sans-serif',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          ✅ Template appliqué
          <button
            onClick={undoTemplate}
            style={{ background: '#E11F7B', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
          >
            Annuler
          </button>
          <button
            onClick={() => setUndoToast(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 16 }}
          >×</button>
        </div>
      )}

      {/* ── DB-44 Delete Toast ───────────────────────────────────────────── */}
      {deleteToast && (
        <div style={{
          position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#2C272F', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
          color: '#F5F0F7', fontSize: 13, fontFamily: 'Poppins, sans-serif',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          🗑️ Slide supprimée — Ctrl+Z pour annuler
          <button
            onClick={() => setDeleteToast(false)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 16 }}
          >×</button>
        </div>
      )}

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {([
          { key: 'slides', label: 'Slides', icon: '📋' },
          { key: 'canvas', label: 'Canvas', icon: '🎨' },
          { key: 'props', label: 'Props', icon: '⚙️' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            className={`mobile-bottom-nav__tab${mobileTab === tab.key ? ' active' : ''}`}
            onClick={() => setMobileTab(tab.key)}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes slide-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* DB-27 — Modale branded suppression deck */}
      {showDeleteModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{ background: '#1a1520', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 14, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F0F7', marginBottom: 8, fontFamily: 'Poppins, sans-serif' }}>
              Supprimer « {deck?.title || 'ce deck'} » ?
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontFamily: 'Poppins, sans-serif', lineHeight: 1.5 }}>
              Cette action est irréversible. Toutes les slides seront supprimées définitivement.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteCountdown > 0}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: deleteCountdown > 0 ? 'rgba(255,80,80,0.3)' : '#ff4040', color: deleteCountdown > 0 ? 'rgba(255,255,255,0.4)' : '#fff', fontSize: 13, fontWeight: 700, cursor: deleteCountdown > 0 ? 'not-allowed' : 'pointer', fontFamily: 'Poppins, sans-serif', transition: 'all 0.2s' }}
              >
                {deleteCountdown > 0 ? `Supprimer (${deleteCountdown}s)` : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DB-45 — Cheat sheet raccourcis clavier */}
      <KeyboardShortcutsModal
        open={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* DB-30 — Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'Poppins, sans-serif',
            background: t.type === 'success' ? 'rgba(74,222,128,0.15)' : t.type === 'error' ? 'rgba(255,107,107,0.15)' : 'rgba(251,191,36,0.15)',
            border: `1px solid ${t.type === 'success' ? 'rgba(74,222,128,0.4)' : t.type === 'error' ? 'rgba(255,107,107,0.4)' : 'rgba(251,191,36,0.4)'}`,
            color: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#ff6b6b' : '#fbbf24',
            backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'slide-in-up 0.3s ease',
          }}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : '!'} {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TemplateSwapModal ─────────────────────────────────────────────────────────

function TemplateSwapModal({
  templates,
  currentThemeJson,
  selectedTemplate,
  onSelectTemplate,
  onApply,
  onClose,
}: {
  templates: TemplateRecord[]
  currentThemeJson: string | null
  selectedTemplate: TemplateRecord | null
  onSelectTemplate: (t: TemplateRecord | null) => void
  onApply: (t: TemplateRecord) => void
  onClose: () => void
}) {
  const currentPreset = currentThemeJson ? (() => {
    try { return (JSON.parse(currentThemeJson) as Record<string, string>).preset || '' } catch { return '' }
  })() : ''

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Modal */}
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        style={{
          background: '#1E1B21', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 18, padding: 24, width: 'min(90vw, 640px)',
          maxHeight: '85vh', overflow: 'auto',
          fontFamily: 'Poppins, sans-serif', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F5F0F7', margin: 0 }}>Changer de template</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0 0' }}>Le contenu de vos slides sera préservé</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            Chargement des templates...
          </div>
        ) : (
          <>
            {/* Template grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {templates.map(tpl => {
                const tc = tpl.theme_config
                const bgColor = (tc.bgColor as string) || '#0B090D'
                const accentGradient = (tc.accentGradient as string) || 'linear-gradient(135deg, #E11F7B, #7C3AED)'
                const isCurrent = currentPreset === ((tc.preset as string) || '')
                const isSelected = selectedTemplate?.id === tpl.id

                return (
                  <button
                    key={tpl.id}
                    onClick={() => onSelectTemplate(isSelected ? null : tpl)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
                      border: isSelected ? '2px solid #E11F7B' : isCurrent ? '2px solid rgba(225,31,123,0.4)' : '2px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.03)',
                      transition: 'border-color 0.15s, transform 0.1s',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    {/* DB-41 — Preview swatch 90×60 */}
                    <div style={{
                      height: 60, minHeight: 60, background: bgColor, position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{ position: 'absolute', inset: 0, background: accentGradient === 'none' ? 'transparent' : accentGradient, opacity: 0.3 }} />
                      {isCurrent && (
                        <div style={{ position: 'absolute', top: 4, right: 4, background: '#E11F7B', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4 }}>
                          ACTIF
                        </div>
                      )}
                    </div>
                    {/* Name */}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#F5F0F7' }}>{tpl.name}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => selectedTemplate && onApply(selectedTemplate)}
                disabled={!selectedTemplate}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: selectedTemplate ? 'linear-gradient(135deg, #E11F7B, #c41a6a)' : 'rgba(255,255,255,0.06)',
                  color: selectedTemplate ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 700,
                  cursor: selectedTemplate ? 'pointer' : 'not-allowed', fontFamily: 'Poppins, sans-serif',
                  boxShadow: selectedTemplate ? '0 4px 16px rgba(225,31,123,0.35)' : 'none',
                }}
              >
                Appliquer ce template ✓
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ── DA Presets (DB-08) ────────────────────────────────────────────────────────

const DA_PRESETS = [
  {
    id: 'editorial' as const,
    label: 'La Revue',
    tagline: 'Magazine · Prestige · Autorité',
    preview: { bg: '#F5F2EC', accent: '#C1372A' },
    theme: {
      preset: 'EDITORIAL',
      bgColor: '#F5F2EC',
      accentColor: '#C1372A',
      secondaryAccent: '#8B6914',
      textColor: '#1A1614',
      textPrimary: '#1A1614',
      textSecondary: '#6B6560',
      fontFamily: 'Inter' as const,
      bgAnimation: 'none' as const,
      noiseEnabled: false,
      glowEffect: false,
      gradientText: false,
      da: 'editorial' as const,
    },
  },
  {
    id: 'neon' as const,
    label: 'Voltage',
    tagline: 'Cyberpunk · Énergie · Nuit',
    preview: { bg: '#060612', accent: '#FF2D78' },
    theme: {
      preset: 'NEON_TOKYO',
      bgColor: '#060612',
      accentColor: '#FF2D78',
      secondaryAccent: '#00F5D4',
      textColor: '#E8E8FF',
      fontFamily: 'Space Grotesk' as const,
      bgAnimation: 'particles' as const,
      glowEffect: true,
      gradientText: true,
      noiseEnabled: false,
      da: 'neon' as const,
    },
  },
  {
    id: 'soft' as const,
    label: 'Pearl',
    tagline: 'SaaS modern · Clean · Confiant',
    preview: { bg: '#FAFAFA', accent: '#6C47FF' },
    theme: {
      preset: 'SOFT_LIGHT',
      bgColor: '#FAFAFA',
      accentColor: '#6C47FF',
      secondaryAccent: '#FF6B35',
      textColor: '#111118',
      fontFamily: 'DM Sans' as const,
      bgAnimation: 'none' as const,
      glowEffect: false,
      gradientText: false,
      noiseEnabled: false,
      da: 'soft' as const,
    },
  },
  {
    id: 'terminal' as const,
    label: 'Syntax',
    tagline: 'Dev tool · Épuré · Technique',
    preview: { bg: '#0D1117', accent: '#3FB950' },
    theme: {
      preset: 'TERMINAL',
      bgColor: '#0D1117',
      accentColor: '#3FB950',
      secondaryAccent: '#58A6FF',
      textColor: '#E6EDF3',
      fontFamily: 'Inter' as const,
      bgAnimation: 'matrix' as const,
      glowEffect: false,
      gradientText: false,
      noiseEnabled: true,
      noiseOpacity: 0.04,
      da: 'terminal' as const,
    },
  },
]


// ── DB-47 — StylePanelInline ──────────────────────────────────────────────────

function StylePanelInline({
  themeJSON,
  onUpdate,
}: {
  themeJSON: DeckThemeJSON
  onUpdate: (updates: Partial<DeckThemeJSON>) => Promise<void>
}) {
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 8, marginTop: 16,
  }
  const colorRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
  }
  const colorSwatch: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: '2px solid rgba(255,255,255,0.15)',
    cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden',
  }
  const hexLabel: React.CSSProperties = {
    fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace',
  }

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
    background: active ? 'linear-gradient(90deg, #E11F7B, #7C3AED)' : 'rgba(255,255,255,0.1)',
    border: 'none', flexShrink: 0, transition: 'background 0.2s',
  })

  const fontSizes: FontSize[] = ['sm', 'md', 'lg', 'xl']
  const fontSizeLabels: Record<FontSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }
  const transitions: SlideTransition[] = ['fade', 'slide-up', 'scale']
  const transitionLabels: Record<SlideTransition, string> = { fade: 'Fondu', 'slide-up': 'Slide↑', scale: 'Scale' }

  const segBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600, fontFamily: 'Poppins, sans-serif',
    background: active ? 'rgba(225,31,123,0.2)' : 'rgba(255,255,255,0.04)',
    color: active ? '#E11F7B' : 'rgba(255,255,255,0.4)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ padding: '12px 16px', fontFamily: 'Poppins, sans-serif', overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>

      {/* DB-08 — Directions artistiques */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ ...sectionTitle, marginTop: 4 }}>Direction artistique</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => onUpdate({
              da: undefined,
              bgColor: '#0B090D',
              accentColor: '#E11F7B',
              secondaryAccent: '#7C3AED',
              textColor: '#F5F0F7',
              textPrimary: '#F5F0F7',
              textSecondary: '#9B92A0',
              fontFamily: 'Poppins' as const,
              bgAnimation: undefined,
              glowEffect: true,
              gradientText: true,
              noiseEnabled: false,
            }).then(() => {})}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
              background: !themeJSON?.da ? 'rgba(225,31,123,0.12)' : 'rgba(255,255,255,0.03)',
              border: !themeJSON?.da ? '1px solid rgba(225,31,123,0.3)' : '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'Poppins, sans-serif',
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 4, background: '#0B090D', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Orion Dark</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Défaut · Cosmique</div>
            </div>
          </button>
          {DA_PRESETS.map(da => (
            <button
              key={da.id}
              onClick={() => onUpdate({ ...da.theme }).then(() => {})}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                background: themeJSON?.da === da.id ? 'rgba(225,31,123,0.12)' : 'rgba(255,255,255,0.03)',
                border: themeJSON?.da === da.id ? '1px solid rgba(225,31,123,0.3)' : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'Poppins, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 4, background: da.preview.bg, border: `2px solid ${da.preview.accent}`, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{da.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{da.tagline}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Langue */}
      <p style={sectionTitle}>Langue</p>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['Français', 'English'] as const).map(lang => (
          <button
            key={lang}
            onClick={() => onUpdate({ lang }).then(() => {})}
            style={segBtnStyle((themeJSON.lang || 'Français') === lang)}
          >
            {lang === 'Français' ? '🇫🇷 FR' : '🇬🇧 EN'}
          </button>
        ))}
      </div>

      {/* Police */}
      <p style={sectionTitle}>Police</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {(['Poppins', 'Inter', 'DM Sans', 'Space Grotesk', 'Syne'] as const).map(font => (
          <button
            key={font}
            onClick={() => onUpdate({ fontFamily: font }).then(() => {})}
            style={{
              padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, fontFamily: font,
              background: (themeJSON.fontFamily || 'Poppins') === font ? 'rgba(225,31,123,0.2)' : 'rgba(255,255,255,0.05)',
              color: (themeJSON.fontFamily || 'Poppins') === font ? '#E11F7B' : 'rgba(255,255,255,0.5)',
            }}
          >
            {font}
          </button>
        ))}
      </div>

      {/* Accent color */}
      <p style={sectionTitle}>Couleur d&apos;accent</p>
      <div style={colorRow}>
        <div style={{ ...colorSwatch, background: themeJSON.accentColor || '#E11F7B' }}>
          <input
            type="color"
            value={themeJSON.accentColor || '#E11F7B'}
            onChange={e => {
              const c = e.target.value
              onUpdate({
                accentColor: c,
                accentGradient: `linear-gradient(135deg, ${c}, #7C3AED)`,
              }).then(() => {})
            }}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </div>
        <span style={hexLabel}>{themeJSON.accentColor || '#E11F7B'}</span>
      </div>

      {/* Background color */}
      <p style={sectionTitle}>Fond personnalisé</p>
      <div style={colorRow}>
        <div style={{ ...colorSwatch, background: themeJSON.bgColor || '#06040A' }}>
          <input
            type="color"
            value={themeJSON.bgColor || '#06040A'}
            onChange={e => onUpdate({ bgColor: e.target.value }).then(() => {})}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </div>
        <span style={hexLabel}>{themeJSON.bgColor || '#06040A'}</span>
      </div>

      {/* Toggles */}
      <p style={sectionTitle}>Effets visuels</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Gradient texte</span>
          <button
            onClick={() => onUpdate({ gradientText: !themeJSON.gradientText }).then(() => {})}
            style={toggleStyle(themeJSON.gradientText !== false)}
          >
            <div style={{
              position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
              left: themeJSON.gradientText !== false ? 21 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Glow atmosphérique</span>
          <button
            onClick={() => onUpdate({ glowEffect: !themeJSON.glowEffect }).then(() => {})}
            style={toggleStyle(themeJSON.glowEffect !== false)}
          >
            <div style={{
              position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
              left: themeJSON.glowEffect !== false ? 21 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* Font size */}
      <p style={sectionTitle}>Taille typo</p>
      <div style={{ display: 'flex', gap: 4 }}>
        {fontSizes.map(fs => (
          <button
            key={fs}
            onClick={() => onUpdate({ fontSize: fs }).then(() => {})}
            style={segBtnStyle(themeJSON.fontSize === fs || (!themeJSON.fontSize && fs === 'md'))}
          >
            {fontSizeLabels[fs]}
          </button>
        ))}
      </div>

      {/* Transition */}
      <p style={sectionTitle}>Transition slides</p>
      <div style={{ display: 'flex', gap: 4 }}>
        {transitions.map(t => (
          <button
            key={t}
            onClick={() => onUpdate({ transition: t }).then(() => {})}
            style={segBtnStyle(themeJSON.transition === t || (!themeJSON.transition && t === 'slide-up'))}
          >
            {transitionLabels[t]}
          </button>
        ))}
      </div>

      {/* Accent secondaire */}
      <p style={sectionTitle}>Accent secondaire</p>
      <div style={colorRow}>
        <div style={{ ...colorSwatch, background: themeJSON.secondaryAccent || '#7C3AED' }}>
          <input
            type="color"
            value={themeJSON.secondaryAccent || '#7C3AED'}
            onChange={e => onUpdate({ secondaryAccent: e.target.value }).then(() => {})}
            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </div>
        <span style={hexLabel}>{themeJSON.secondaryAccent || '#7C3AED'}</span>
        <button
          onClick={() => onUpdate({ secondaryAccent: undefined }).then(() => {})}
          style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}
        >
          Reset
        </button>
      </div>

      {/* Couleur texte */}
      <p style={sectionTitle}>Couleur texte</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Principal</div>
          <div style={{ ...colorSwatch, width: '100%', height: 28 }}>
            <input
              type="color"
              value={themeJSON.textPrimary || '#F5F0F7'}
              onChange={e => onUpdate({ textPrimary: e.target.value }).then(() => {})}
              style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
            />
            <div style={{ width: '100%', height: '100%', background: themeJSON.textPrimary || '#F5F0F7', borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>Secondaire</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ ...colorSwatch, flex: 1, height: 28 }}>
              <input
                type="color"
                value={themeJSON.textSecondary && themeJSON.textSecondary !== 'auto' ? themeJSON.textSecondary : '#9B92A0'}
                onChange={e => onUpdate({ textSecondary: e.target.value }).then(() => {})}
                style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
              <div style={{ width: '100%', height: '100%', background: themeJSON.textSecondary && themeJSON.textSecondary !== 'auto' ? themeJSON.textSecondary : '#9B92A0', borderRadius: 4 }} />
            </div>
            <button
              onClick={() => onUpdate({ textSecondary: themeJSON.textSecondary === 'auto' ? undefined : 'auto' }).then(() => {})}
              style={{
                padding: '0 6px', height: 28, borderRadius: 6, fontSize: 10, cursor: 'pointer',
                background: themeJSON.textSecondary === 'auto' ? '#E11F7B' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#fff', flexShrink: 0,
              }}
            >🔗</button>
          </div>
        </div>
      </div>

      {/* Grain texture */}
      <p style={sectionTitle}>Texture</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => onUpdate({ noiseEnabled: !themeJSON.noiseEnabled }).then(() => {})}
          style={toggleStyle(!!themeJSON.noiseEnabled)}
        >
          <div style={{
            position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
            left: themeJSON.noiseEnabled ? 21 : 3,
            transition: 'left 0.2s',
          }} />
        </button>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Grain noise</span>
      </div>
      {themeJSON.noiseEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>Opacité: {Math.round((themeJSON.noiseOpacity ?? 0.08) * 100)}%</span>
          <input
            type="range" min={0} max={0.15} step={0.01}
            value={themeJSON.noiseOpacity ?? 0.08}
            onChange={e => onUpdate({ noiseOpacity: parseFloat(e.target.value) }).then(() => {})}
            style={{ flex: 1 }}
          />
        </div>
      )}

      {/* Décalage animation */}
      <p style={sectionTitle}>Décalage animation</p>
      <div style={{ display: 'flex', gap: 4 }}>
        {([0, 50, 100, 200] as const).map(val => (
          <button
            key={val}
            onClick={() => onUpdate({ animationStagger: val }).then(() => {})}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: themeJSON.animationStagger === val ? '#E11F7B' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${themeJSON.animationStagger === val ? '#E11F7B' : 'rgba(255,255,255,0.1)'}`,
              color: themeJSON.animationStagger === val ? '#fff' : 'rgba(255,255,255,0.5)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {val === 0 ? 'Aucun' : `${val}ms`}
          </button>
        ))}
      </div>

      {/* Fond animé */}
      <p style={sectionTitle}>Fond animé</p>
      {(() => {
        const BG_OPTIONS: Array<{ id: BgType; label: string; emoji: string; desc: string }> = [
          { id: 'galaxy',    emoji: '🌌', label: 'Galaxie',     desc: 'Étoiles + nébuleuses' },
          { id: 'particles', emoji: '✦',  label: 'Particules',  desc: 'Réseau de points' },
          { id: 'aurora',    emoji: '🌈', label: 'Aurore',      desc: 'Bandes colorées' },
          { id: 'matrix',    emoji: '💻', label: 'Matrix',      desc: 'Pluie de code' },
          { id: 'bokeh',     emoji: '💫', label: 'Bokeh',       desc: 'Lumières floues' },
          { id: 'geometric', emoji: '⬡',  label: 'Géomét.',     desc: 'Formes flottantes' },
          { id: 'waves',     emoji: '🌊', label: 'Vagues',      desc: 'Ondulations' },
          { id: 'none',      emoji: '◻',  label: 'Aucun',       desc: 'Fond uni' },
        ]
        const currentBg: BgType = (themeJSON.bgAnimation as BgType) ?? 'galaxy'
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
            {BG_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => onUpdate({ bgAnimation: opt.id }).then(() => {})}
                title={opt.desc}
                style={{
                  padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: currentBg === opt.id ? 'rgba(225,31,123,0.15)' : 'rgba(255,255,255,0.05)',
                  outline: currentBg === opt.id ? '1.5px solid #E11F7B' : '1.5px solid transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  fontFamily: 'Poppins, sans-serif', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: currentBg === opt.id ? '#E11F7B' : 'rgba(255,255,255,0.5)' }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ── SaveTemplateModal ─────────────────────────────────────────────────────────

function SaveTemplateModal({
  deck,
  slides,
  onClose,
}: {
  deck: { id: string; title: string; theme_json: string | null }
  slides: SlideData[]
  onClose: () => void
}) {
  const [name, setName] = useState(deck.title)
  const [mode, setMode] = useState<'structure' | 'content'>('structure')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    let themeConfig: Record<string, unknown> = {}
    if (deck.theme_json) {
      try { themeConfig = JSON.parse(deck.theme_json) as Record<string, unknown> } catch { /* */ }
    }

    const slideStructure = slides.map((s, i) => {
      const item: Record<string, unknown> = { type: s.type, position: i }
      if (mode === 'content') item.content = s.content
      return item
    })

    await supabase.from('templates').insert({
      name,
      theme_config: themeConfig,
      slide_structure: slideStructure,
      source: 'deck',
      source_ref: deck.id,
      is_system: false,
    }).then(() => {})

    setSaving(false)
    setSaved(true)
    setTimeout(() => { onClose() }, 1500)
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)', color: '#F5F0F7',
    fontSize: 13, fontFamily: 'Poppins, sans-serif', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Modal */}
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: '#2C272F',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: 24, width: 380,
          maxHeight: '85vh', overflow: 'auto',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutTemplate size={16} color="#E11F7B" />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F5F0F7', margin: 0 }}>
              Sauvegarder en template
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nom du template
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={fieldStyle}
            maxLength={80}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Que sauvegarder ?
          </label>
          {[
            { key: 'structure', label: 'Structure uniquement', sub: 'Types et ordre des slides (recommandé)' },
            { key: 'content', label: 'Structure + contenu', sub: 'Inclut aussi le texte de chaque slide' },
          ].map(opt => (
            <label
              key={opt.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px', borderRadius: 8, marginBottom: 6,
                background: mode === opt.key ? 'rgba(225,31,123,0.08)' : 'rgba(255,255,255,0.03)',
                border: mode === opt.key ? '1px solid rgba(225,31,123,0.25)' : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="mode"
                value={opt.key}
                checked={mode === opt.key}
                onChange={() => setMode(opt.key as 'structure' | 'content')}
                style={{ marginTop: 2, accentColor: '#E11F7B' }}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F0F7' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>

        {saved ? (
          <div style={{ textAlign: 'center', padding: '12px', color: '#10B981', fontWeight: 600, fontSize: 13 }}>
            ✅ Template sauvegardé ! Voir dans /templates
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'none',
                color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                background: saving || !name.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                color: saving || !name.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: 13, fontWeight: 700,
                cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder ✓'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

const topbarBtnStyle = (accent: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 7, border: 'none',
  background: accent ? 'linear-gradient(135deg, #E11F7B, #c41a6a)' : 'rgba(255,255,255,0.06)',
  color: accent ? '#fff' : 'rgba(255,255,255,0.5)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Poppins, sans-serif',
  boxShadow: accent ? '0 2px 12px rgba(225,31,123,0.3)' : 'none',
  transition: 'opacity 0.15s',
})

const navBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
  cursor: 'pointer',
}

export default DeckEditorPage
