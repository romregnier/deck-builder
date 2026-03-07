/**
 * DeckAnalyticsPage.tsx — Dashboard analytics pour un deck
 * Route : /decks/:id/analytics
 *
 * Métriques depuis table `deck_views` :
 * - Total vues, visiteurs uniques, durée moyenne, taux de complétion
 * - Heatmap par slide (temps moyen passé)
 * - Graphique vues par jour (7 derniers jours)
 * - Tableau sessions récentes (20 dernières)
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Eye, Edit2, BarChart2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeckView {
  id: string
  deck_id: string
  session_id: string
  started_at: string
  ended_at: string | null
  duration_sec: number | null
  slide_count_seen: number | null
  slides_timing: Record<string, number> | null
  referrer: string | null
  user_agent: string | null
}

interface DeckInfo {
  id: string
  title: string
  slide_count: number | null
  status: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s.toString().padStart(2, '0')}s` : `${s}s`
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs}h`
  return `Il y a ${Math.floor(hrs / 24)}j`
}

function formatReferrer(ref: string | null): string {
  if (!ref) return 'Direct'
  try {
    const url = new URL(ref)
    return url.hostname || ref
  } catch {
    return ref.slice(0, 30)
  }
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({
  emoji,
  value,
  label,
  sub,
}: {
  emoji: string
  value: string | number
  label: string
  sub?: string
}) {
  return (
    <div style={{
      background: '#2C272F',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px 24px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
      <div style={{
        fontSize: 28, fontWeight: 800,
        color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── BarChart SVG (vues par jour) ──────────────────────────────────────────────

interface DayCount {
  day: string
  label: string
  count: number
}

function ViewsBarChart({ data }: { data: DayCount[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const W = 320
  const H = 120
  const barW = 32
  const gap = (W - barW * data.length) / (data.length + 1)
  const accentColor = '#E11F7B'

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} style={{ display: 'block', overflow: 'visible' }}>
      {data.map((d, i) => {
        const x = gap + i * (barW + gap)
        const barH = Math.max(4, (d.count / maxCount) * H)
        const y = H - barH
        return (
          <g key={d.day}>
            <rect
              x={x} y={y} width={barW} height={barH}
              rx={6}
              fill={d.count > 0 ? `url(#grad-${i})` : 'rgba(255,255,255,0.06)'}
            />
            <defs>
              <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            {d.count > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={10}
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2} y={H + 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.3)"
              fontSize={9}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── DeckAnalyticsPage ─────────────────────────────────────────────────────────

export function DeckAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckInfo | null>(null)
  const [views, setViews] = useState<DeckView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) fetchData(id)
  }, [id])

  async function fetchData(deckId: string) {
    setLoading(true)

    const [deckRes, viewsRes] = await Promise.all([
      supabase
        .from('presentations')
        .select('id,title,slide_count,status')
        .eq('id', deckId)
        .single(),
      supabase
        .from('deck_views')
        .select('*')
        .eq('deck_id', deckId)
        .order('started_at', { ascending: false }),
    ])

    if (deckRes.data) setDeck(deckRes.data as DeckInfo)
    if (viewsRes.data) setViews(viewsRes.data as DeckView[])

    setLoading(false)
  }

  // ── Métriques ──────────────────────────────────────────────────────────────

  const totalViews = views.length
  const completedViews = views.filter(v => v.ended_at !== null).length
  const uniqueVisitors = new Set(views.map(v => v.session_id)).size
  const completedWithDuration = views.filter(v => v.duration_sec !== null && v.duration_sec > 0)
  const avgDuration = completedWithDuration.length > 0
    ? Math.round(completedWithDuration.reduce((a, v) => a + (v.duration_sec ?? 0), 0) / completedWithDuration.length)
    : null
  const completionRate = totalViews > 0 ? Math.round((completedViews / totalViews) * 100) : 0
  const totalSlides = deck?.slide_count ?? 1

  // ── Heatmap slides ─────────────────────────────────────────────────────────

  const heatmap: Record<number, number> = {}
  views.forEach(view => {
    if (!view.slides_timing) return
    Object.entries(view.slides_timing).forEach(([idx, sec]) => {
      const i = Number(idx)
      heatmap[i] = (heatmap[i] || 0) + sec
    })
  })
  const avgHeatmap: Record<number, number> = {}
  const divisor = Math.max(completedWithDuration.length, 1)
  Object.entries(heatmap).forEach(([idx, total]) => {
    avgHeatmap[Number(idx)] = Math.round(total / divisor)
  })
  const maxSec = Math.max(...Object.values(avgHeatmap), 1)

  // ── Vues par jour (7 derniers jours) ───────────────────────────────────────

  const last7Days: DayCount[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const day = d.toISOString().split('T')[0]
    return {
      day,
      label: d.toLocaleDateString('fr', { weekday: 'short', day: 'numeric' }),
      count: views.filter(v => v.started_at.startsWith(day)).length,
    }
  })

  // ── Recent sessions (20 dernières) ────────────────────────────────────────

  const recentViews = views.slice(0, 20)

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0B090D',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: 'Poppins, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Chargement des analytics…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B090D',
      color: '#FFFFFF',
      fontFamily: 'Poppins, sans-serif',
    }}>
      {/* Gradient bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(225,31,123,0.07) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '28px 0 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate(`/decks/${id}/edit`)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              }}
              title="Retour à l'éditeur"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={20} color="#E11F7B" />
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                  Analytics
                </h1>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                {deck?.title || '—'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate(`/decks/${id}/present`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Eye size={13} />
              Aperçu
            </button>
            <button
              onClick={() => navigate(`/decks/${id}/edit`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, #E11F7B, #c41a6a)',
                color: '#fff',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(225,31,123,0.3)',
              }}
            >
              <Edit2 size={13} />
              Éditer
            </button>
          </div>
        </div>

        {/* ── Metrics cards ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <MetricCard
            emoji="👁"
            value={totalViews}
            label="Vues totales"
            sub={totalViews === 0 ? 'Aucune vue pour l\'instant' : undefined}
          />
          <MetricCard
            emoji="👤"
            value={uniqueVisitors}
            label="Visiteurs uniques"
            sub={uniqueVisitors > 0 ? `Session ID distincts` : undefined}
          />
          <MetricCard
            emoji="⏱"
            value={formatDuration(avgDuration)}
            label="Durée moyenne"
            sub={completedWithDuration.length > 0 ? `Sur ${completedWithDuration.length} sessions complétées` : 'Aucune session complète'}
          />
          <MetricCard
            emoji="📊"
            value={`${completionRate}%`}
            label="Taux de complétion"
            sub={completedViews > 0 ? `${completedViews} / ${totalViews} sessions` : undefined}
          />
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

          {/* Slide heatmap */}
          <div style={{
            background: '#2C272F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px 24px',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'rgba(255,255,255,0.85)' }}>
              🔥 Engagement par slide
            </h2>
            {totalSlides === 0 || Object.keys(avgHeatmap).length === 0 ? (
              <div style={{
                padding: '32px 0', textAlign: 'center',
                color: 'rgba(255,255,255,0.25)', fontSize: 13,
              }}>
                Pas encore de données de slides
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: totalSlides }, (_, i) => {
                  const sec = avgHeatmap[i] || 0
                  const pct = (sec / maxSec) * 100
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 56, fontSize: 11, color: 'rgba(255,255,255,0.4)',
                        flexShrink: 0, fontWeight: 600,
                      }}>
                        Slide {i + 1}
                      </div>
                      <div style={{
                        flex: 1, height: 8, borderRadius: 4,
                        background: 'rgba(255,255,255,0.06)',
                      }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4,
                          background: `linear-gradient(90deg, #E11F7B, ${pct > 70 ? '#E11F7B' : '#7C3AED'})`,
                          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                          minWidth: pct > 0 ? 4 : 0,
                        }} />
                      </div>
                      <div style={{
                        width: 36, fontSize: 11,
                        color: 'rgba(255,255,255,0.35)', textAlign: 'right', flexShrink: 0,
                      }}>
                        {sec > 0 ? `${sec}s` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Views per day */}
          <div style={{
            background: '#2C272F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '20px 24px',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'rgba(255,255,255,0.85)' }}>
              📅 Vues par jour (7 jours)
            </h2>
            <ViewsBarChart data={last7Days} />
            <div style={{
              marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Total 7j : {last7Days.reduce((a, d) => a + d.count, 0)} vue{last7Days.reduce((a, d) => a + d.count, 0) !== 1 ? 's' : ''}</span>
              {last7Days.reduce((a, d) => a + d.count, 0) > 0 && (
                <span>Mieux : {last7Days.reduce((best, d) => d.count > best.count ? d : best, last7Days[0]).label}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Recent sessions table ───────────────────────────────────────── */}
        <div style={{
          background: '#2C272F',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '20px 24px',
          marginBottom: 40,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'rgba(255,255,255,0.85)' }}>
            🕐 Sessions récentes
          </h2>

          {recentViews.length === 0 ? (
            <div style={{
              padding: '32px 0', textAlign: 'center',
              color: 'rgba(255,255,255,0.25)', fontSize: 13,
            }}>
              Aucune session enregistrée
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 13,
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Date', 'Durée', 'Slides vues', 'Complété', 'Référent'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 12px',
                        color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentViews.map((view, i) => (
                    <tr
                      key={view.id}
                      style={{
                        borderBottom: i < recentViews.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}
                    >
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>
                        {timeAgo(view.started_at)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        {formatDuration(view.duration_sec)}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>
                        {view.slide_count_seen != null
                          ? `${view.slide_count_seen} / ${totalSlides}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {view.ended_at ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: '#10B981',
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.25)',
                            borderRadius: 6, padding: '2px 8px',
                          }}>
                            ✅ Terminé
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: 'rgba(255,255,255,0.35)',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 6, padding: '2px 8px',
                          }}>
                            ⏸ En cours
                          </span>
                        )}
                      </td>
                      <td style={{
                        padding: '10px 12px',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 12,
                        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {formatReferrer(view.referrer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeckAnalyticsPage
