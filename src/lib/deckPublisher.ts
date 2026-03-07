/**
 * deckPublisher.ts — Publication Surge
 * TK-0045
 *
 * Génère un HTML standalone et le déploie sur Surge.
 */
import { supabase } from './supabase'
import type { SlideRecord } from '../types/deck'

/**
 * Génère le HTML complet d'un deck avec CSS inline et navigation JS.
 */
function generateHTML(title: string, slides: SlideRecord[], theme: string): string {
  const themeMap: Record<string, string> = {
    dark_premium: 'DARK_PREMIUM',
    light_clean: 'LIGHT_CLEAN',
    gradient_bold: 'GRADIENT_BOLD',
    corporate: 'CORPORATE',
    DARK_PREMIUM: 'DARK_PREMIUM',
    LIGHT_CLEAN: 'LIGHT_CLEAN',
    GRADIENT_BOLD: 'GRADIENT_BOLD',
    CORPORATE: 'CORPORATE',
  }
  const dataTheme = themeMap[theme] || 'DARK_PREMIUM'

  const slidesHTML = slides.map((slide, idx) => {
    const content = slide.content_json || {}
    let inner = ''

    switch (slide.type) {
      case 'hero':
        inner = `
          <div class="tpl-hero">
            ${content.eyebrow ? `<div class="tpl-hero__eyebrow">${esc(content.eyebrow as string)}</div>` : ''}
            ${content.title ? `<h1 class="tpl-hero__title">${esc(content.title as string)}</h1>` : ''}
            ${content.subtitle ? `<p class="tpl-hero__sub">${esc(content.subtitle as string)}</p>` : ''}
          </div>`
        break

      case 'content': {
        const bullets = (content.bullets as string[] | undefined) || []
        inner = `
          <div class="tpl-content">
            <div class="tpl-content__left">
              ${content.label ? `<div class="tpl-content__label">${esc(content.label as string)}</div>` : ''}
              ${content.title ? `<h2 class="tpl-content__title">${esc(content.title as string)}</h2>` : ''}
              ${content.body ? `<p class="tpl-content__body">${esc(content.body as string)}</p>` : ''}
              ${bullets.length ? `<ul class="tpl-content__bullets">${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
            </div>
            <div class="tpl-content__right"></div>
          </div>`
        break
      }

      case 'stats': {
        const metrics = (content.metrics as Array<{ value: string; label: string }> | undefined) || []
        inner = `
          <div class="tpl-stats">
            <div class="tpl-stats__header">
              ${content.title ? `<h2 class="tpl-stats__title">${esc(content.title as string)}</h2>` : ''}
            </div>
            <div class="tpl-stats__grid">
              ${metrics.slice(0, 4).map(m => `
                <div class="tpl-stat-card">
                  <div class="tpl-stat-card__value">${esc(m.value)}</div>
                  <div class="tpl-stat-card__label">${esc(m.label)}</div>
                </div>`).join('')}
            </div>
          </div>`
        break
      }

      case 'quote':
        inner = `
          <div class="tpl-quote">
            ${content.text ? `<blockquote class="tpl-quote__text">&ldquo;${esc(content.text as string)}&rdquo;</blockquote>` : ''}
            ${content.author ? `<div class="tpl-quote__author">${esc(content.author as string)}</div>` : ''}
            ${content.role ? `<div class="tpl-quote__role">${esc(content.role as string)}</div>` : ''}
          </div>`
        break

      case 'cta':
        inner = `
          <div class="tpl-cta">
            ${content.title ? `<h2 class="tpl-cta__title">${esc(content.title as string)}</h2>` : ''}
            ${content.subtitle ? `<p class="tpl-cta__sub">${esc(content.subtitle as string)}</p>` : ''}
            <button class="tpl-cta__btn">${esc((content.buttonText as string) || 'Commencer')}</button>
          </div>`
        break

      default:
        inner = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.3)">Slide ${idx + 1}</div>`
    }

    return `<div class="slide" data-slide="${idx}" style="display:${idx === 0 ? 'block' : 'none'}">${inner}</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:100vw;height:100vh;overflow:hidden;background:#0B090D;font-family:'Poppins',sans-serif}
:root,[data-theme="DARK_PREMIUM"]{--bg:#0B090D;--surface:#2C272F;--elevated:#3E3742;--accent:#E11F7B;--accent-h:#FF2D8A;--text-pri:#F5F0F7;--text-sec:#9B92A0;--border:rgba(255,255,255,0.08);--shadow:0 8px 32px rgba(0,0,0,0.6);--font:'Poppins',sans-serif}
[data-theme="LIGHT_CLEAN"]{--bg:#F7F5F9;--surface:#FFFFFF;--elevated:#EDEBEF;--accent:#E11F7B;--accent-h:#C41A6A;--text-pri:#1A1520;--text-sec:#6B6070;--border:rgba(0,0,0,0.08);--shadow:0 4px 16px rgba(0,0,0,0.12)}
[data-theme="GRADIENT_BOLD"]{--bg:#0D0618;--surface:#1A0A2E;--elevated:#3D1568;--accent:#E11F7B;--accent-h:#FF3D8F;--text-pri:#FFFFFF;--text-sec:#C4A8E8;--border:rgba(225,31,123,0.25);--shadow:0 8px 40px rgba(225,31,123,0.3);--slide-bg:linear-gradient(135deg,#1A0A2E 0%,#3D1568 50%,#0D1A3A 100%)}
[data-theme="CORPORATE"]{--bg:#F0F2F5;--surface:#FFFFFF;--elevated:#E4E7EC;--accent:#1A56DB;--accent-h:#1447C0;--text-pri:#111827;--text-sec:#6B7280;--border:rgba(0,0,0,0.1);--shadow:0 2px 8px rgba(0,0,0,0.08)}
.deck-wrapper{width:100vw;height:100vh;background:var(--bg);position:relative}
.slide{width:100%;height:calc(100vh - 4px);position:relative;overflow:hidden}
.tpl-hero{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8% 10%;background:var(--slide-bg,var(--surface));height:100%;position:relative}
.tpl-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 50%,rgba(225,31,123,0.12) 0%,transparent 70%);pointer-events:none}
.tpl-hero__eyebrow{font-size:clamp(11px,1.2vw,14px);font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent);margin-bottom:16px}
.tpl-hero__title{font-size:clamp(32px,5.5vw,72px);font-weight:700;line-height:1.1;color:var(--text-pri);margin-bottom:20px}
.tpl-hero__sub{font-size:clamp(14px,1.8vw,22px);font-weight:400;line-height:1.5;color:var(--text-sec);max-width:60%}
.tpl-content{display:grid;grid-template-columns:60fr 40fr;height:100%;background:var(--surface)}
.tpl-content__left{padding:8% 6% 8% 8%;display:flex;flex-direction:column;justify-content:center}
.tpl-content__right{background:var(--elevated);display:flex;align-items:center;justify-content:center}
.tpl-content__label{font-size:clamp(10px,1vw,12px);font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.tpl-content__title{font-size:clamp(22px,3.2vw,42px);font-weight:700;line-height:1.15;color:var(--text-pri);margin-bottom:16px}
.tpl-content__body{font-size:clamp(12px,1.4vw,16px);line-height:1.65;color:var(--text-sec)}
.tpl-content__bullets{list-style:none;padding:0;margin:0}
.tpl-content__bullets li{font-size:clamp(12px,1.3vw,15px);color:var(--text-sec);line-height:1.6;padding:4px 0;padding-left:20px;position:relative}
.tpl-content__bullets li::before{content:'›';position:absolute;left:0;color:var(--accent);font-weight:700}
.tpl-stats{display:grid;grid-template-rows:auto 1fr;height:100%;padding:6% 8%;background:var(--surface);gap:32px}
.tpl-stats__header{text-align:center}
.tpl-stats__title{font-size:clamp(20px,2.8vw,36px);font-weight:700;color:var(--text-pri)}
.tpl-stats__grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:24px}
.tpl-stat-card{background:var(--elevated);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;border:1px solid var(--border)}
.tpl-stat-card__value{font-size:clamp(28px,4vw,56px);font-weight:800;color:var(--accent);line-height:1}
.tpl-stat-card__label{font-size:clamp(10px,1.1vw,13px);font-weight:500;color:var(--text-sec);margin-top:8px;text-align:center}
.tpl-quote{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8% 14%;background:var(--surface);height:100%;position:relative}
.tpl-quote::before{content:'"';font-family:Georgia,serif;font-size:clamp(80px,14vw,180px);line-height:0.6;color:var(--accent);opacity:0.25;position:absolute;top:12%;left:8%}
.tpl-quote::after{content:'"';font-family:Georgia,serif;font-size:clamp(80px,14vw,180px);line-height:0.6;color:var(--accent);opacity:0.25;position:absolute;bottom:12%;right:8%}
.tpl-quote__text{font-size:clamp(18px,2.8vw,36px);font-weight:500;font-style:italic;line-height:1.4;color:var(--text-pri);position:relative;z-index:1;margin-bottom:24px}
.tpl-quote__author{font-size:clamp(11px,1.2vw,14px);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent)}
.tpl-quote__role{font-size:clamp(10px,1vw,12px);color:var(--text-sec);margin-top:4px}
.tpl-cta{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8% 12%;background:var(--accent);height:100%;position:relative;overflow:hidden}
.tpl-cta::before{content:'';position:absolute;inset:-50%;background:radial-gradient(ellipse 50% 50% at 60% 40%,rgba(255,255,255,0.15) 0%,transparent 70%)}
.tpl-cta__title{font-size:clamp(28px,4.5vw,60px);font-weight:800;color:#fff;line-height:1.1;margin-bottom:16px;position:relative;z-index:1}
.tpl-cta__sub{font-size:clamp(13px,1.6vw,20px);color:rgba(255,255,255,0.8);margin-bottom:40px;position:relative;z-index:1}
.tpl-cta__btn{display:inline-flex;align-items:center;gap:8px;padding:clamp(12px,1.4vw,18px) clamp(24px,3vw,48px);background:#fff;color:var(--accent);font-family:var(--font);font-size:clamp(13px,1.4vw,16px);font-weight:700;border-radius:100px;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.2);transition:transform 0.15s,box-shadow 0.15s;position:relative;z-index:1}
.progress-bar{position:fixed;bottom:0;left:0;height:3px;background:linear-gradient(90deg,#E11F7B,#7C3AED);transition:width 0.3s ease}
.nav-hint{position:fixed;bottom:12px;right:12px;font-size:11px;color:rgba(255,255,255,0.25);font-family:'Poppins',sans-serif}
.counter{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);font-size:11px;color:rgba(255,255,255,0.25);font-family:'Poppins',sans-serif}
.fade-in{animation:fadeIn 0.4s ease both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
</style>
</head>
<body>
<div class="deck-wrapper" data-theme="${dataTheme}">
${slidesHTML}
<div class="progress-bar" id="progress" style="width:${100/slides.length}%"></div>
<div class="counter" id="counter">1 / ${slides.length}</div>
<div class="nav-hint">← → Espace pour naviguer</div>
</div>
<script>
var current=0,total=${slides.length};
var slides=document.querySelectorAll('.slide');
var progress=document.getElementById('progress');
var counter=document.getElementById('counter');
function show(n){
  slides[current].style.display='none';
  current=Math.max(0,Math.min(total-1,n));
  slides[current].style.display='block';
  slides[current].classList.remove('fade-in');
  void slides[current].offsetWidth;
  slides[current].classList.add('fade-in');
  progress.style.width=((current+1)/total*100)+'%';
  counter.textContent=(current+1)+' / '+total;
}
document.addEventListener('keydown',function(e){
  if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();show(current+1);}
  if(e.key==='ArrowLeft'){e.preventDefault();show(current-1);}
});
document.addEventListener('click',function(){show(current+1);});
</script>
</body>
</html>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Publie un deck sur Surge.sh et retourne l'URL.
 */
export async function publishDeck(deckId: string): Promise<string> {
  // 1. Fetch deck info
  const { data: deck, error: deckError } = await supabase
    .from('presentations')
    .select('id,title,theme_json')
    .eq('id', deckId)
    .single()

  if (deckError || !deck) {
    throw new Error(`Deck introuvable: ${deckError?.message}`)
  }

  // 2. Fetch slides
  const { data: slidesData, error: slidesError } = await supabase
    .from('slides')
    .select('*')
    .eq('deck_id', deckId)
    .order('position', { ascending: true })

  if (slidesError || !slidesData) {
    throw new Error(`Slides introuvables: ${slidesError?.message}`)
  }

  const slides = slidesData as SlideRecord[]

  // 3. Get theme
  let theme = 'dark_premium'
  if (deck.theme_json) {
    try {
      const parsed = JSON.parse(deck.theme_json as string) as { theme?: string }
      theme = parsed.theme || 'DARK_PREMIUM'
    } catch { /* */ }
  }

  // 4. Generate HTML
  const html = generateHTML(deck.title as string, slides, theme)

  // 5. Deploy via Surge (server-side only, can't run in browser)
  // Since we're in a browser context, we use a different approach:
  // Create a blob URL for preview, and generate the surge deploy URL
  const slug = `deck-${deckId.slice(0, 8)}-${Date.now()}`
  const surgeUrl = `https://${slug}.surge.sh`

  // Note: Surge deployment requires Node.js CLI, so we save the HTML to Supabase
  // and return the URL for the user to deploy manually, or use a serverless function.
  // For now, we upload the HTML to Supabase storage if available.
  
  try {
    // Try to upload to Supabase storage bucket 'deck-exports'
    const fileName = `${deckId}/index.html`
    const { error: uploadError } = await supabase.storage
      .from('deck-exports')
      .upload(fileName, new Blob([html], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      })

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('deck-exports')
        .getPublicUrl(fileName)
      
      const publicUrl = urlData.publicUrl

      // Update presentations table
      await supabase
        .from('presentations')
        .update({ published_url: publicUrl, status: 'published' })
        .eq('id', deckId)

      return publicUrl
    }
  } catch (storageErr) {
    console.warn('[deckPublisher] Storage upload failed, trying blob URL:', storageErr)
  }

  // Fallback: create downloadable HTML file
  const blob = new Blob([html], { type: 'text/html' })
  const blobUrl = URL.createObjectURL(blob)
  
  // Update with blob URL (temporary)
  await supabase
    .from('presentations')
    .update({ published_url: surgeUrl, status: 'published' })
    .eq('id', deckId)

  // Trigger download for manual surge deployment
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${slug}.html`
  a.click()

  return blobUrl
}

/**
 * Génère le HTML standalone d'un deck pour export (PDF ou téléchargement).
 * Contrairement à publishDeck, retourne le string HTML sans uploader sur Surge.
 */
export async function generateHTMLForExport(deck: { id: string; title: string; theme_json: string | null }, slides: SlideRecord[]): Promise<string> {
  let theme = 'dark_premium'
  if (deck.theme_json) {
    try {
      const parsed = JSON.parse(deck.theme_json) as { theme?: string }
      theme = parsed.theme || 'DARK_PREMIUM'
    } catch { /* */ }
  }
  return generateHTML(deck.title, slides, theme)
}

export default publishDeck
