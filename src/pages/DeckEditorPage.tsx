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
  ChevronLeft, ChevronRight, Plus, Maximize2, Eye, Globe, EyeOff,
  RefreshCw, ArrowUp, ArrowDown, Trash2, Save, Download, Loader2, LayoutTemplate, X, Sparkles,
  Image as ImageIcon, BarChart2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SlideRenderer } from '../components/deck/SlideRenderer'
import { AnimatedBackground } from '../components/deck/AnimatedBackground'
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

// ── PropsPanel ────────────────────────────────────────────────────────────────

function PropsPanel({
  slide,
  deckTitle,
  themeJSON,
  onUpdate,
  onRegenerate,
  onChangeType,
}: {
  slide: SlideData
  deckTitle: string
  themeJSON: DeckThemeJSON
  onUpdate: (content: SlideContent) => void
  onRegenerate: () => void
  onChangeType?: (newType: SlideType) => void
}) {
  const [regenerating, setRegenerating] = useState(false)
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
    <div style={{ padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 12,
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

      {/* TK-0110 — Type selector */}
      {onChangeType && (
        <div style={{ marginBottom: 16 }}>
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

      {/* DB-16 — Champs texte supprimés : édition inline sur le canvas */}
      {/* Garder uniquement les contrôles structurels (ajouter/supprimer items) */}

      {(SlideType === 'content') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={fieldLabel}>Points clés ({(content.bullets || []).length})</label>
          </div>
          {(content.bullets || []).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Point {i + 1}</span>
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
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{m.value || '—'}</span>
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
                <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Point {i + 1}</span>
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

      {/* Features — gestion items */}
      {(SlideType === 'features') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Features ({((content as any).features || []).length})</label>
          {((content as any).features || []).map((_: unknown, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Feature {i + 1}</span>
              <button
                onClick={() => {
                  const features = ((content as any).features || []).filter((_: unknown, j: number) => j !== i)
                  onUpdate({ ...content, features } as SlideContent)
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
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
          {((content as any).tiers || []).map((_: unknown, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Tier {i + 1}</span>
              <button
                onClick={() => {
                  const tiers = ((content as any).tiers || []).filter((_: unknown, j: number) => j !== i)
                  onUpdate({ ...content, tiers } as SlideContent)
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, tiers: [...((content as any).tiers || []), { name: 'Nouveau tier', price: '—', per: '/mois', desc: '', features: [], featured: false }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Ajouter</button>
        </div>
      )}

      {/* Team — gestion membres */}
      {(SlideType === 'team') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Membres ({((content as any).members || []).length})</label>
          {((content as any).members || []).map((_: unknown, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Membre {i + 1}</span>
              <button
                onClick={() => {
                  const members = ((content as any).members || []).filter((_: unknown, j: number) => j !== i)
                  onUpdate({ ...content, members } as SlideContent)
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ ...content, members: [...((content as any).members || []), { initial: 'N', name: 'Prénom Nom', role: 'Rôle', bio: '' }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Ajouter</button>
        </div>
      )}

      {/* Roadmap — gestion phases */}
      {(SlideType === 'roadmap') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Phases ({((content as any).phases || []).length})</label>
          {((content as any).phases || []).map((p: { quarter?: string; title?: string; current?: boolean; status?: string }, i: number) => {
            const STATUS_COLORS: Record<string, string> = { done: '#22C55E', 'in-progress': '#E11F7B', planned: 'rgba(255,255,255,0.3)' }
            const status = p.status || (p.current ? 'in-progress' : 'planned')
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
          <button
            onClick={() => onUpdate({ ...content, phases: [...((content as any).phases || []), { quarter: 'Q?', title: 'Nouvelle phase', items: [], status: 'planned', current: false }] } as SlideContent)}
            style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}
          >+ Ajouter</button>
        </div>
      )}

      {/* Market — gestion cercles TAM/SAM/SOM */}
      {(SlideType === 'market') && (
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Cercles ({((content as any).bars || []).length}/3 max)</label>
          {((content as any).bars || []).map((b: { label?: string; color?: string }, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
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
          {/* Nodes */}
          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Nodes ({((content as any).nodes || []).length})</label>
            {((content as any).nodes || []).map((_: unknown, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Node {i + 1}</span>
                <button onClick={() => { const nodes = ((content as any).nodes || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, nodes } as SlideContent) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
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
            {((content as any).cards || []).map((_: unknown, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Card {i + 1}</span>
                <button onClick={() => { const cards = ((content as any).cards || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, cards } as SlideContent) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
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
            {((content as any).agents || []).map((_: unknown, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', marginBottom: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Poppins, sans-serif' }}>Agent {i + 1}</span>
                <button onClick={() => { const agents = ((content as any).agents || []).filter((_: unknown, j: number) => j !== i); onUpdate({ ...content, agents } as SlideContent) }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.5)', cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={() => onUpdate({ ...content, agents: [...((content as any).agents || []), { name: 'Nouvel agent', role: '', color: '#E11F7B' }] } as SlideContent)}
              style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, cursor: 'pointer', padding: '4px 8px', width: '100%', marginTop: 4, fontFamily: 'Poppins, sans-serif' }}>
              + Ajouter un agent
            </button>
          </div>
        </>
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
      </div>
    </div>
  )
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

  return (
    <div
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
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
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
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templatesList, setTemplatesList] = useState<TemplateRecord[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null)
  const [previousThemeJson, setPreviousThemeJson] = useState<string | null>(null)
  const [undoToast, setUndoToast] = useState(false)
  const [mobileTab, setMobileTab] = useState<'slides' | 'canvas' | 'props'>('canvas')
  const [showAddSlideModal, setShowAddSlideModal] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── Inline edit state ──────────────────────────────────────────────────────
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

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

  // Escape → déselectionne le champ en édition
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedFieldId(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true)
      await supabase
        .from('slides')
        .update({ content_json: content })
        .eq('id', slideId)
      setSaving(false)
    }, 1000)
  }, [])

  function updateSlideContent(content: SlideContent) {
    if (!activeSlide) return
    const updated = slides.map((s, i) =>
      i === activeIdx ? { ...s, content } : s
    )
    setSlides(updated)
    autoSave(activeSlide.id, content)
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

  async function deleteSlide(idx: number) {
    if (slides.length <= 1) return
    const slide = slides[idx]
    await supabase.from('slides').delete().eq('id', slide.id)
    const updated = slides.filter((_, i) => i !== idx)
    updated.forEach((s, i) => { s.position = i + 1 })
    setSlides(updated)
    setActiveIdx(Math.min(activeIdx, updated.length - 1))
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
        setDeck(d => d ? { ...d, status: 'published' } : d)
      }
    } catch (err) {
      console.error('[DeckEditorPage] publish error:', err)
      alert('Erreur lors de la publication: ' + (err instanceof Error ? err.message : 'Inconnu'))
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
    if (!window.confirm('Supprimer ce deck définitivement ? Cette action est irréversible.')) return
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0B090D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#F5F0F7', fontFamily: 'Poppins, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>Chargement de l&apos;éditeur...</p>
        </div>
      </div>
    )
  }

  return (
    <div data-theme={theme.toUpperCase().replace('_', '_')} className="deck-editor" style={{ fontFamily: 'Poppins, sans-serif' }}>

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

          {saving && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              <Save size={11} style={{ display: 'inline', marginRight: 4 }} />
              Sauvegarde...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Slide counter */}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {activeIdx + 1} / {slides.length}
          </span>

          {/* Style panel */}
          <button
            onClick={() => setShowStylePanel(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7,
              border: showStylePanel ? '1px solid rgba(225,31,123,0.5)' : '1px solid rgba(255,255,255,0.12)',
              background: showStylePanel ? 'rgba(225,31,123,0.12)' : 'rgba(255,255,255,0.05)',
              color: showStylePanel ? '#E11F7B' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              transition: 'all 0.15s',
            }}
            title="Style visuel"
          >
            <Sparkles size={13} />
            Style
          </button>

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

          {/* Save as template */}
          <button
            onClick={() => setShowSaveTemplate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
            title="Sauvegarder en template"
          >
            <LayoutTemplate size={13} />
            Sauver
          </button>

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

          <button
            onClick={handleDelete}
            title="Supprimer ce deck"
            style={{ ...topbarBtnStyle(false), color: '#EF4444', borderColor: 'rgba(239,68,68,0.2)' }}
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        </div>
      </div>

      {/* ── Slides panel ────────────────────────────────────────────────────── */}
      <div className={`deck-slides${mobileTab === 'slides' ? ' mobile-active' : ''}`}>
        <AnimatePresence>
          {slides.map((slide, i) => (
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <SlideThumbnail
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
            </motion.div>
          ))}
        </AnimatePresence>

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
            {/* Inline edit hint */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', marginBottom: 0 }}>
              <span style={{ fontSize: 11, color: 'rgba(225,31,123,0.55)' }}>
                ✏️ Cliquez sur un champ pour éditer • Escape pour désélectionner
              </span>
            </div>
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
                  <SlideRenderer
                    slide={activeSlide}
                    theme={theme}
                    themeJSON={themeJSON}
                    editMode={true}
                    selectedFieldId={selectedFieldId}
                    onFieldSelect={handleFieldSelect}
                    onFieldSave={handleFieldSave}
                    onImageClick={handleImageClick}
                    onRemoveItem={handleRemoveItem}
                    onAddItem={handleAddItem}
                    onReorderItems={handleReorderItems}
                    onUpdateFontSize={handleUpdateFontSize}
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
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
            <p>Aucune slide sélectionnée</p>
          </div>
        )}
      </div>

      {/* ── Props panel ─────────────────────────────────────────────────────── */}
      <div className={`deck-props${mobileTab === 'props' ? ' mobile-active' : ''}`} style={{ padding: 0 }}>
        {activeSlide ? (
          <PropsPanel
            slide={activeSlide}
            deckTitle={deck?.title || ''}
            themeJSON={themeJSON}
            onUpdate={updateSlideContent}
            onRegenerate={() => { /* trigger refresh */ }}
            onChangeType={updateSlideType}
          />
        ) : (
          <div style={{ padding: 16, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            Sélectionnez une slide pour éditer ses propriétés.
          </div>
        )}
      </div>

      {/* ── Style Panel ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStylePanel && (
          <StylePanel
            themeJSON={themeJSON}
            onUpdate={updateThemeJSON}
            onClose={() => setShowStylePanel(false)}
          />
        )}
      </AnimatePresence>

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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, backdropFilter: 'blur(8px)' }} />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 501,
          background: '#1E1B21', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 18, padding: 24, width: 'min(90vw, 640px)',
          maxHeight: '80vh', overflow: 'auto',
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
                    {/* Preview swatch */}
                    <div style={{
                      height: 52, background: bgColor, position: 'relative', overflow: 'hidden',
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
    </>
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

// ── StylePanel ────────────────────────────────────────────────────────────────

function StylePanel({
  themeJSON,
  onUpdate,
  onClose,
}: {
  themeJSON: DeckThemeJSON
  onUpdate: (updates: Partial<DeckThemeJSON>) => Promise<void>
  onClose: () => void
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
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', top: 56, right: 280, zIndex: 300,
        background: '#1E1B21', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14, padding: '16px 18px', width: 260,
        fontFamily: 'Poppins, sans-serif', boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        maxHeight: 'calc(100vh - 72px)', overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={14} color="#E11F7B" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F0F7' }}>Style visuel</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* DB-08 — Directions artistiques */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ ...sectionTitle, marginTop: 4 }}>Direction artistique</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Bouton reset DA — DB-19 : remet les vraies valeurs Orion Dark */}
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

      {/* FIX I3 — Sélecteur de langue */}
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

      {/* FIX H3 — Sélecteur de police */}
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
            style={{
              opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer',
            }}
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
            title="Toggle gradient text"
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
            title="Toggle glow"
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

      {/* ── Sprint 3 — Accent secondaire ──────────────────────────────── */}
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

      {/* ── Sprint 3 — Couleur texte ───────────────────────────────────── */}
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
              title="Auto = 50% du texte principal"
              style={{
                padding: '0 6px', height: 28, borderRadius: 6, fontSize: 10, cursor: 'pointer',
                background: themeJSON.textSecondary === 'auto' ? '#E11F7B' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#fff', flexShrink: 0,
              }}
            >🔗</button>
          </div>
        </div>
      </div>

      {/* ── Sprint 3 — Grain texture ───────────────────────────────────── */}
      <p style={sectionTitle}>Texture</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => onUpdate({ noiseEnabled: !themeJSON.noiseEnabled }).then(() => {})}
          style={toggleStyle(!!themeJSON.noiseEnabled)}
          title="Toggle grain texture"
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

      {/* ── Sprint 3 — Stagger animation ──────────────────────────────── */}
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

      {/* ── Sprint 4 — Fond animé ─────────────────────────────────────── */}
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
    </motion.div>
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
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 200, backdropFilter: 'blur(4px)',
        }}
      />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          background: '#2C272F',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: 24, width: 380,
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
    </>
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
