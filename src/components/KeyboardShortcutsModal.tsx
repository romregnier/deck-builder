/**
 * KeyboardShortcutsModal.tsx — DB-45
 * Modal "?" listant tous les raccourcis clavier du deck editor.
 * Fermeture : Escape ou clic extérieur.
 */
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  label: string
}

interface ShortcutCategory {
  title: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['←'], label: 'Slide précédente' },
      { keys: ['→'], label: 'Slide suivante' },
    ],
  },
  {
    title: 'Édition',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], label: 'Annuler (Undo)' },
      { keys: ['Ctrl', 'Y'], label: 'Rétablir (Redo)' },
      { keys: ['Ctrl', '⇧', 'Z'], label: 'Rétablir (Redo)' },
      { keys: ['Ctrl', 'D'], label: 'Dupliquer la slide' },
      { keys: ['Suppr'], label: 'Supprimer la slide active' },
      { keys: ['Esc'], label: 'Désélectionner le champ en édition' },
    ],
  },
  {
    title: 'Présentation',
    shortcuts: [
      { keys: ['Ctrl', '↵'], label: 'Lancer la présentation' },
      { keys: ['?'], label: 'Afficher ce cheat sheet' },
    ],
  },
]

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  // Fermeture sur Escape
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="kbd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            key="kbd-modal"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1E1B21',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16,
              padding: '28px 32px',
              width: 'min(90vw, 480px)',
              maxHeight: '85vh',
              overflowY: 'auto',
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#F5F0F7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'rgba(225,31,123,0.15)',
                    border: '1px solid rgba(225,31,123,0.3)',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#E11F7B',
                  }}>?</span>
                  Raccourcis clavier
                </h2>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  Deck Editor — tous les raccourcis
                </p>
              </div>
              <button
                onClick={onClose}
                title="Fermer (Escape)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {SHORTCUT_CATEGORIES.map(category => (
                <div key={category.title}>
                  {/* Category title */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#E11F7B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: '1px solid rgba(225,31,123,0.2)',
                  }}>
                    {category.title}
                  </div>

                  {/* Shortcuts list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {category.shortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span style={{
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.7)',
                        }}>
                          {shortcut.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {shortcut.keys.map((key, ki) => (
                            <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <kbd style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 28,
                                height: 24,
                                padding: '0 7px',
                                borderRadius: 5,
                                background: '#2C272F',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderBottom: '2px solid rgba(255,255,255,0.08)',
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: 'system-ui, monospace',
                                color: '#F5F0F7',
                                whiteSpace: 'nowrap',
                              }}>
                                {key}
                              </kbd>
                              {ki < shortcut.keys.length - 1 && (
                                <span style={{
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,0.3)',
                                  marginRight: 2,
                                }}>+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.25)',
              textAlign: 'center',
            }}>
              Appuyez sur <kbd style={{
                display: 'inline-flex', alignItems: 'center', padding: '0 6px',
                borderRadius: 4, background: '#2C272F', border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              }}>Esc</kbd> ou cliquez à l&apos;extérieur pour fermer
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
