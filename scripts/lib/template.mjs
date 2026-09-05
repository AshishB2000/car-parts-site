// Data in, HTML string out. Pure: no I/O.

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SEP = '·'
/** The product has no final name yet. Rename here and nowhere else. */
export const SITE_NAME = 'How a car works'
const href = (id) => `/parts/${esc(id)}/`
const money = (n) => `$${n.toLocaleString('en-US')}`
/** JSON.stringify, safe to embed in a <script> element: '<' can't close the tag. */
const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c')

const CSS = `
:root{color-scheme:light dark;--fg:#111;--dim:#666;--line:#e2e2e2;--bg:#fff;--card:#fafafa}
@media(prefers-color-scheme:dark){:root{--fg:#eee;--dim:#999;--line:#2a2a2a;--bg:#0d0d0f;--card:#151517}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,sans-serif}
a{color:inherit}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);padding:14px 0;margin-bottom:24px}
header nav{display:flex;flex-wrap:wrap;gap:14px;font-size:14px;color:var(--dim);margin-top:6px}
h1{font-size:32px;margin:0 0 4px}
h2{font-size:14px;color:var(--dim);margin:22px 0 4px;font-weight:600}
.crumb{font-size:14px;color:var(--dim);margin-bottom:18px}
.cols{display:grid;grid-template-columns:1fr;gap:28px}
@media(min-width:760px){.cols{grid-template-columns:1.15fr 1fr}}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:18px}
td,th{padding:7px 0;border-top:1px solid var(--line)}
th{text-align:left;font-weight:600;color:var(--dim);vertical-align:top}
td:last-child{text-align:right}
.still{width:100%;border-radius:10px;border:1px solid var(--line);display:block}
.cta{display:inline-block;margin-top:10px;padding:9px 16px;border:1px solid var(--line);border-radius:8px;text-decoration:none;background:var(--card)}
.chips{display:flex;flex-wrap:wrap;gap:6px;font-size:14px;margin-top:6px}
.chips a,.chips span{border:1px solid var(--line);border-radius:7px;padding:3px 10px;text-decoration:none}
.sponsor{margin-top:14px;border:1px dashed var(--line);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--dim)}
.sponsor:empty{display:none}
.skip{position:absolute;left:-9999px}
.skip:focus{position:static;display:inline-block;padding:8px 0}
footer{border-top:1px solid var(--line);margin-top:44px;padding:18px 0;font-size:13px;color:var(--dim)}
`

