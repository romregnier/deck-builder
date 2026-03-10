/**
 * urlAnalyzer.ts — Analyse une URL via Jina Reader + Gemini
 * DB-54
 *
 * Flow :
 * 1. Fetch le contenu texte via https://r.jina.ai/{url} (proxy gratuit, pas de CORS)
 * 2. Envoie le contenu à Gemini pour extraction structurée
 * 3. Retourne un brief prêt à pré-remplir + un outline de slides suggéré
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DeckAudience, DeckTonality, DeckTheme, SlideType } from '../types/deck'

const GOOGLE_AI_KEY = import.meta.env.VITE_GOOGLE_AI_KEY || 'AIzaSyDHlY3Vv-3scAAzLGTyZxHr1mK9Qgc1rho'

export interface URLAnalysisResult {
  title: string
  description: string
  audience: DeckAudience
  tonality: DeckTonality
  theme: DeckTheme
  keyFacts: string[]          // stats, chiffres clés extraits
  companyName?: string        // nom de l'entreprise/produit si détecté
  suggestedSlideCount: number
  suggestedOutline: Array<{ type: SlideType; title: string; hint: string }>
  rawSummary: string          // résumé brut pour affichage preview
}

/**
 * Valide et normalise une URL (ajoute https:// si manquant)
 */
export function normalizeURL(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('URL vide')
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Fetch le contenu texte d'une URL via Jina Reader
 */
async function fetchURLContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`
  const res = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'X-Return-Format': 'text',
    },
  })
  if (!res.ok) throw new Error(`Impossible d'analyser cette URL. Vérifiez qu'elle est accessible publiquement. (${res.status})`)
  const text = await res.text()
  if (!text || text.length < 100) throw new Error('Contenu trop court ou page inaccessible')
  // Tronquer à 8000 chars pour ne pas dépasser la fenêtre Gemini
  return text.slice(0, 8000)
}

/**
 * Analyse le contenu extrait via Gemini
 */
async function analyzeWithGemini(content: string, url: string): Promise<URLAnalysisResult> {
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

  const prompt = `Tu es un expert en présentation professionnelle. Analyse le contenu suivant extrait de la page web "${url}" et génère un brief complet pour créer une présentation professionnelle.

CONTENU DE LA PAGE :
---
${content}
---

Retourne UNIQUEMENT un objet JSON (pas de markdown) avec cette structure EXACTE :
{
  "title": "Titre concis de la présentation (max 60 chars)",
  "description": "Description complète de 80-200 mots expliquant le sujet, les points clés, et l'objectif de la présentation",
  "companyName": "Nom de l'entreprise ou du produit si détecté, sinon null",
  "audience": "Investisseur" | "Partenaire" | "Équipe" | "Client" | "Public",
  "tonality": "Formel" | "Neutre" | "Dynamique" | "Inspirant",
  "theme": "dark_premium" | "gradient_bold",
  "keyFacts": ["fait/stat clé 1", "fait/stat clé 2", "..."],
  "suggestedSlideCount": 8,
  "rawSummary": "Résumé en 2-3 phrases pour montrer ce qui a été compris",
  "suggestedOutline": [
    {"type": "hero", "title": "Titre hero slide", "hint": "Sous-titre ou accroche"},
    {"type": "content", "title": "...", "hint": "..."},
    {"type": "cta", "title": "...", "hint": "..."}
  ]
}

RÈGLES pour suggestedOutline :
- Toujours commencer par "hero" et finir par "cta"
- Entre 6 et 10 slides au total
- Types disponibles : hero, content, stats, features, team, pricing, roadmap, market, orbit, mockup, quote, cta
- Choisir les types qui font sens pour le contenu analysé
- "hint" = courte description de ce que contiendra cette slide (max 50 chars)
- Pour les slides "stats" : extraire les vrais chiffres de la page si disponibles
- Pour les slides "features" : extraire les vraies fonctionnalités si disponibles

EXEMPLES de thème selon le contenu :
- SaaS B2B / tech → dark_premium
- Corporate / finance → dark_premium
- Startup créative → gradient_bold
- Produit grand public → dark_premium

Note : utilise UNIQUEMENT "dark_premium" ou "gradient_bold" — les thèmes clairs ne sont pas encore supportés.`

  const result = await model.generateContent(prompt)
  const raw = result.response.text()

  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned) as URLAnalysisResult
    // Valider les champs obligatoires
    if (!parsed.title || !parsed.description) throw new Error('Champs manquants')
    // S'assurer que suggestedSlideCount correspond à l'outline
    parsed.suggestedSlideCount = parsed.suggestedOutline?.length ?? 8
    // Guard : les thèmes clairs ne sont pas supportés par le rendu (SlideRenderer hardcode des couleurs sombres)
    if (parsed.theme === 'light_clean' || parsed.theme === 'corporate') {
      parsed.theme = 'dark_premium'
    }
    return parsed
  } catch (e) {
    console.error('[urlAnalyzer] parse error:', e, raw)
    throw new Error("Impossible d'analyser la réponse de l'IA")
  }
}

/**
 * Point d'entrée principal
 */
export async function analyzeURL(rawUrl: string): Promise<URLAnalysisResult> {
  const url = normalizeURL(rawUrl)
  const content = await fetchURLContent(url)
  return analyzeWithGemini(content, url)
}
