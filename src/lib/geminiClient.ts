/**
 * geminiClient.ts — Client proxy sécurisé pour Gemini
 * Les appels passent par le proxy VPS (clé serveur-side, jamais dans le bundle)
 */

const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL || 'http://vps-b2edf054.vps.ovh.net:3099'

export interface GeminiResponse {
  text: string
}

export async function callGemini(
  prompt: string,
  options: {
    system?: string
    model?: string
    temperature?: number
  } = {}
): Promise<string> {
  const res = await fetch(`${PROXY_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'gemini-flash-lite-latest',
      system: options.system,
      prompt,
      temperature: options.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`[Gemini proxy] ${err.error || res.statusText}`)
  }

  const data = await res.json() as GeminiResponse
  return data.text
}