const shell = ({ title, description, canonical, nav = [], head = '', body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${head}
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<a class="skip" href="#main">Skip to content</a>
<header>
<strong><a href="/parts/" style="text-decoration:none">${esc(SITE_NAME)}</a></strong>
<nav aria-label="Car subsystems">${nav.map((s) => `<a href="${href(s.id)}">${esc(s.name)}</a>`).join('')}</nav>
</header>
<main id="main">${body}</main>
<footer>Shown on a BMW M4 CSL. Model by Black Snow, CC BY 4.0.</footer>
</div>
</body>
</html>`

/**
 * One row per separated segment, skipping blanks. The label is a row header
 * spanning its values, so continuation rows carry no empty cell for a screen
 * reader to announce as "blank".
 */
const specRows = (label, value) => {
  const vals = String(value || '').split(SEP).map((s) => s.trim()).filter(Boolean)
  return vals.map((v, i) =>
    `<tr>${i === 0 ? `<th scope="row" rowspan="${vals.length}">${esc(label)}</th>` : ''}<td>${esc(v)}</td></tr>`).join('')
}

export function partPage({ part, ancestors, children, collapsed, positions, siblings, nav, siteUrl, appUrl, hasStill }) {
  const canonical = `${siteUrl}${href(part.id)}`
  const still = `${href(part.id)}still.jpg`
  const crumb = ['<a href="/parts/">All parts</a>']
    .concat(ancestors.map((a) => `<a href="${href(a.id)}">${esc(a.name)}</a>`))
    .join(' &rsaquo; ') + ` &rsaquo; ${esc(part.name)}`

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: part.name, description: part.desc, articleBody: `${part.desc} ${part.fn}`, url: canonical,
  }
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: ancestors.concat([part]).map((a, i) => ({
      '@type': 'ListItem', position: i + 1, name: a.name, item: `${siteUrl}${href(a.id)}`,
    })),
  }

  const rows = specRows('Material', part.material) + specRows('Spec', part.spec)
  const parent = ancestors[ancestors.length - 1]

  const body = `
<p class="crumb">${crumb}</p>
<div class="cols">
<div>
<h1>${esc(part.name)}</h1>
<p style="color:var(--dim);margin:0">${parent ? `Part of ${esc(parent.name)}` : 'The whole car'}${part.price > 0 ? ` &middot; about ${money(part.price)} to replace` : ''}</p>
<h2>What it is</h2><p>${esc(part.desc)}</p>
<h2>What it does</h2><p>${esc(part.fn)}</p>
${part.maint ? `<h2>How it fails</h2><p>${esc(part.maint)}</p>` : ''}
${rows ? `<table>${rows}</table>` : ''}
</div>
<div>
${hasStill ? `<img class="still" src="${esc(still)}" alt="${esc(part.name)} highlighted on the car" loading="lazy" width="800" height="600">` : ''}
<a class="cta" href="${esc(appUrl)}/?part=${esc(part.id)}">View in 3D</a>
<div class="sponsor" data-sponsor-slot="${esc(part.id.split('.')[0])}"></div>
${positions.length > 1 ? `<h2>Appears at</h2><div class="chips">${positions.map((label) => `<span>${esc(label)}</span>`).join('')}</div>` : ''}
${children.length ? `<h2>Inside this part</h2><div class="chips">${children.map((c) => `<a href="${href(c.id)}">${esc(c.name)}</a>`).join('')}</div>` : ''}
${collapsed.length ? `<h2>Individual units</h2><div class="chips">${collapsed.map((c) => `<span>${esc(c.name)}</span>`).join('')}</div>` : ''}
${siblings.length ? `<h2>Nearby</h2><div class="chips">${siblings.map((s) => `<a href="${href(s.id)}">${esc(s.name)}</a>`).join('')}</div>` : ''}
</div>
</div>`

  return shell({
    // The parent's name is what tells 240 pages apart in a search result: a
    // dozen names ("Housing", "Tire") repeat, their parents do not.
    title: parent ? `${part.name} - ${parent.name}` : `${part.name} - what it is and what it does`,
    description: part.desc.slice(0, 155),
    canonical,
    nav,
    head: `${hasStill ? `<meta property="og:image" content="${esc(siteUrl + still)}">\n` : ''}<script type="application/ld+json">${jsonForScript(jsonld)}</script>
<script type="application/ld+json">${jsonForScript(crumbLd)}</script>`,
    body,
  })
}

export function indexPage({ subsystems, nav, siteUrl }) {
  const body = `
<h1>${esc(SITE_NAME)}</h1>
<p style="color:var(--dim)">Every part of a BMW M4 CSL, what it does, and how it fails. Start with <a href="/parts/car/">the whole car</a>, or pick a system.</p>
<table>${subsystems.map(({ part, count }) =>
    `<tr><th scope="row"><a href="${href(part.id)}">${esc(part.name)}</a></th><td>${count} pages</td></tr>`).join('')}</table>`
  return shell({
    title: `${SITE_NAME} - every part of a BMW M4 CSL`,
    description: 'An explorable reference for every part of a car: what it is, what it does, how it fails, and what it costs.',
    canonical: `${siteUrl}/parts/`,
    nav,
    body,
  })
}

export const sitemap = (urls, siteUrl) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `<url><loc>${esc(siteUrl + u)}</loc></url>`).join('\n') +
  '\n</urlset>\n'
