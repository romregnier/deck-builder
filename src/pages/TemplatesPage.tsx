/**
 * TemplatesPage — Galerie des templates
 * Sprint v3
 *
 * - Fetch tous les templates depuis Supabase
 * - Grid responsive avec filtres
 * - Bouton "Utiliser" → /decks/new?template=<id>
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Presentation, ChevronLeft, MoreHorizontal, Trash2, Layers, Pencil } from 'lucide-react'
import type { DeckTemplate } from '../types/deck'

// ── Source colors ─────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  system: '#F59E0B',
  pdf: '#7C3AED',
  deck: '#E11F7B',
  manual: '#6B7280',
}

const SOURCE_LABELS: Record<string, string> = {
  system: '⭐ Système',
  pdf: '📄 PDF',
  deck: '🎨 Deck',
  manual: '✏️ Manuel',
}

type FilterSource = 'all' | 'system' | 'pdf' | 'deck'

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({ template, onDelete }: { template: DeckTemplate; onDelete?: () => void }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(false)

  const sourceColor = SOURCE_COLORS[template.source] || '#6B7280'
  const bgColor = template.theme_config?.bgColor || '#0B090D'
  const primaryColor = template.theme_config?.primaryColor || '#E11F7B'
  const textPrimary = template.theme_config?.textPrimary || '#F5F0F7'
  const slideCount = template.slide_structure?.length

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    await supabase.from('templates').delete().eq('id', template.id)
    onDelete()
    setDeleting(false)
  }

  async function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditingTemplate(true)
    setMenuOpen(false)

    // Créer un deck temporaire depuis ce template
    const themeJson = JSON.stringify({
      ...template.theme_config,
      preset: template.theme_config?.preset || 'DARK_PREMIUM',
    })

    const { data: deck, error } = await supabase
      .from('presentations')
      .insert({
        title: `[Édition] ${template.name}`,
        description: template.description || '',
        theme_json: themeJson,
        status: 'draft',
        is_template_edit: true,
        source_template_id: template.id,
      })
      .select()
      .single()

    if (error || !deck) {
      console.error('[handleEdit] failed to create temp deck:', error)
      setEditingTemplate(false)
      return
    }

    // Créer les slides depuis la structure du template
    if (template.slide_structure && template.slide_structure.length > 0) {
      const slidesData = template.slide_structure.map((s, i) => ({
        presentation_id: deck.id,
        type: s.type,
        position: i,
        content: s.content ? JSON.stringify(s.content) : JSON.stringify({}),
      }))
      await supabase.from('slides').insert(slidesData)
    } else {
      // Slide hero par défaut si pas de structure
      await supabase.from('slides').insert({
        presentation_id: deck.id,
        type: 'hero',
        position: 0,
        content: JSON.stringify({ title: template.name, subtitle: '' }),
      })
    }

    setEditingTemplate(false)
    navigate(`/decks/${deck.id}/edit?edit_template=${template.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: `0 12px 40px ${sourceColor}22` }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: '#2C272F',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Source strip */}
      <div style={{
        height: 3,
        background: sourceColor,
        width: '100%',
      }} />

      {/* Thumbnail */}
      <div
        onClick={() => navigate(`/decks/new?template=${template.id}`)}
        style={{
          height: 140,
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <>
            {/* Decorative gradient */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${primaryColor}18 0%, transparent 70%)`,
            }} />
            {/* Title preview */}
            <div style={{
              textAlign: 'center',
              padding: '0 16px',
              position: 'relative',
              zIndex: 1,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: primaryColor,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
                opacity: 0.8,
              }}>
                {template.theme_config?.fontFamily || 'Poppins'}
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: textPrimary,
                lineHeight: 1.2,
              }}>
                {template.name}
              </div>
              {template.theme_config?.accentGradient && (
                <div style={{
                  width: 40, height: 3, borderRadius: 2,
                  background: template.theme_config.accentGradient,
                  margin: '8px auto 0',
                }} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Card body */}
      <div
        style={{ padding: '12px 14px' }}
        onClick={() => navigate(`/decks/new?template=${template.id}`)}
      >
        {/* Source badge */}
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 999,
            background: `${sourceColor}22`,
            color: sourceColor,
            border: `1px solid ${sourceColor}44`,
            letterSpacing: '0.05em',
          }}>
            {SOURCE_LABELS[template.source]}
          </span>
        </div>

        {/* Name */}
        <h3 style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#F5F0F7',
          marginBottom: 4,
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {template.name}
        </h3>

        {/* Description */}
        {template.description && (
          <p style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            lineHeight: 1.4,
            marginBottom: 8,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {template.description}
          </p>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {slideCount !== undefined ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'rgba(255,255,255,0.3)',
            }}>
              <Layers size={11} />
              <span>{slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Menu ⋯ pour non-system */}
            {!template.is_system && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 6,
                    border: 'none', background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  }}
                >
                  <MoreHorizontal size={13} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{
                        position: 'absolute', bottom: '100%', right: 0,
                        background: '#3E3742', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, overflow: 'hidden',
                        zIndex: 10, minWidth: 140,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                      }}
                    >
                      <button
                        onClick={handleEdit}
                        disabled={editingTemplate}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', border: 'none',
                          background: 'none', color: '#F5F0F7',
                          fontSize: 12, cursor: 'pointer', width: '100%',
                          fontFamily: 'Poppins, sans-serif',
                          opacity: editingTemplate ? 0.5 : 1,
                        }}
                      >
                        <Pencil size={12} />
                        {editingTemplate ? 'Ouverture...' : 'Modifier'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete() }}
                        disabled={deleting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', border: 'none',
                          background: 'none', color: '#EF4444',
                          fontSize: 12, cursor: 'pointer', width: '100%',
                          fontFamily: 'Poppins, sans-serif',
                          borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Trash2 size={12} />
                        Supprimer
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Use button */}
            <button
              onClick={e => { e.stopPropagation(); navigate(`/decks/new?template=${template.id}`) }}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              }}
            >
              Utiliser
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterSource }) {
  const msgs: Record<FilterSource, { emoji: string; title: string; sub: string }> = {
    all: { emoji: '🧩', title: 'Aucun template', sub: 'Sauvegardez un deck en template depuis l\'éditeur.' },
    system: { emoji: '⭐', title: 'Aucun template système', sub: 'Les templates officiels apparaîtront ici.' },
    pdf: { emoji: '📄', title: 'Aucun template PDF', sub: 'Créez un template depuis un PDF pour le voir ici.' },
    deck: { emoji: '🎨', title: 'Aucun template deck', sub: 'Sauvegardez un deck existant en template.' },
  }
  const { emoji, title, sub } = msgs[filter]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 16 }}>{emoji}</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', maxWidth: 300 }}>{sub}</p>
    </motion.div>
  )
}

// ── TemplatesPage ─────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<DeckTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterSource>('all')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTemplates(data as DeckTemplate[])
    } else if (error) {
      console.error('[TemplatesPage] fetch error:', error.message)
    }
    setLoading(false)
  }

  const filtered = templates.filter(t => {
    if (filter === 'all') return true
    return t.source === filter
  })

  const counts: Record<FilterSource, number> = {
    all: templates.length,
    system: templates.filter(t => t.source === 'system').length,
    pdf: templates.filter(t => t.source === 'pdf').length,
    deck: templates.filter(t => t.source === 'deck').length,
  }

  const filterTabs: { key: FilterSource; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'system', label: '⭐ Système' },
    { key: 'pdf', label: '📄 PDF' },
    { key: 'deck', label: '🎨 Deck' },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B090D',
      color: '#FFFFFF',
      fontFamily: 'Poppins, sans-serif',
    }}>
      {/* Background gradient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,158,11,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 0 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/decks')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
              title="Retour aux decks"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>🧩</span>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
                  Templates
                </h1>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                {templates.length} template{templates.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/decks/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(225,31,123,0.3)',
              }}
            >
              <Presentation size={15} />
              Nouveau deck
            </button>
          </div>
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
          {filterTabs.map(tab => {
            const active = filter === tab.key
            const count = counts[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: active ? 'rgba(225,31,123,0.15)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#E11F7B' : 'rgba(255,255,255,0.5)',
                  borderBottom: active ? '2px solid #E11F7B' : '2px solid transparent',
                  transition: 'all 0.15s',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                    background: active ? 'rgba(225,31,123,0.25)' : 'rgba(255,255,255,0.08)',
                    color: active ? '#E11F7B' : 'rgba(255,255,255,0.35)',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧩</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Chargement des templates…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))',
            gap: 16,
            paddingBottom: 40,
          }}>
            <AnimatePresence>
              {filtered.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDelete={template.is_system ? undefined : () => {
                    setTemplates(prev => prev.filter(t => t.id !== template.id))
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplatesPage
