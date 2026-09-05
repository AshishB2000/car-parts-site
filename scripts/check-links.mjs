// node scripts/check-links.mjs - every internal link in dist/ must resolve.
import { readFile, readdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* htmlFiles(p)
    else if (e.name.endsWith('.html')) yield p
  }
}

const broken = []
let links = 0, external = 0
for await (const file of htmlFiles(join(dist, 'parts'))) {
  const html = await readFile(file, 'utf8')
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    const url = m[1]
    // The configurator lives in another repo and another deploy. Its links are
    // absolute and cannot be checked against this filesystem, so skip them.
    if (/^https?:\/\//.test(url) || url.startsWith('mailto:')) { external++; continue }
    if (!url.startsWith('/')) { broken.push(`${file.replace(dist, '')} -> ${url} (not absolute)`); continue }
    const rel = url.replace(/^\//, '') + (url.endsWith('/') ? 'index.html' : '')
    links++
    if (!(await access(join(dist, rel)).then(() => true, () => false))) {
      broken.push(`${file.replace(dist, '')} -> ${url}`)
    }
  }
}

console.log(JSON.stringify({ links, external, broken: broken.length, examples: broken.slice(0, 10) }, null, 1))
if (broken.length) process.exit(1)
