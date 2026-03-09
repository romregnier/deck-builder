/**
 * NewDeckPage.tsx — Formulaire création multi-step
 * TK-0031
 *
 * Formulaire 3 steps:
 * 1. Brief (titre, description, audience, tonalité)
 * 2. Style (thème, nb slides, langue)
 * 3. Confirmation + génération IA
 */
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sparkles, Check, ArrowUp, ArrowDown, Trash2, Plus, Loader2, Paperclip, MessageSquare, Globe } from 'lucide-react'
import { generateDeck, generateOutline, type GenerationProgress, type SlideOutline } from '../lib/deckGenerator'
import { extractDAFromPDF, extractFullPresentation, type ExtractedDA, type ExtractedSlide } from '../lib/pdfAnalyzer'
import { analyzeURL, type URLAnalysisResult } from '../lib/urlAnalyzer'
import { importDeck } from '../lib/deckGenerator'
import { supabase } from '../lib/supabase'
import type { DeckBrief, DeckAudience, DeckTonality, DeckTheme, DeckLang, SlideType, DeckTemplate } from '../types/deck'

// ── Theme Card ────────────────────────────────────────────────────────────────

const THEMES: { id: DeckTheme; label: string; preview: string; desc: string }[] = [
  {
    id: 'dark_premium',
    label: 'Dark Premium',
    preview: 'linear-gradient(135deg, #0B090D 0%, #2C272F 100%)',
    desc: 'Élégant, mystérieux, haut de gamme',
  },
  {
    id: 'light_clean',
    label: 'Light Clean',
    preview: 'linear-gradient(135deg, #F7F5F9 0%, #EDEBEF 100%)',
    desc: 'Propre, minimaliste, professionnel',
  },
  {
    id: 'gradient_bold',
    label: 'Gradient Bold',
    preview: 'linear-gradient(135deg, #1A0A2E 0%, #3D1568 50%, #0D1A3A 100%)',
    desc: 'Audacieux, dynamique, créatif',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    preview: 'linear-gradient(135deg, #F0F2F5 0%, #E4E7EC 100%)',
    desc: 'Classique, sobre, institutionnel',
  },
]

const AUDIENCES: DeckAudience[] = ['Investisseur', 'Partenaire', 'Équipe', 'Client', 'Public']
const TONALITIES: DeckTonality[] = ['Formel', 'Neutre', 'Dynamique', 'Inspirant']
const LANGS: DeckLang[] = ['Français', 'English']

// ── Input styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: '#F5F0F7',
  fontSize: 14,
  fontFamily: 'Poppins, sans-serif',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  marginBottom: 8,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

// ── Step 1: Brief ─────────────────────────────────────────────────────────────

function StepBrief({
  data,
  onChange,
  onImport,
  onUrlImport,
}: {
  data: Partial<DeckBrief>
  onChange: (partial: Partial<DeckBrief>) => void
  onImport?: (slides: ExtractedSlide[], da: ExtractedDA) => void
  onUrlImport?: (result: URLAnalysisResult) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [importMode, setImportMode] = useState<'da' | 'full'>('da')
  const [extractedDA, setExtractedDA] = useState<ExtractedDA | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [daApplied, setDaApplied] = useState(false)

  // ── URL states ──
  const [urlInput, setUrlInput] = useState('')
  const [urlAnalyzing, setUrlAnalyzing] = useState(false)
  const [urlResult, setUrlResult] = useState<URLAnalysisResult | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlApplied, setUrlApplied] = useState(false)

  async function handleAnalyzePDF() {
    if (!pdfFile) return
    setAnalyzing(true)
    setPdfError(null)
    setExtractedDA(null)
    setDaApplied(false)
    try {
      if (importMode === 'full') {
        const result = await extractFullPresentation(pdfFile)
        onChange({ theme: result.da.theme, accentColor: result.da.primaryColor })
        onImport?.(result.slides, result.da)
      } else {
        const da = await extractDAFromPDF(pdfFile)
        setExtractedDA(da)
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse du PDF')
    }
    setAnalyzing(false)
  }

  function handleApplyDA() {
    if (!extractedDA) return
    onChange({ theme: extractedDA.theme, accentColor: extractedDA.primaryColor })
    setDaApplied(true)
  }

  async function handleAnalyzeURL() {
    if (!urlInput.trim()) return
    setUrlAnalyzing(true)
    setUrlError(null)
    setUrlResult(null)
    setUrlApplied(false)
    try {
      const result = await analyzeURL(urlInput)
      setUrlResult(result)
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Erreur lors de l'analyse")
    }
    setUrlAnalyzing(false)
  }

  function handleApplyURL() {
    if (!urlResult) return
    onChange({
      title: urlResult.title,
      description: urlResult.description,
      audience: urlResult.audience,
      tonality: urlResult.tonality,
      theme: urlResult.theme,
    })
    onUrlImport?.(urlResult)
    setUrlApplied(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <label style={labelStyle}>Titre *</label>
        <input
          type="text"
          value={data.title || ''}
          onChange={e => onChange({ title: e.target.value })}
          placeholder="Ex: Pitch Investisseur — Série A"
          style={inputStyle}
          minLength={3}
          maxLength={80}
        />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
          {(data.title || '').length}/80 caractères (min. 3)
        </div>
      </div>

      <div>
        <label style={labelStyle}>Description / Sujet *</label>
        <textarea
          value={data.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Décrivez le contenu de votre présentation en détail. Plus c'est précis, meilleur sera le résultat généré par l'IA..."
          style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
          minLength={20}
          maxLength={500}
        />
        <div style={{ fontSize: 11, marginTop: 4, color: (data.description || '').length < 20 ? '#E11F7B' : 'rgba(255,255,255,0.25)' }}>
          {(data.description || '').length < 20
            ? `encore ${20 - (data.description || '').length} caractères`
            : `${(data.description || '').length}/500`}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Audience cible</label>
        <select
          value={data.audience || ''}
          onChange={e => onChange({ audience: e.target.value as DeckAudience })}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="" disabled>Sélectionner...</option>
          {AUDIENCES.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* ── PDF Import section (déplacé ici depuis StepStyle) ── */}
      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(225,31,123,0.2)',
        background: 'rgba(225,31,123,0.04)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Paperclip size={14} color="#E11F7B" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E11F7B' }}>
            Importer depuis un PDF
          </span>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['da', 'full'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setImportMode(mode); setExtractedDA(null); setPdfError(null) }}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif', fontSize: 11, fontWeight: 600,
                background: importMode === mode ? 'rgba(225,31,123,0.2)' : 'rgba(255,255,255,0.05)',
                color: importMode === mode ? '#E11F7B' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'da' ? '🎨 Charte graphique' : '📦 Présentation complète'}
            </button>
          ))}
        </div>
        {importMode === 'full' && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
            Gemini va extraire la DA <strong>ET le contenu de chaque slide</strong>. Tu atterriras directement dans l'éditeur avec tes slides importées.
          </p>
        )}

        {/* File picker + Analyze button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              setPdfFile(f)
              setExtractedDA(null)
              setPdfError(null)
              setDaApplied(false)
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: pdfFile ? '#F5F0F7' : 'rgba(255,255,255,0.35)',
              fontSize: 12, fontFamily: 'Poppins, sans-serif',
              textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {pdfFile ? pdfFile.name : 'Choisir un fichier PDF…'}
          </button>
          <button
            onClick={() => void handleAnalyzePDF()}
            disabled={!pdfFile || analyzing}
            style={{
              padding: '9px 16px', borderRadius: 8, cursor: pdfFile && !analyzing ? 'pointer' : 'not-allowed',
              border: 'none',
              background: pdfFile && !analyzing ? 'linear-gradient(135deg, #E11F7B, #c41a6a)' : 'rgba(255,255,255,0.06)',
              color: pdfFile && !analyzing ? '#fff' : 'rgba(255,255,255,0.2)',
              fontSize: 12, fontWeight: 700, fontFamily: 'Poppins, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            {analyzing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
            {analyzing
              ? (importMode === 'full' ? 'Import en cours…' : 'Analyse…')
              : (importMode === 'full' ? '📦 Importer' : '🎨 Analyser')}
          </button>
        </div>

        {/* Error */}
        {pdfError && (
          <div style={{ fontSize: 12, color: '#FCA5A5', padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {pdfError}
          </div>
        )}

        {/* Result */}
        {extractedDA && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>
              ✅ DA détectée — {extractedDA.notes}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: extractedDA.primaryColor, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Couleur principale</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F0F7', fontFamily: 'monospace' }}>{extractedDA.primaryColor}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: extractedDA.bgColor, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Fond</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F0F7', fontFamily: 'monospace' }}>{extractedDA.bgColor}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Font</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F5F0F7' }}>{extractedDA.fontStyle}</span>
              </div>
            </div>
            {daApplied ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>✅ DA appliquée au deck</div>
            ) : (
              <button
                onClick={handleApplyDA}
                style={{
                  alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Appliquer à mon deck
              </button>
            )}
          </motion.div>
        )}

        {!extractedDA && !analyzing && !pdfError && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Gemini analyse ton PDF et extrait automatiquement la charte graphique.
          </p>
        )}
      </div>

      {/* ── URL Import section ── */}
      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(56, 189, 248, 0.2)',
        background: 'rgba(56, 189, 248, 0.04)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={14} color="#38BDF8" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8' }}>
            Générer depuis une URL
          </span>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.5 }}>
          Colle une URL (site, landing page, article, fiche produit…) et Gemini analysera la page pour créer ta présentation automatiquement.
        </p>

        {/* Input + bouton */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setUrlResult(null); setUrlError(null); setUrlApplied(false) }}
            onKeyDown={e => e.key === 'Enter' && !urlAnalyzing && void handleAnalyzeURL()}
            placeholder="https://monsite.com ou monsite.com"
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#F5F0F7', fontFamily: 'Poppins, sans-serif', outline: 'none',
            }}
          />
          <button
            onClick={() => void handleAnalyzeURL()}
            disabled={!urlInput.trim() || urlAnalyzing}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', flexShrink: 0,
              background: urlInput.trim() && !urlAnalyzing
                ? 'linear-gradient(135deg, #38BDF8, #0EA5E9)'
                : 'rgba(255,255,255,0.06)',
              color: urlInput.trim() && !urlAnalyzing ? '#fff' : 'rgba(255,255,255,0.2)',
              fontSize: 12, fontWeight: 700, cursor: urlInput.trim() && !urlAnalyzing ? 'pointer' : 'not-allowed',
              fontFamily: 'Poppins, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {urlAnalyzing
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analyse…</>
              : <><Sparkles size={13} /> Analyser</>
            }
          </button>
        </div>

        {/* Error */}
        {urlError && (
          <div style={{ fontSize: 12, color: '#FCA5A5', padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            ⚠️ {urlError}
          </div>
        )}

        {/* Résultat */}
        {urlResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8' }}>
              ✅ Page analysée{urlResult.companyName ? ` — ${urlResult.companyName}` : ''}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, fontStyle: 'italic' }}>
              "{urlResult.rawSummary}"
            </div>

            {/* Infos extraites */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(56,189,248,0.15)', color: '#38BDF8' }}>
                {urlResult.suggestedSlideCount} slides
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                {urlResult.audience}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                {urlResult.tonality}
              </span>
            </div>

            {/* Key facts */}
            {urlResult.keyFacts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {urlResult.keyFacts.slice(0, 3).map((fact, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#38BDF8' }}>•</span>
                    {fact}
                  </div>
                ))}
              </div>
            )}

            {/* Bouton appliquer */}
            {urlApplied ? (
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>✅ Formulaire pré-rempli !</div>
            ) : (
              <button
                onClick={handleApplyURL}
                style={{
                  alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Utiliser cette analyse →
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ── Step 2: Style ─────────────────────────────────────────────────────────────

function StepStyle({
  data,
  onChange,
}: {
  data: Partial<DeckBrief>
  onChange: (partial: Partial<DeckBrief>) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Tonalité (déplacée ici depuis StepBrief) ── */}
      <div>
        <label style={labelStyle}>Tonalité</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TONALITIES.map(t => {
            const active = data.tonality === t
            return (
              <button
                key={t}
                onClick={() => onChange({ tonality: t })}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${active ? '#E11F7B' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(225,31,123,0.15)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#E11F7B' : 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Divider (placeholder to keep structure before theme grid) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          Choisir un thème
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* ── Theme grid ── */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {THEMES.map(theme => {
            const active = data.theme === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => onChange({ theme: theme.id })}
                style={{
                  padding: 0,
                  borderRadius: 12,
                  border: `2px solid ${active ? '#E11F7B' : 'rgba(255,255,255,0.08)'}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  height: 80,
                  background: theme.preview,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {active && <Check size={24} color="#E11F7B" />}
                </div>
                <div style={{ padding: '10px 12px', background: '#2C272F' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#E11F7B' : '#F5F0F7', marginBottom: 2 }}>
                    {theme.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {theme.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Nombre de slides — {data.slideCount || 8}</label>
        <input
          type="range"
          min={5}
          max={15}
          value={data.slideCount || 8}
          onChange={e => onChange({ slideCount: parseInt(e.target.value) })}
          style={{ width: '100%', accentColor: '#E11F7B', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
          <span>5</span>
          <span>15</span>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Langue</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {LANGS.map(lang => {
            const active = data.lang === lang
            return (
              <button
                key={lang}
                onClick={() => onChange({ lang })}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${active ? '#E11F7B' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(225,31,123,0.15)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#E11F7B' : 'rgba(255,255,255,0.5)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {lang}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Confirmation ──────────────────────────────────────────────────────

function StepConfirm({
  data,
  isGenerating,
  progress,
  onGenerate,
}: {
  data: DeckBrief
  isGenerating: boolean
  progress: GenerationProgress | null
  onGenerate: () => void
}) {
  const theme = THEMES.find(t => t.id === data.theme)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 20,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Résumé du brief
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Titre', value: data.title },
            { label: 'Description', value: data.description },
            { label: 'Audience', value: data.audience },
            { label: 'Tonalité', value: data.tonality },
            { label: 'Thème', value: theme?.label || data.theme },
            { label: 'Slides', value: `${data.slideCount} slides` },
            { label: 'Langue', value: data.lang },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', width: 80, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 12, color: '#F5F0F7', flex: 1, wordBreak: 'break-word' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generation button + progress */}
      {!isGenerating ? (
        <button
          onClick={onGenerate}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '16px 24px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif',
            boxShadow: '0 4px 24px rgba(225,31,123,0.4)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          <Sparkles size={18} />
          Générer le deck avec l&apos;IA
        </button>
      ) : (
        <div style={{
          background: 'rgba(225,31,123,0.05)',
          border: '1px solid rgba(225,31,123,0.2)',
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Sparkles size={18} color="#E11F7B" />
            </motion.div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E11F7B' }}>
              {progress?.message || 'Génération en cours...'}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: `${progress?.pct || 10}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #E11F7B, #7C3AED)',
                borderRadius: 999,
              }}
            />
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            {progress?.pct || 0}% — Cela prend généralement 15-30 secondes
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Storyboard ────────────────────────────────────────────────────────

const SLIDE_TYPE_COLORS: Record<SlideType, string> = {
  hero: '#E11F7B',
  content: '#7C3AED',
  stats: '#0EA5E9',
  quote: '#10B981',
  cta: '#F59E0B',
  chart: '#8B5CF6',
  timeline: '#06B6D4',
  comparison: '#F97316',
  features: '#EC4899',
  pricing: '#14B8A6',
  team: '#A855F7',
  roadmap: '#F59E0B',
  market: '#3B82F6',
  orbit: '#6366F1',
  mockup: '#84CC16',
}

const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  hero: 'Hero',
  content: 'Contenu',
  stats: 'Stats',
  quote: 'Citation',
  cta: 'CTA',
  chart: 'Graphique',
  timeline: 'Timeline',
  comparison: 'Comparaison',
  features: 'Features',
  pricing: 'Pricing',
  team: 'Équipe',
  roadmap: 'Roadmap',
  market: 'Marché',
  orbit: 'Orbit',
  mockup: 'Mockup',
}

function StepStoryboard({
  outline,
  onChange,
  isLoading,
  onGenerate,
  isGenerating,
  progress,
}: {
  outline: SlideOutline[]
  onChange: (outline: SlideOutline[]) => void
  isLoading: boolean
  onGenerate: () => void
  isGenerating: boolean
  progress: GenerationProgress | null
}) {
  const PROTECTED_TYPES: SlideType[] = ['hero', 'cta']

  function moveSlide(idx: number, dir: 'up' | 'down') {
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= outline.length) return
    const next = [...outline]
    const temp = next[idx]
    next[idx] = next[target]
    next[target] = temp
    onChange(next)
  }

  function deleteSlide(idx: number) {
    onChange(outline.filter((_, i) => i !== idx))
  }

  function updateTitle(idx: number, title: string) {
    const next = [...outline]
    next[idx] = { ...next[idx], title }
    onChange(next)
  }

  function updateCustomPrompt(idx: number, customPrompt: string) {
    const next = [...outline]
    next[idx] = { ...next[idx], customPrompt: customPrompt || undefined }
    onChange(next)
  }

  function addSlide() {
    const newSlide: SlideOutline = { type: 'content', title: 'Nouvelle slide' }
    // Find last CTA slide index
    let lastCta = -1
    for (let j = outline.length - 1; j >= 0; j--) {
      if (outline[j].type === 'cta') { lastCta = j; break }
    }
    if (lastCta > 0) {
      const next = [...outline]
      next.splice(lastCta, 0, newSlide)
      onChange(next)
    } else {
      onChange([...outline, newSlide])
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
          <Sparkles size={24} color="#E11F7B" />
        </motion.div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Génération de l&apos;outline…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
        Revoyez et ajustez les slides avant la génération complète.
      </p>

      {/* Slide list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {outline.map((slide, i) => {
          const color = SLIDE_TYPE_COLORS[slide.type] || '#E11F7B'
          const isProtected = PROTECTED_TYPES.includes(slide.type)
          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 0,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${color}30`,
                overflow: 'hidden',
              }}
            >
              {/* ── Main row ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                {/* Position number */}
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', minWidth: 16, textAlign: 'center' }}>
                  {i + 1}
                </span>

                {/* Type badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                  background: `${color}20`, color, textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {SLIDE_TYPE_LABELS[slide.type]}
                </span>

                {/* Editable title */}
                <input
                  value={slide.title}
                  onChange={e => updateTitle(i, e.target.value)}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: '#F5F0F7', fontSize: 13, fontWeight: 500,
                    fontFamily: 'Poppins, sans-serif', minWidth: 0,
                  }}
                />

                {/* Actions */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveSlide(i, 'up')} disabled={i === 0} style={{ ...storyBtnStyle, opacity: i === 0 ? 0.2 : 0.6 }}>
                    <ArrowUp size={11} />
                  </button>
                  <button onClick={() => moveSlide(i, 'down')} disabled={i === outline.length - 1} style={{ ...storyBtnStyle, opacity: i === outline.length - 1 ? 0.2 : 0.6 }}>
                    <ArrowDown size={11} />
                  </button>
                  {!isProtected && (
                    <button onClick={() => deleteSlide(i)} style={{ ...storyBtnStyle, color: '#EF4444', opacity: 0.7 }}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Custom prompt row ── */}
              <div style={{ padding: '0 12px 10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <MessageSquare size={10} color="rgba(255,255,255,0.25)" />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Instruction spécifique (optionnel)
                  </span>
                </div>
                <textarea
                  value={slide.customPrompt || ''}
                  onChange={e => updateCustomPrompt(i, e.target.value)}
                  placeholder='ex: "Inclure les stats de croissance 2024"'
                  rows={1}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 6,
                    color: '#F5F0F7',
                    fontSize: 11,
                    fontFamily: 'Poppins, sans-serif',
                    padding: '5px 8px',
                    resize: 'none',
                    outline: 'none',
                    lineHeight: 1.5,
                    height: 28,
                    opacity: slide.customPrompt ? 1 : 0.5,
                    transition: 'height 0.15s, opacity 0.15s',
                    overflow: 'hidden',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.height = 'auto'
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.borderColor = 'rgba(225,31,123,0.3)'
                  }}
                  onBlur={e => {
                    if (!e.currentTarget.value) {
                      e.currentTarget.style.height = '28px'
                      e.currentTarget.style.opacity = '0.5'
                    }
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                  }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${el.scrollHeight}px`
                  }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Add slide */}
      <button
        onClick={addSlide}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.15)',
          background: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'Poppins, sans-serif',
        }}
      >
        <Plus size={13} />
        Ajouter une slide
      </button>

      {/* Generate button + progress */}
      {!isGenerating ? (
        <button
          onClick={onGenerate}
          disabled={outline.length === 0}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 24px', borderRadius: 12, border: 'none', marginTop: 8,
            background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif',
            boxShadow: '0 4px 24px rgba(225,31,123,0.4)',
          }}
        >
          <Sparkles size={18} />
          Générer le deck ({outline.length} slides)
        </button>
      ) : (
        <div style={{
          background: 'rgba(225,31,123,0.05)', border: '1px solid rgba(225,31,123,0.2)',
          borderRadius: 12, padding: 20, marginTop: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Loader2 size={18} color="#E11F7B" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E11F7B' }}>
              {progress?.message || 'Génération en cours...'}
            </span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${progress?.pct || 10}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ height: '100%', background: 'linear-gradient(90deg, #E11F7B, #7C3AED)', borderRadius: 999 }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            {progress?.pct || 0}% — Cela prend généralement 15-30 secondes
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const storyBtnStyle: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 4, border: 'none',
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Brief', 'Style', 'Storyboard', 'Génération']

// ── Template Picker ───────────────────────────────────────────────────────────

const SOURCE_COLORS_MINI: Record<string, string> = {
  system: '#F59E0B', pdf: '#7C3AED', deck: '#E11F7B', manual: '#6B7280',
}

// ── Template Selector Block (collapsible, in Step 2) ──────────────────────────
function TemplateSelectorBlock({
  selected,
  onSelect,
}: {
  selected: DeckTemplate | null
  onSelect: (t: DeckTemplate | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      borderRadius: 12,
      border: selected ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)',
      background: selected ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Header — toujours visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: selected ? '#F59E0B' : 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
          🧩 {selected ? `Template : ${selected.name}` : 'Partir d\'un template (optionnel)'}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Content — collapsible */}
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Sélectionne un template pour pré-remplir le style et la structure des slides. Tu pourras tout modifier ensuite.
          </p>
          <TemplatePicker onSelect={(t) => { onSelect(t); if (t) setOpen(false) }} selectedId={selected?.id} />
          {selected && (
            <button
              onClick={() => { onSelect(null); }}
              style={{
                marginTop: 10, background: 'none', border: 'none',
                fontSize: 11, color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                fontFamily: 'Poppins, sans-serif', textDecoration: 'underline',
              }}
            >
              Retirer le template
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TemplatePicker({
  onSelect,
  selectedId,
}: {
  onSelect: (t: DeckTemplate | null) => void
  selectedId?: string
}) {
  const [templates, setTemplates] = useState<DeckTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('templates').select('*').order('is_system', { ascending: false }).then(({ data }) => {
      if (data) setTemplates(data as DeckTemplate[])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
      Chargement des templates…
    </div>
  )

  if (templates.length === 0) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
      Aucun template disponible
    </div>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 10,
      maxHeight: 320,
      overflowY: 'auto',
      paddingRight: 4,
    }}>
      {templates.map(t => {
        const active = t.id === selectedId
        const sourceColor = SOURCE_COLORS_MINI[t.source] || '#6B7280'
        const bgColor = t.theme_config?.bgColor || '#0B090D'
        const primaryColor = t.theme_config?.primaryColor || '#E11F7B'
        const textPrimary = t.theme_config?.textPrimary || '#F5F0F7'
        return (
          <motion.div
            key={t.id}
            whileHover={{ y: -2 }}
            onClick={() => onSelect(active ? null : t)}
            style={{
              borderRadius: 10,
              border: active ? `2px solid ${primaryColor}` : '2px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: active ? `0 0 0 2px ${primaryColor}44` : 'none',
              transition: 'box-shadow 0.15s',
            }}
          >
            {/* Strip */}
            <div style={{ height: 3, background: sourceColor }} />
            {/* Mini thumbnail */}
            <div style={{
              height: 60,
              background: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${primaryColor}18 0%, transparent 70%)`,
              }} />
              <div style={{ textAlign: 'center', padding: '0 8px', position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: textPrimary, lineHeight: 1.2 }}>{t.name}</div>
              </div>
              {active && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: primaryColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={9} color="#fff" />
                </div>
              )}
            </div>
            {/* Name */}
            <div style={{
              padding: '6px 8px',
              background: '#2C272F',
              fontSize: 10, fontWeight: 600, color: active ? primaryColor : '#F5F0F7',
              lineHeight: 1.2,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {t.name}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function NewDeckPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [startMode, setStartMode] = useState<'none' | 'scratch' | 'template'>('scratch')
  const [selectedTemplate, setSelectedTemplate] = useState<DeckTemplate | null>(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingOutline, setIsLoadingOutline] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress | null>(null)
  const [outline, setOutline] = useState<SlideOutline[]>([])

  const [brief, setBrief] = useState<Partial<DeckBrief>>({
    theme: 'dark_premium',
    slideCount: 8,
    lang: 'Français',
    audience: 'Investisseur',
    tonality: 'Dynamique',
  })

  // Auto-select template from URL param ?template=<id>
  useEffect(() => {
    const templateId = searchParams.get('template')
    if (templateId) {
      supabase.from('templates').select('*').eq('id', templateId).single().then(({ data }) => {
        if (data) {
          setSelectedTemplate(data as DeckTemplate)
          setStartMode('template')
          applyTemplate(data as DeckTemplate)
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyTemplate(t: DeckTemplate) {
    const themeMap: Record<string, DeckTheme> = {
      dark_premium: 'dark_premium', light_clean: 'light_clean',
      gradient_bold: 'gradient_bold', corporate: 'corporate',
    }
    const theme = themeMap[t.theme_config?.preset] || 'dark_premium'
    const accentColor = t.theme_config?.primaryColor
    // Build outline from slide_structure
    const newOutline: SlideOutline[] = (t.slide_structure || []).map(s => ({
      type: s.type,
      title: s.hint || (s.type.charAt(0).toUpperCase() + s.type.slice(1)),
    }))
    setBrief(prev => ({ ...prev, theme, accentColor }))
    if (newOutline.length > 0) setOutline(newOutline)
  }

  function handleSelectTemplate(t: DeckTemplate | null) {
    setSelectedTemplate(t)
    if (t) applyTemplate(t)
    else setBrief(prev => ({ ...prev, theme: 'dark_premium', accentColor: undefined }))
  }

  function updateBrief(partial: Partial<DeckBrief>) {
    setBrief(prev => ({ ...prev, ...partial }))
  }

  function canProceed() {
    if (step === 0) {
      return (
        (brief.title?.length ?? 0) >= 3 &&
        (brief.description?.length ?? 0) >= 20 &&
        brief.audience &&
        brief.tonality
      )
    }
    if (step === 1) {
      return brief.theme && brief.slideCount && brief.lang
    }
    return true
  }

  async function handleContinueToStoryboard() {
    setStep(2)
    setIsLoadingOutline(true)
    setError(null)
    try {
      const generatedOutline = await generateOutline(brief as DeckBrief)
      setOutline(generatedOutline)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération outline')
    }
    setIsLoadingOutline(false)
  }

  async function handleGenerate() {
    if (isGenerating) return
    setError(null)
    setIsGenerating(true)

    try {
      const deckId = await generateDeck(
        brief as DeckBrief,
        (p) => { setProgress(p) },
        outline.length > 0 ? outline : undefined
      )
      navigate(`/decks/${deckId}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setIsGenerating(false)
    }
  }

  function handleUrlImport(result: URLAnalysisResult) {
    const suggestedOutline: SlideOutline[] = result.suggestedOutline.map(s => ({
      type: s.type,
      title: s.title,
      customPrompt: s.hint || undefined,
    }))
    if (suggestedOutline.length > 0) {
      setOutline(suggestedOutline)
      setBrief(prev => ({ ...prev, slideCount: suggestedOutline.length }))
    }
  }

  async function handleImportFromPDF(slides: ExtractedSlide[], da: ExtractedDA) {
    setIsGenerating(true)
    setError(null)
    setProgress({ step: 'structuring', pct: 10, message: 'Import de la présentation PDF...' })
    try {
      const deckBrief: DeckBrief = {
        title: brief.title || 'Présentation importée',
        description: brief.description || '',
        audience: brief.audience || 'Client',
        tonality: brief.tonality || 'Neutre',
        lang: brief.lang || 'Français',
        theme: da.theme,
        slideCount: slides.length,
        accentColor: da.primaryColor,
      }
      const deckId = await importDeck(deckBrief, slides, (p) => setProgress(p))
      navigate(`/decks/${deckId}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import')
      setIsGenerating(false)
      setProgress(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B090D',
      color: '#F5F0F7',
      fontFamily: 'Poppins, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 50% 35% at 50% 0%, rgba(225,31,123,0.1) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 540 }}>

        {/* Back button */}
        <button
          onClick={() => {
            if (step > 0 && !isGenerating) setStep(s => s - 1)
            else navigate('/decks')
          }}
          disabled={isLoadingOutline}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 32,
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          <ChevronLeft size={16} />
          {step > 0 ? 'Étape précédente' : 'Retour aux decks'}
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 999,
            background: 'rgba(225,31,123,0.1)',
            border: '1px solid rgba(225,31,123,0.2)',
            color: '#E11F7B', fontSize: 12, fontWeight: 700,
            marginBottom: 16,
          }}>
            <Sparkles size={12} />
            Nouveau deck IA
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>
            {startMode === 'scratch' ? 'Créer une présentation' : 'Comment veux-tu commencer ?'}
          </h1>
          {startMode === 'scratch' && (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              {step === 0 && 'Décrivez votre sujet et votre audience'}
              {step === 1 && 'Choisissez le style visuel de votre deck'}
              {step === 2 && "Ajustez la structure de votre deck avant génération"}
              {step === 3 && "Vérifiez et lancez la génération par l'IA"}
            </p>
          )}
        </div>

        {/* ── Start mode picker ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {startMode !== 'scratch' && (
            <motion.div
              key="startmode"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* De zéro */}
                <motion.button
                  whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(225,31,123,0.2)' }}
                  onClick={() => { setStartMode('scratch'); setSelectedTemplate(null) }}
                  style={{
                    padding: 24, borderRadius: 16,
                    border: '2px solid rgba(255,255,255,0.1)',
                    background: '#2C272F', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Poppins, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🚀</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F0F7', marginBottom: 8 }}>De zéro</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Formulaire complet + génération IA entièrement personnalisée
                  </div>
                </motion.button>

                {/* Depuis un template */}
                <motion.button
                  whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(245,158,11,0.15)' }}
                  onClick={() => setStartMode('template')}
                  style={{
                    padding: 24, borderRadius: 16,
                    border: startMode === 'template' ? '2px solid #F59E0B' : '2px solid rgba(245,158,11,0.3)',
                    background: startMode === 'template' ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Poppins, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🧩</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F0F7', marginBottom: 8 }}>Depuis un template</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    Applique un style et une structure existante à ton deck
                  </div>
                </motion.button>
              </div>

              {/* Template picker expanded */}
              <AnimatePresence>
                {startMode === 'template' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    style={{
                      background: '#2C272F', borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: 20, marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                      Choisir un template
                    </div>
                    <TemplatePicker onSelect={handleSelectTemplate} selectedId={selectedTemplate?.id} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => setStartMode('scratch')}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                        }}
                      >
                        De zéro sans template →
                      </button>
                      {selectedTemplate && (
                        <button
                          onClick={() => setStartMode('scratch')}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 10,
                            border: 'none', background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          Continuer avec {selectedTemplate.name} →
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step indicators - only shown when in form mode */}
        {startMode === 'scratch' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32, justifyContent: 'center' }}>
          {STEP_LABELS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: done ? '#E11F7B' : active ? 'rgba(225,31,123,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${done || active ? '#E11F7B' : 'rgba(255,255,255,0.1)'}`,
                    color: done ? '#fff' : active ? '#E11F7B' : 'rgba(255,255,255,0.3)',
                  }}>
                    {done ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#F5F0F7' : 'rgba(255,255,255,0.3)' }}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{
                    width: 32, height: 1,
                    background: done ? '#E11F7B' : 'rgba(255,255,255,0.08)',
                  }} />
                )}
              </div>
            )
          })}
        </div>}

        {/* Form card */}
        {startMode === 'scratch' && <div style={{
          background: '#2C272F',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: 28,
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <StepBrief data={brief} onChange={updateBrief} onImport={handleImportFromPDF} onUrlImport={handleUrlImport} />}
              {step === 1 && (
                <>
                  <TemplateSelectorBlock
                    selected={selectedTemplate}
                    onSelect={handleSelectTemplate}
                  />
                  <StepStyle data={brief} onChange={updateBrief} />
                </>
              )}
              {step === 2 && (
                <StepStoryboard
                  outline={outline}
                  onChange={setOutline}
                  isLoading={isLoadingOutline}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  progress={progress}
                />
              )}
              {step === 3 && (
                <StepConfirm
                  data={brief as DeckBrief}
                  isGenerating={isGenerating}
                  progress={progress}
                  onGenerate={handleGenerate}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5', fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Navigation buttons (steps 0 & 1) */}
          {step < 2 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
              <button
                onClick={() => {
                  if (step === 1) {
                    // Step 1 → Step 2: generate outline
                    void handleContinueToStoryboard()
                  } else {
                    setStep(s => s + 1)
                  }
                }}
                disabled={!canProceed()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '11px 22px', borderRadius: 10, border: 'none',
                  background: canProceed()
                    ? 'linear-gradient(135deg, #E11F7B, #c41a6a)'
                    : 'rgba(255,255,255,0.06)',
                  color: canProceed() ? '#fff' : 'rgba(255,255,255,0.2)',
                  fontSize: 14, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'not-allowed',
                  fontFamily: 'Poppins, sans-serif',
                  transition: 'all 0.15s',
                  boxShadow: canProceed() ? '0 4px 16px rgba(225,31,123,0.3)' : 'none',
                }}
              >
                {step === 1 ? 'Générer l\'outline' : 'Continuer'}
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>}

        {/* Hint text */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          Propulsé par Gemini AI · Génère du vrai contenu professionnel
        </p>
      </div>
    </div>
  )
}

export default NewDeckPage
