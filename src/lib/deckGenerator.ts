/**
 * deckGenerator.ts — Pipeline de génération IA pour les decks
 * TK-0033 / TK-0032 (generateOutline + storyboard)
 *
 * Utilise @google/generative-ai (Gemini) pour générer les slides
 * puis insère le résultat dans Supabase.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase'
import type { DeckBrief, DeckJSON, SlideJSON, SlideType } from '../types/deck'

const GOOGLE_AI_KEY = import.meta.env.VITE_GOOGLE_AI_KEY || 'AIzaSyDHlY3Vv-3scAAzLGTyZxHr1mK9Qgc1rho'

// ── Outline types ─────────────────────────────────────────────────────────────

export interface SlideOutline {
  type: SlideType
  title: string           // titre descriptif pour l'outline
  customPrompt?: string   // instructions spécifiques pour cette slide (optionnel)
}

/**
 * Génère un outline léger (titres + types des slides) via Gemini.
 * Rapide (~1 seconde), sans contenu complet.
 */
export async function generateOutline(brief: DeckBrief): Promise<SlideOutline[]> {
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

  const prompt = `Tu es un expert en présentation professionnelle.
Génère un outline de deck pour le sujet suivant:

Titre: ${brief.title}
Description: ${brief.description}
Audience: ${brief.audience}
Tonalité: ${brief.tonality}
Langue: ${brief.lang}
Nombre de slides: ${brief.slideCount}

CONTRAINTES:
- La première slide doit être de type "hero"
- La dernière slide doit être de type "cta"
- Entre les deux: utilise content, stats, quote, chart, timeline, comparison selon ce qui fait sens
- Types disponibles: hero | content | stats | quote | cta | chart | timeline | comparison
- Pour une slide "chart", spécifie "chartType": "bar" | "line" | "pie" | "donut" et "data": [{"label":"...","value":N},...]
- Pour une slide "timeline": utilise pour montrer une évolution chronologique ou un historique
- Pour une slide "comparison": utilise pour comparer deux options, avant/après, concurrent/nous

Retourne UNIQUEMENT un JSON array avec exactement ${brief.slideCount} objets:
[{"type":"hero","title":"Titre descriptif de la slide"},{"type":"content","title":"..."},...]

Pas de markdown, pas de commentaires. JSON pur.`

  const result = await model.generateContent(prompt)
  const rawText = result.response.text()

  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    const outline = JSON.parse(cleaned) as SlideOutline[]
    if (!Array.isArray(outline)) throw new Error('Not an array')
    return outline
  } catch (e) {
    console.error('[generateOutline] parse error:', e, rawText)
    // Fallback outline
    const fallback: SlideOutline[] = [
      { type: 'hero', title: brief.title },
      ...Array.from({ length: brief.slideCount - 2 }, (_, i) => ({
        type: (i % 3 === 0 ? 'content' : i % 3 === 1 ? 'stats' : 'quote') as SlideType,
        title: `Section ${i + 2}`,
      })),
      { type: 'cta', title: 'Passez à l\'action' },
    ]
    return fallback
  }
}

const SYSTEM_PROMPT = `Tu es un expert en présentation professionnelle. Génère un deck de présentation au format JSON strict.
Le deck doit être visuellement impactant avec du VRAI contenu (pas de placeholders Lorem Ipsum).
Chaque slide doit avoir du contenu réel, concret et adapté au sujet donné.
La première slide est toujours de type "hero", la dernière toujours de type "cta".
Entre les deux: alterne content, stats, quote, chart, timeline, comparison selon ce qui fait sens pour le sujet.
Pour une slide de type "chart": inclure "chartType" ("bar" | "line" | "pie" | "donut") et "data" ([{"label":"...","value":N}]).
Pour une slide de type "timeline": inclure "title" et "events" ([{"year":"2020","label":"Étape","desc":"Description optionnelle"}]).
Pour une slide de type "comparison": inclure "title", "left" ({label, items:[]}) et "right" ({label, items:[]}).
Retourne UNIQUEMENT le JSON, sans markdown, sans commentaires.`

export type GenerationProgress = {
  step: 'structuring' | 'writing' | 'finalizing' | 'saving'
  pct: number
  message: string
}

export type ProgressCallback = (progress: GenerationProgress) => void

/**
 * Génère un deck complet via Gemini et l'insère dans Supabase.
 * Si outline est fourni, l'utilise comme guide de structure.
 * Retourne l'ID du deck créé.
 */
