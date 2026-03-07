/**
 * DecksPage — Répertoire des présentations (Deck Builder)
 * TK-0030 / TK-0047 / TK-0051
 *
 * - Grid de DeckCards (titre, nb slides, statut, date)
 * - Bouton "Nouveau deck" en haut à droite
 * - Filtres: Tous | Brouillons | Publiés | Partagés 🤝
 * - Empty state si aucun deck
 * - Fetch depuis Supabase `presentations`
 * - TK-0047: Import depuis Notion (mode démo si pas de clé API)
 * - TK-0051: Répertoire partagé (localStorage + bouton Partager)
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { Plus, Presentation, FileText, Globe, ChevronLeft, X, Loader2, BarChart2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchNotionPages, notionPageToBrief, isDemo, type NotionPage } from '../lib/notionImporter'
import { generateDeck } from '../lib/deckGenerator'
import type { DeckBrief } from '../types/deck'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deck {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  slide_count: number | null
  created_at: string
  updated_at: string
  published_url: string | null
}

type FilterStatus = 'all' | 'draft' | 'published' | 'shared'

// ── DeckCard ──────────────────────────────────────────────────────────────────

function DeckCard({
  deck,
  onClick,
  onShare,
  onAnalytics,
}: {
  deck: Deck
  onClick?: () => void
  onShare?: (deck: Deck) => void
  onAnalytics?: (deck: Deck) => void
}) {
  const statusColors: Record<string, string> = {
    draft: '#9CA3AF',
    published: '#10B981',
    archived: '#6B7280',
  }
  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  }

  const date = new Date(deck.updated_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2, boxShadow: '0 12px 40px rgba(225,31,123,0.18)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: '#2C272F',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '20px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: deck.status === 'published'
          ? 'linear-gradient(90deg, #E11F7B, #7C3AED)'
          : 'rgba(255,255,255,0.08)',
        borderRadius: '16px 16px 0 0',
      }} />

      {/* Header */}
      <div
        onClick={onClick}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(225,31,123,0.2), rgba(124,58,237,0.2))',
          border: '1px solid rgba(225,31,123,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Presentation size={18} color="#E11F7B" />
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: `${statusColors[deck.status]}22`,
          color: statusColors[deck.status],
          border: `1px solid ${statusColors[deck.status]}44`,
          whiteSpace: 'nowrap',
        }}>
          {statusLabels[deck.status]}
        </span>
      </div>

      {/* Title */}
      <h3
        onClick={onClick}
        style={{
          fontSize: 15, fontWeight: 700, color: '#FFFFFF',
          marginBottom: 4, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}
      >
        {deck.title}
      </h3>

      {/* Description */}
      {deck.description && (
        <p
          onClick={onClick}
          style={{
            fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            lineHeight: 1.5,
          }}
        >
          {deck.description}
        </p>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 'auto', paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Slide count badge */}
        <div
          onClick={onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(225,31,123,0.15)',
            border: '1px solid rgba(225,31,123,0.3)',
            color: '#E11F7B',
            fontSize: 11, fontWeight: 700,
            borderRadius: 6, padding: '3px 8px',
          }}
        >
          <Presentation size={10} />
          <span>{deck.slide_count != null ? `${deck.slide_count} slide${deck.slide_count !== 1 ? 's' : ''}` : '? slides'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{date}</span>
          {onShare && (
            <button
              onClick={e => { e.stopPropagation(); onShare(deck) }}
              title="Partager ce deck"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(225,31,123,0.4)'; e.currentTarget.style.color = '#E11F7B' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              🔗 Partager
            </button>
          )}
          {onAnalytics && deck.status === 'published' && (
            <button
              onClick={e => { e.stopPropagation(); onAnalytics(deck) }}
              title="Voir les analytics"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(225,31,123,0.4)'; e.currentTarget.style.color = '#E11F7B' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              <BarChart2 size={10} />
              Stats
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onNew, filter }: { onNew: () => void; filter: FilterStatus }) {
  const msgs: Record<FilterStatus, { emoji: string; title: string; sub: string }> = {
    all: { emoji: '🎨', title: 'Aucune présentation', sub: 'Créez votre premier deck pour démarrer.' },
    draft: { emoji: '📝', title: 'Aucun brouillon', sub: 'Vos présentations en cours apparaîtront ici.' },
    published: { emoji: '🌐', title: 'Aucune présentation publiée', sub: 'Publiez un deck pour le partager.' },
    shared: { emoji: '🤝', title: 'Aucun deck partagé', sub: 'Les decks publiés et partagés avec l\'équipe apparaîtront ici.' },
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
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24, maxWidth: 300 }}>{sub}</p>
      {filter === 'all' && (
        <button
          onClick={onNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(225,31,123,0.3)',
          }}
        >
          <Plus size={16} />
          Nouveau deck
        </button>
      )}
    </motion.div>
  )
}

