/**
import { callGemini } from './geminiClient'
 * pdfAnalyzer.ts — Extraction de la charte graphique et du contenu depuis un PDF
 * Utilise Gemini pour analyser le PDF et retourner les couleurs / thème / slides détectés.
 */
import type { SlideType } from '../types/deck'


export interface ExtractedDA {
  primaryColor: string        // hex, ex: '#E11F7B'
  bgColor: string             // hex, ex: '#0B090D'
  fontStyle: 'Poppins' | 'Inter' | 'Playfair Display' | 'Space Grotesk'
  theme: 'dark_premium' | 'light_clean' | 'gradient_bold' | 'corporate'
  confidence: number          // 0-1
  notes: string               // ex: "Style sombre premium, typographie moderne"
}

/**
 * Convertit un ArrayBuffer en base64 de façon sécurisée (sans dépasser la pile d'appels).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Analyse un fichier PDF avec Gemini et extrait la charte graphique.
 */
export async function extractDAFromPDF(file: File): Promise<ExtractedDA> {
  // 1. Lire le fichier en base64
  const arrayBuffer = await file.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)

  // 2. Appel Gemini via proxy avec inline data (PDF)

  const prompt = `Analyse ce PDF de présentation et extrais la charte graphique.
Retourne UNIQUEMENT ce JSON (sans markdown) :
{
  "primaryColor": "#hexcolor",
  "bgColor": "#hexcolor",
  "fontStyle": "Poppins|Inter|Playfair Display|Space Grotesk",
  "theme": "dark_premium|light_clean|gradient_bold|corporate",
  "confidence": 0.0-1.0,
  "notes": "description courte du style détecté"
}

Règles :
- dark_premium = fond sombre (#0B090D ou similaire), accents vifs
- light_clean = fond blanc/clair, design épuré
- gradient_bold = gradients colorés, impact visuel fort
- corporate = tons froids, bleu/gris, professionnel classique
- Si le PDF n'a pas de couleurs dominantes claires, utilise #E11F7B pour primaryColor`

  const PROXY = import.meta.env.VITE_GEMINI_PROXY_URL || 'http://vps-b2edf054.vps.ovh.net:3099'
  const res = await fetch(`${PROXY}/generate-with-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mimeType: 'application/pdf', data: base64 }),
  })
  const { text: raw } = await res.json() as { text: string }

  return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()) as ExtractedDA
}

// ── Full presentation extraction ──────────────────────────────────────────────

export interface ExtractedSlide {
  type: SlideType
  title: string
  content: Record<string, unknown>   // contenu formaté prêt pour l'éditeur
}

export interface ExtractedPresentation {
  da: ExtractedDA
  slides: ExtractedSlide[]
  slideCount: number
}

/**
 * Analyse un PDF et extrait à la fois la DA ET le contenu complet de chaque slide.
 * Retourne des slides prêts à insérer dans l'éditeur sans passer par la génération IA.
 */
export async function extractFullPresentation(file: File): Promise<ExtractedPresentation> {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)



  const prompt = `Analyse cette présentation PDF et extrais TOUT son contenu.

Retourne UNIQUEMENT ce JSON (sans markdown, JSON pur) :
{
  "da": {
    "primaryColor": "#hexcolor",
    "bgColor": "#hexcolor",
    "fontStyle": "Poppins|Inter|Playfair Display|Space Grotesk",
    "theme": "dark_premium|light_clean|gradient_bold|corporate",
    "confidence": 0.0,
    "notes": "description courte du style"
  },
  "slides": [
    {
      "type": "hero",
      "title": "titre descriptif de la slide",
      "content": {
        "eyebrow": "accroche courte",
        "title": "titre principal de la slide",
        "subtitle": "sous-titre ou description"
      }
    },
    {
      "type": "content",
      "title": "titre descriptif",
      "content": {
        "label": "section label",
        "title": "titre de la slide",
        "body": "paragraphe de texte principal",
        "bullets": ["point 1", "point 2", "point 3"]
      }
    },
    {
      "type": "stats",
      "title": "titre descriptif",
      "content": {
        "title": "titre de la slide",
        "metrics": [
          {"value": "chiffre ou %", "label": "label"},
          {"value": "chiffre ou %", "label": "label"}
        ]
      }
    },
    {
      "type": "quote",
      "title": "titre descriptif",
      "content": {
        "text": "citation extraite du PDF",
        "author": "nom de l'auteur si présent",
        "role": "rôle ou titre si présent"
      }
    },
    {
      "type": "cta",
      "title": "titre descriptif",
      "content": {
        "title": "titre de la slide CTA",
        "subtitle": "sous-titre ou description",
        "buttonText": "texte du bouton d'action"
      }
    }
  ]
}

Règles importantes :
- Extrais TOUTES les slides du PDF dans l'ordre
- Pour chaque slide, détermine le type parmi : hero, content, stats, quote, cta
- Utilise "hero" pour la slide titre/couverture, "cta" pour la slide de conclusion
- Extrais le VRAI contenu textuel du PDF, ne l'invente pas
- Si une slide a des chiffres/métriques importants → type "stats"
- Si une slide a une citation → type "quote"
- Pour la DA : dark_premium=fond sombre, light_clean=fond blanc, gradient_bold=gradients colorés, corporate=bleu/gris professionnel`

  const PROXY2 = import.meta.env.VITE_GEMINI_PROXY_URL || 'http://vps-b2edf054.vps.ovh.net:3099'
  const res2 = await fetch(`${PROXY2}/generate-with-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mimeType: 'application/pdf', data: base64 }),
  })
  const { text: rawFull } = await res2.json() as { text: string }
  const raw = rawFull
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const parsed = JSON.parse(raw) as { da: ExtractedDA; slides: ExtractedSlide[] }

  return {
    da: parsed.da,
    slides: parsed.slides,
    slideCount: parsed.slides.length,
  }
}
