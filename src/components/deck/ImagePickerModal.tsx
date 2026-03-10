/**
 * ImagePickerModal — Choisir une image : upload fichier ou recherche Unsplash
 * Unsplash Source API (source.unsplash.com) — sans clé API requise
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Search, X, RefreshCw } from 'lucide-react'

interface ImagePickerModalProps {
  onSelect: (url: string) => void
  onClose: () => void
  initialQuery?: string  // suggestion auto basée sur le contenu de la slide
}

const GRID_COUNT = 9

// Loremflickr — keyword-based, sans clé API, stable avec lock={n}
function getImageUrl(query: string, lock: number, w = 600, h = 400) {
  const keyword = encodeURIComponent((query.trim() || 'abstract').split(' ').slice(0, 3).join(','))
  return `https://loremflickr.com/${w}/${h}/${keyword}?lock=${lock}`
}

function ImageThumb({ query, lock, onSelect }: {
  query: string; lock: number; onSelect: (url: string) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const src = getImageUrl(query, lock, 400, 280)
  const fullSrc = getImageUrl(query, lock, 1200, 800)

  return (
    <button
      onClick={() => !error && onSelect(fullSrc)}
      style={{
        border: '2px solid transparent',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: error ? 'not-allowed' : 'pointer',
        background: 'rgba(255,255,255,0.06)',
        padding: 0,
        aspectRatio: '4/3',
        position: 'relative',
        transition: 'border-color 0.15s, transform 0.15s',
        opacity: error ? 0.4 : 1,
      }}
      onMouseEnter={e => {
        if (error) return
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#E11F7B'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
      }}
    >
      {!loaded && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(225,31,123,0.3)',
            borderTopColor: '#E11F7B',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>🖼️</div>
      )}
      <img
        src={src}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        fontSize: 8, color: 'rgba(255,255,255,0.4)',
        background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: 3,
      }}>
        Flickr
      </div>
    </button>
  )
}

export function ImagePickerModal({ onSelect, onClose, initialQuery = '' }: ImagePickerModalProps) {
  const [tab, setTab] = useState<'search' | 'upload'>(initialQuery ? 'search' : 'search')
  const [query, setQuery] = useState(initialQuery)
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialQuery) setActiveQuery(initialQuery)
  }, [initialQuery])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setActiveQuery(query)
    setRefreshKey(k => k + 1)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      alert('Image trop lourde (max 4 Mo)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onSelect(reader.result as string)
    reader.readAsDataURL(file)
  }

  const sigs = Array.from({ length: GRID_COUNT }, (_, i) => refreshKey * GRID_COUNT + i + 1)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#2C272F',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 20,
          width: '100%', maxWidth: 680,
          maxHeight: '88vh', overflow: 'auto',
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F5F0F7', margin: 0 }}>
            📷 Ajouter une illustration
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3 }}>
          {[
            { id: 'search', icon: <Search size={13} />, label: 'Photos Unsplash' },
            { id: 'upload', icon: <Upload size={13} />, label: 'Uploader' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'search' | 'upload')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: tab === t.id ? '#E11F7B' : 'transparent',
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: 600, fontFamily: 'Poppins, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Search bar */}
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Ex: startup, technology, nature, japan..."
                    autoFocus
                    autoComplete="off"
                    style={{
                      width: '100%', padding: '8px 12px 8px 32px',
                      borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)', color: '#F5F0F7',
                      fontSize: 13, fontFamily: 'Poppins, sans-serif', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  Chercher
                </button>
                <button
                  type="button"
                  onClick={() => setRefreshKey(k => k + 1)}
                  title="Nouvelles photos"
                  style={{
                    padding: '8px 10px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} />
                </button>
              </form>

              {/* Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}>
                {sigs.map(lock => (
                  <ImageThumb
                    key={`${activeQuery}-${lock}`}
                    query={activeQuery || 'abstract'}
                    lock={lock}
                    onSelect={url => { onSelect(url); onClose() }}
                  />
                ))}
              </div>

              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 12, margin: '12px 0 0' }}>
                Photos par <a href="https://www.flickr.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.4)' }}>Flickr</a> via loremflickr.com
              </p>
            </motion.div>
          )}

          {tab === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed rgba(225,31,123,0.3)',
                  borderRadius: 12, padding: '48px 24px',
                  textAlign: 'center', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#E11F7B'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(225,31,123,0.05)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(225,31,123,0.3)'
                  ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <Upload size={32} style={{ color: '#E11F7B', opacity: 0.6, marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#F5F0F7', margin: '0 0 6px' }}>
                  Cliquer pour choisir un fichier
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                  JPG, PNG, WebP — max 4 Mo
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