export async function generateDeck(
  brief: DeckBrief,
  onProgress?: ProgressCallback,
  outline?: SlideOutline[]
): Promise<string> {
  const themeMap: Record<string, string> = {
    dark_premium: 'DARK_PREMIUM',
    light_clean: 'LIGHT_CLEAN',
    gradient_bold: 'GRADIENT_BOLD',
    corporate: 'CORPORATE',
  }

  onProgress?.({ step: 'structuring', pct: 10, message: 'Structuration du contenu...' })

  const userPrompt = `Génère un deck de présentation professionnel sur le sujet suivant:

Titre: ${brief.title}
Description: ${brief.description}
Audience: ${brief.audience}
Tonalité: ${brief.tonality}
Langue: ${brief.lang}
Nombre de slides: ${brief.slideCount}
Thème visuel: ${themeMap[brief.theme] || 'DARK_PREMIUM'}

Structure JSON attendue:
{
  "title": "string",
  "theme": "${themeMap[brief.theme] || 'DARK_PREMIUM'}",
  "slides": [
    {
      "type": "hero",
      "position": 1,
      "content": {
        "eyebrow": "string (catégorie/accroche courte)",
        "title": "string (titre principal)",
        "subtitle": "string (sous-titre)"
      }
    },
    {
      "type": "content",
      "position": 2,
      "content": {
        "label": "string",
        "title": "string",
        "body": "string",
        "bullets": ["point 1", "point 2", "point 3"]
      }
    },
    {
      "type": "stats",
      "position": 3,
      "content": {
        "title": "string",
        "metrics": [
          {"value": "chiffre", "label": "label"},
          {"value": "chiffre", "label": "label"},
          {"value": "chiffre", "label": "label"},
          {"value": "chiffre", "label": "label"}
        ]
      }
    },
    {
      "type": "quote",
      "position": 4,
      "content": {
        "text": "citation inspirante",
        "author": "Nom Auteur",
        "role": "Titre/Rôle"
      }
    },
    {
      "type": "chart",
      "position": 5,
      "content": {
        "title": "string",
        "chartType": "bar",
        "data": [{"label": "label1", "value": 42}, {"label": "label2", "value": 78}]
      }
    },
    {
      "type": "timeline",
      "position": 6,
      "content": {
        "title": "Notre parcours",
        "events": [
          {"year": "2020", "label": "Création", "desc": "Lancement de la société"},
          {"year": "2021", "label": "First client", "desc": "500k€ ARR"},
          {"year": "2023", "label": "Série A", "desc": "5M€ levés"},
          {"year": "2024", "label": "Scale", "desc": "30 pays"}
        ]
      }
    },
    {
      "type": "comparison",
      "position": 7,
      "content": {
        "title": "Pourquoi nous plutôt qu'eux ?",
        "left": {
          "label": "Concurrent",
          "items": ["Lent à mettre en place", "Prix élevé", "Pas de support", "Données silotées"]
        },
        "right": {
          "label": "Notre solution",
          "items": ["Setup en 10 minutes", "Usage-based pricing", "Support 24/7", "Données unifiées"]
        }
      }
    },
    {
      "type": "cta",
      "position": ${brief.slideCount},
      "content": {
        "title": "string",
        "subtitle": "string",
        "buttonText": "string"
      }
    }
  ]
}

Génère exactement ${brief.slideCount} slides. Assure-toi que le contenu est réel, concret et pertinent pour le sujet.${outline && outline.length > 0 ? `

OUTLINE VALIDÉ PAR L'UTILISATEUR (respecte exactement cette structure):
${outline.map((o, i) => `  ${i + 1}. [${o.type.toUpperCase()}] ${o.title}`).join('\n')}

Génère les slides dans CET ORDRE EXACT, avec CES TYPES et en t'inspirant de CES TITRES.

${outline.map((s, i) => `Slide ${i + 1} (${s.type}): "${s.title}"${s.customPrompt ? ` — Instructions spécifiques: "${s.customPrompt}"` : ''}`).join('\n')}` : ''}`

  onProgress?.({ step: 'writing', pct: 30, message: 'Rédaction des slides...' })

  // Appel Gemini
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: userPrompt },
  ])

  const rawText = result.response.text()

  onProgress?.({ step: 'finalizing', pct: 60, message: 'Finalisation...' })

  // Parse JSON — nettoyer les éventuels blocs markdown
  let deckJSON: DeckJSON
  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    deckJSON = JSON.parse(cleaned) as DeckJSON
  } catch (e) {
    console.error('[deckGenerator] JSON parse error:', e)
    console.error('[deckGenerator] Raw response:', rawText)
    throw new Error('La génération IA a retourné un format invalide. Réessayez.')
  }

  // Valider la structure
  if (!deckJSON.slides || !Array.isArray(deckJSON.slides)) {
    throw new Error('Structure JSON invalide: slides manquants.')
  }

  onProgress?.({ step: 'saving', pct: 80, message: 'Sauvegarde dans la base...' })

  // Insert présentation dans Supabase
  const { data: presentation, error: presError } = await supabase
    .from('presentations')
    .insert({
      title: deckJSON.title || brief.title,
      description: brief.description,
      // FIX I2 — stocker lang dans theme_json pour y accéder depuis l'éditeur
      // FIX I3 — conserver accentColor + preset du brief (template ou URL analyzer)
      theme_json: JSON.stringify({
        preset: deckJSON.theme || themeMap[brief.theme],
        lang: brief.lang,
        ...(brief.accentColor ? { accentColor: brief.accentColor } : {}),
      }),
      status: 'draft',
      slide_count: deckJSON.slides.length,
    })
    .select()
    .single()

  if (presError || !presentation) {
    console.error('[deckGenerator] Supabase insert error:', presError)
    throw new Error(`Erreur de sauvegarde: ${presError?.message || 'inconnue'}`)
  }

  const deckId = presentation.id as string

  // Insert les slides
  const slidesPayload = deckJSON.slides.map((slide: SlideJSON, idx: number) => ({
    deck_id: deckId,
    position: slide.position ?? idx + 1,
    type: slide.type,
    content_json: slide.content,
  }))

  const { error: slidesError } = await supabase
    .from('slides')
    .insert(slidesPayload)

  if (slidesError) {
    console.error('[deckGenerator] Slides insert error:', slidesError)
    throw new Error(`Erreur d'insertion des slides: ${slidesError.message}`)
  }

  onProgress?.({ step: 'saving', pct: 100, message: 'Deck créé !' })

  return deckId
}

/**
 * Régénère une slide individuelle via Gemini.
 * FIX F — lang transmis pour respecter la langue du deck
 */
export async function regenerateSlide(
  deckTitle: string,
  slideType: string,
  currentContent: Record<string, unknown>,
  lang?: string  // FIX F — langue du deck
): Promise<Record<string, unknown>> {
  const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' })

  // FIX F — instruction de langue
  const langInstruction = lang === 'English'
    ? 'Generate the content in English.'
    : 'Génère le contenu en français.'

  const prompt = `${langInstruction}

Pour le deck "${deckTitle}", régénère le contenu de cette slide de type "${slideType}".
Contenu actuel: ${JSON.stringify(currentContent, null, 2)}

Génère un contenu amélioré au format JSON pour ce type de slide.
Retourne UNIQUEMENT le JSON de la propriété "content", sans markdown.`

  const result = await model.generateContent(prompt)
  const rawText = result.response.text()

  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error('Régénération échouée — format invalide.')
  }
}

// ── Import depuis PDF (bypass génération IA) ──────────────────────────────────

import type { ExtractedSlide } from './pdfAnalyzer'

/**
 * Importe une présentation extraite d'un PDF directement dans Supabase,
 * sans passer par la génération IA de contenu.
 */
export async function importDeck(
  brief: DeckBrief,
  slides: ExtractedSlide[],
  onProgress?: ProgressCallback
): Promise<string> {
  onProgress?.({ step: 'structuring', pct: 20, message: 'Préparation de l\'import...' })

  // 1. Créer la présentation
  const { data: deck, error: deckError } = await supabase
    .from('presentations')
    .insert({
      title: brief.title || 'Présentation importée',
      description: brief.description || '',
      theme_json: { preset: brief.theme || 'dark_premium', accentColor: brief.accentColor },
      status: 'draft',
      slide_count: slides.length,
    })
    .select('id')
    .single()

  if (deckError || !deck) throw new Error('Erreur création présentation : ' + deckError?.message)

  onProgress?.({ step: 'writing', pct: 50, message: 'Import des slides...' })

  // 2. Insérer les slides directement
  const slidesPayload = slides.map((slide, idx) => ({
    deck_id: deck.id,
    position: idx + 1,  // B8 fix: 1-indexed, cohérent avec generateDeck et addSlide
    type: slide.type,
    content_json: slide.content,
    notes: slide.title,
  }))

  const { error: slidesError } = await supabase.from('slides').insert(slidesPayload)
  if (slidesError) throw new Error('Erreur import slides : ' + slidesError.message)

  onProgress?.({ step: 'saving', pct: 90, message: 'Finalisation...' })

  return deck.id
}