// ── NotionImportModal ─────────────────────────────────────────────────────────

function NotionImportModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void
  onGenerated: (deckId: string) => void
}) {
  const [pages, setPages] = useState<NotionPage[]>([])
  const [loadingPages, setLoadingPages] = useState(true)
  const [selected, setSelected] = useState<NotionPage | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const demoMode = isDemo()

  useEffect(() => {
    fetchNotionPages().then(p => {
      setPages(p)
      setLoadingPages(false)
    })
  }, [])

  async function handleGenerate() {
    if (!selected) return
    setGenerating(true)
    setGenProgress(0)

    const brief = notionPageToBrief(selected)
    const deckBrief: DeckBrief = {
      title: brief.title,
      description: brief.description || `Présentation générée depuis "${selected.title}"`,
      audience: 'Équipe',
      tonality: 'Dynamique',
      theme: 'dark_premium',
      slideCount: Math.min(10, Math.max(5, Math.floor(selected.blocks.length / 2))),
      lang: 'Français',
    }

    try {
      const deckId = await generateDeck(
        deckBrief,
        (progress) => { setGenProgress(progress.pct ?? 0) },
        undefined
      )
      onGenerated(deckId as string)
    } catch (err) {
      console.error('[NotionImportModal] generateDeck error:', err)
      setGenerating(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        style={{
          background: '#1A1520',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 28,
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📥 Importer depuis Notion</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
              Sélectionnez une page Notion pour générer un deck
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Demo mode chip */}
        {demoMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)',
            borderRadius: 10, padding: '8px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#FB923C', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', background: 'rgba(249,115,22,0.2)', borderRadius: 4 }}>
              MODE DÉMO
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Configurez <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>VITE_NOTION_API_KEY</code> pour connecter votre workspace
            </span>
          </div>
        )}

        {/* Page list */}
        {loadingPages ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} color="#E11F7B" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {pages.map(page => (
              <div
                key={page.id}
                onClick={() => !generating && setSelected(page)}
                style={{
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  background: selected?.id === page.id ? 'rgba(225,31,123,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected?.id === page.id ? 'rgba(225,31,123,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: selected?.id === page.id ? '#fff' : 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
                    {page.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {page.blocks.length} blocs · {page.blocks.filter(b => b.type === 'bulleted_list_item').length} points clés
                  </div>
                </div>
                {selected?.id === page.id && (
                  <span style={{ fontSize: 16, color: '#E11F7B', flexShrink: 0 }}>✓</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Generating progress */}
        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: 'rgba(225,31,123,0.06)',
              border: '1px solid rgba(225,31,123,0.2)',
              borderRadius: 12, padding: '16px 20px', marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Loader2 size={18} color="#E11F7B" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Génération en cours…
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${Math.max(5, genProgress)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #E11F7B, #7C3AED)', borderRadius: 999 }}
              />
            </div>
          </motion.div>
        )}

        {/* Action button */}
        {!generating && (
          <button
            onClick={handleGenerate}
            disabled={!selected}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12, border: 'none',
              background: selected ? 'linear-gradient(135deg, #E11F7B, #c41a6a)' : 'rgba(255,255,255,0.08)',
              color: selected ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: 14, fontWeight: 700, cursor: selected ? 'pointer' : 'not-allowed',
              boxShadow: selected ? '0 4px 16px rgba(225,31,123,0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            ✨ Générer le deck
          </button>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </div>
  )
}

// ── ShareModal ────────────────────────────────────────────────────────────────

function ShareModal({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const storageKey = `deck_shared_${deck.id}`
  const [emails, setEmails] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [emailInput, setEmailInput] = useState('')
  const [copied, setCopied] = useState(false)

  const shareUrl = `https://deck-builder.surge.sh/present/${deck.id}`

  function saveEmails(list: string[]) {
    setEmails(list)
    try {
      localStorage.setItem(storageKey, JSON.stringify(list))
    } catch { /* ignore */ }
  }

  function addEmail() {
    const e = emailInput.trim().toLowerCase()
    if (!e || emails.includes(e) || !e.includes('@')) return
    saveEmails([...emails, e])
    setEmailInput('')
  }

  function removeEmail(e: string) {
    saveEmails(emails.filter(x => x !== e))
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: '#1A1520',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 28,
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🔗 Partager le deck</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0', maxWidth: 300 }}>
              {deck.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Copy link */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lien de partage
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, padding: '9px 12px', borderRadius: 9,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {shareUrl}
            </div>
            <button
              onClick={copyLink}
              style={{
                padding: '9px 14px', borderRadius: 9, flexShrink: 0,
                background: copied ? 'rgba(16,185,129,0.2)' : 'rgba(225,31,123,0.15)',
                color: copied ? '#10B981' : '#E11F7B',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(225,31,123,0.3)'}`,
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
          </div>
        </div>

        {/* Add email */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Partager avec (emails)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              placeholder="email@exemple.com"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 9,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'Poppins, sans-serif',
              }}
            />
            <button
              onClick={addEmail}
              style={{
                padding: '9px 14px', borderRadius: 9, flexShrink: 0,
                background: 'rgba(225,31,123,0.15)',
                color: '#E11F7B',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: '1px solid rgba(225,31,123,0.3)',
              }}
            >
              Ajouter
            </button>
          </div>
        </div>

        {/* Email list */}
        {emails.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {emails.map(e => (
              <div
                key={e}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>✉️ {e}</span>
                <button
                  onClick={() => removeEmail(e)}
                  style={{
                    width: 22, height: 22, borderRadius: 6, border: 'none',
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5,
        }}>
          💡 Les membres peuvent visualiser ce deck. L'édition reste privée.
        </div>
      </motion.div>
    </div>
  )
}

// ── DecksPage ─────────────────────────────────────────────────────────────────

export function DecksPage() {
  const navigate = useNavigate()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')

  // TK-0047 — Notion import modal
  const [showNotionModal, setShowNotionModal] = useState(false)

  // TK-0051 — Share modal
  const [shareModalDeck, setShareModalDeck] = useState<Deck | null>(null)

  useEffect(() => {
    fetchDecks()
  }, [])

  async function fetchDecks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('presentations')
      .select('id,title,description,status,slide_count,created_at,updated_at,published_url')
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setDecks(data as Deck[])
    } else if (error) {
      console.error('[DecksPage] fetch error:', error.message)
    }
    setLoading(false)
  }

  function handleNewDeck() {
    navigate('/decks/new')
  }

  const handleNotionGenerated = useCallback((deckId: string) => {
    setShowNotionModal(false)
    navigate(`/decks/${deckId}/edit`)
  }, [navigate])

  const filtered = decks.filter(d => {
    if (filter === 'shared') return d.status === 'published'
    if (filter === 'all') return d.status !== 'archived'
    return d.status === filter
  })

  const publishedCount = decks.filter(d => d.status === 'published').length
  const draftCount = decks.filter(d => d.status === 'draft').length

  const filterTabs: { key: FilterStatus; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'Tous', icon: <FileText size={13} />, count: decks.filter(d => d.status !== 'archived').length },
    { key: 'draft', label: 'Brouillons', icon: <FileText size={13} />, count: draftCount },
    { key: 'published', label: 'Publiés', icon: <Globe size={13} />, count: publishedCount },
    { key: 'shared', label: 'Partagés 🤝', icon: null, count: publishedCount },
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
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(225,31,123,0.08) 0%, transparent 70%)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 0 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
              title="Retour au Launchpad"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Presentation size={20} color="#E11F7B" />
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
                  Deck Builder
                </h1>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                {decks.filter(d => d.status !== 'archived').length} présentation{decks.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* TK-0047 — Notion import button */}
            <button
              onClick={() => setShowNotionModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              title="Importer depuis Notion"
            >
              📥 Notion
            </button>
            <button
              onClick={() => navigate('/templates')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              🧩 Templates
            </button>
            <button
              onClick={handleNewDeck}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(225,31,123,0.3)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              <Plus size={15} />
              Nouveau deck
            </button>
          </div>
        </div>

        {/* ── Filter tabs ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {filterTabs.map(tab => {
            const active = filter === tab.key
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
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                    background: active ? 'rgba(225,31,123,0.25)' : 'rgba(255,255,255,0.08)',
                    color: active ? '#E11F7B' : 'rgba(255,255,255,0.35)',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Shared banner ─────────────────────────────────────────────── */}
        {filter === 'shared' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 10, padding: '10px 16px', marginBottom: 20,
              fontSize: 13, color: 'rgba(255,255,255,0.55)',
            }}
          >
            🤝 <span>Ces decks sont partagés avec votre équipe. Cliquez sur <strong style={{ color: 'rgba(255,255,255,0.8)' }}>🔗 Partager</strong> pour gérer les accès.</span>
          </motion.div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Chargement des decks…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onNew={handleNewDeck} filter={filter} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
            gap: 16,
            paddingBottom: 40,
          }}>
            <AnimatePresence>
              {filtered.map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onClick={() => navigate(`/decks/${deck.id}/edit`)}
                  onShare={setShareModalDeck}
                  onAnalytics={(d) => navigate(`/decks/${d.id}/analytics`)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNotionModal && (
          <NotionImportModal
            onClose={() => setShowNotionModal(false)}
            onGenerated={handleNotionGenerated}
          />
        )}
        {shareModalDeck && (
          <ShareModal
            deck={shareModalDeck}
            onClose={() => setShareModalDeck(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default DecksPage
