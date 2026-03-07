/**
 * useAnalytics.ts — Tracking de visualisation pour DeckPresentPage
 * Enregistre les vues dans la table `deck_views` Supabase :
 * - Création de la view au mount
 * - Tracking du temps passé par slide
 * - Finalisation au unmount / fermeture onglet
 */
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = 'https://tpbluellqgehaqmmmunp.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYmx1ZWxscWdlaGFxbW1tdW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzgxOTAsImV4cCI6MjA4Nzc1NDE5MH0.ePDzb1FsZKZPClL6nYSvDqqEsD3IBIMJwl38BlWqYSM'

function getViewerSessionId(): string {
  const key = 'deck_viewer_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

export function useAnalytics(deckId: string | undefined, currentSlideIdx: number) {
  const viewIdRef = useRef<string | null>(null)
  const prevIdxRef = useRef(currentSlideIdx)
  const slideStartRef = useRef(Date.now())
  const timingRef = useRef<Record<string, number>>({})
  const seenRef = useRef<Set<number>>(new Set([currentSlideIdx]))
  const finalizedRef = useRef(false)

  // Init view on mount
  useEffect(() => {
    if (!deckId) return
    finalizedRef.current = false

    supabase
      .from('deck_views')
      .insert({
        deck_id: deckId,
        session_id: getViewerSessionId(),
        referrer: document.referrer || null,
        user_agent: navigator.userAgent.slice(0, 200),
      })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) viewIdRef.current = data.id
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId])

  // Track slide change — accumulate time on previous slide
  useEffect(() => {
    const elapsed = Math.round((Date.now() - slideStartRef.current) / 1000)
    const prevKey = String(prevIdxRef.current)
    timingRef.current[prevKey] = (timingRef.current[prevKey] || 0) + elapsed
    prevIdxRef.current = currentSlideIdx
    slideStartRef.current = Date.now()
    seenRef.current.add(currentSlideIdx)
  }, [currentSlideIdx])

  // Finalize on unmount / tab hidden / beforeunload
  useEffect(() => {
    if (!deckId) return

    const finalize = () => {
      if (finalizedRef.current || !viewIdRef.current) return
      finalizedRef.current = true

      // Accumulate time on current slide
      const elapsed = Math.round((Date.now() - slideStartRef.current) / 1000)
      const key = String(prevIdxRef.current)
      timingRef.current[key] = (timingRef.current[key] || 0) + elapsed

      const duration = Object.values(timingRef.current).reduce((a, b) => a + b, 0)
      const body = JSON.stringify({
        ended_at: new Date().toISOString(),
        duration_sec: duration,
        slide_count_seen: seenRef.current.size,
        slides_timing: timingRef.current,
      })

      // keepalive fetch survives tab close
      fetch(`${SUPABASE_URL}/rest/v1/deck_views?id=eq.${viewIdRef.current}`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Prefer': 'return=minimal',
        },
        body,
      }).catch(() => {})
    }

    const onHidden = () => {
      if (document.visibilityState === 'hidden') finalize()
    }

    window.addEventListener('beforeunload', finalize)
    document.addEventListener('visibilitychange', onHidden)

    return () => {
      finalize()
      window.removeEventListener('beforeunload', finalize)
      document.removeEventListener('visibilitychange', onHidden)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId])
}
