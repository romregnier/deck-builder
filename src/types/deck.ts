// ── Deck Builder Types ────────────────────────────────────────────────────────

export type SlideType = 'hero' | 'content' | 'stats' | 'quote' | 'cta' | 'chart' | 'timeline' | 'comparison' | 'features' | 'pricing' | 'team' | 'roadmap' | 'market' | 'orbit' | 'mockup'
export type DeckTheme = 'dark_premium' | 'light_clean' | 'gradient_bold' | 'corporate'
export type SlideTransition = 'fade' | 'slide-up' | 'scale'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

export interface DeckThemeJSON {
  preset: string
  accentColor?: string
  bgColor?: string
  accentGradient?: string
  textColor?: string
  gradientText?: boolean
  glowEffect?: boolean
  fontSize?: FontSize
  transition?: SlideTransition
  // Sprint 3 — Animations & Couleurs
  noiseEnabled?: boolean
  noiseOpacity?: number          // 0–1, défaut 0.04
  animationStagger?: 0 | 50 | 100 | 200  // ms entre éléments
  secondaryAccent?: string       // 2ème couleur hex
  textPrimary?: string           // hex, défaut '#F5F0F7'
  textSecondary?: string         // hex ou 'auto'
  // Sprint 4 — Fonds animés
  bgAnimation?: 'galaxy' | 'particles' | 'aurora' | 'matrix' | 'bokeh' | 'geometric' | 'waves' | 'sakura' | 'mist' | 'leaves' | 'minimal' | 'fireflies' | 'none'
  // rétrocompat : galaxyBg=true → bgAnimation='galaxy'
  galaxyBg?: boolean
  // Sprint 5 — Police + Langue
  fontFamily?: 'Poppins' | 'Inter' | 'DM Sans' | 'Space Grotesk' | 'Syne'
  lang?: 'Français' | 'English'
  // DB-08 — Direction artistique
  da?: 'editorial' | 'neon' | 'soft' | 'terminal'
}
export type DeckAudience = 'Investisseur' | 'Partenaire' | 'Équipe' | 'Client' | 'Public'
export type DeckTonality = 'Formel' | 'Neutre' | 'Dynamique' | 'Inspirant'
export type DeckLang = 'Français' | 'English'

// ── Background types (Sprint 2) ───────────────────────────────────────────────

export interface SlideBackground {
  mode: 'theme' | 'solid' | 'gradient' | 'preset'
  solidColor?: string
  gradientColor1?: string
  gradientColor2?: string
  gradientAngle?: number
  presetId?: string
}

export const BACKGROUND_PRESETS = [
  { id: 'aurora',  label: 'Aurora',  css: 'linear-gradient(135deg, #1a0533 0%, #0d4a6e 100%)' },
  { id: 'ember',   label: 'Ember',   css: 'linear-gradient(135deg, #1a0808 0%, #5c1a1a 100%)' },
  { id: 'forest',  label: 'Forest',  css: 'linear-gradient(135deg, #0a1f0f 0%, #1a4a2a 100%)' },
  { id: 'gold',    label: 'Gold',    css: 'linear-gradient(135deg, #1a1200 0%, #4a3200 100%)' },
  { id: 'ocean',   label: 'Ocean',   css: 'linear-gradient(135deg, #010d1a 0%, #003366 100%)' },
  { id: 'slate',   label: 'Slate',   css: 'linear-gradient(135deg, #0f1117 0%, #1e2235 100%)' },
] as const

// ── Layout variant types (Sprint 2) ──────────────────────────────────────────

export type HeroLayout    = 'centré' | 'gauche' | 'split' | 'plein_écran'
export type ContentLayout = 'gauche' | 'droite' | 'centré' | 'grille'
export type StatsLayout   = '4_col' | '2_col' | 'ligne'
export type SlideLayout   = HeroLayout | ContentLayout | StatsLayout

export interface SlideContent {
  // hero
  eyebrow?: string
  title?: string
  subtitle?: string
  // content
  label?: string
  body?: string
  bullets?: string[]
  // stats
  metrics?: { value: string; label: string }[]
  // quote
  text?: string
  author?: string
  role?: string
  // cta
  buttonText?: string
  buttonUrl?: string
  // chart
  chartType?: 'bar' | 'line' | 'pie' | 'donut'
  data?: { label: string; value: number }[]
  // image upload (TK-0048) — common to all types
  imageUrl?: string
  // timeline (TK-0052)
  events?: Array<{ year: string; label: string; desc?: string }>
  // comparison (TK-0053)
  left?: { label: string; color?: string; items: string[] }
  right?: { label: string; color?: string; items: string[] }
  // Sprint 2 — background per slide
  slideBackground?: SlideBackground
  // Sprint 2 — layout variant
  layout?: SlideLayout
}

export interface SlideJSON {
  id?: string
  type: SlideType
  position: number
  content: SlideContent
}

export interface DeckJSON {
  title: string
  theme: string
  slides: SlideJSON[]
}

export interface DeckBrief {
  title: string
  description: string
  audience: DeckAudience
  tonality: DeckTonality
  theme: DeckTheme
  slideCount: number
  lang: DeckLang
  accentColor?: string  // couleur principale extraite depuis un PDF ou choisie manuellement
}

export interface DeckRecord {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  slide_count: number
  theme_json: string | null
  created_at: string
  updated_at: string
  published_url: string | null
}

export interface SlideRecord {
  id: string
  deck_id: string
  position: number
  type: SlideType
  content_json: SlideContent
  created_at: string
}

// ── Template Types ─────────────────────────────────────────────────────────────

export interface TemplateThemeConfig {
  preset: string
  primaryColor: string
  bgColor: string
  surfaceColor: string
  textPrimary: string
  textSecondary: string
  fontFamily: string
  fontHeadWeight: number
  borderRadius: number
  accentGradient?: string | null
}

export interface SlideStructureItem {
  type: SlideType
  position: number
  hint?: string
  content?: SlideContent
}

export interface DeckTemplate {
  id: string
  owner_id?: string
  name: string
  description?: string
  theme_config: TemplateThemeConfig
  slide_structure?: SlideStructureItem[]
  source: 'pdf' | 'deck' | 'system' | 'manual'
  source_ref?: string
  is_system: boolean
  thumbnail_url?: string
  created_at: string
  updated_at: string
}
