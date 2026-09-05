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

if (!(await access(join(dist, 'parts')).then(() => true, () => false))) {
  console.error('dist/ not found - run `npm run build` first.')
  process.exit(1)
}

const broken = []
let links = 0, external = 0
/** page url -> the page urls it links to. Only '/…/' urls are pages. */
const graph = new Map()
const urlOf = (file) => file.replace(dist, '').replace(/\/index\.html$/, '/')

for await (const file of htmlFiles(dist)) {
  const html = await readFile(file, 'utf8')
  const out = new Set()
  for (const m of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const url = m[1]
    // The configurator lives in another repo and another deploy. Its links are
    // absolute and cannot be checked against this filesystem, so skip them.
    if (/^https?:\/\//.test(url) || url.startsWith('mailto:')) { external++; continue }
    if (!url.startsWith('/')) { broken.push(`${urlOf(file)} -> ${url} (not absolute)`); continue }
    const rel = url.replace(/^\//, '') + (url.endsWith('/') ? 'index.html' : '')
    links++
    if (!(await access(join(dist, rel)).then(() => true, () => false))) {
      broken.push(`${urlOf(file)} -> ${url}`)
    } else if (url.endsWith('/')) out.add(url)
  }
  graph.set(urlOf(file), out)
}

// A page nothing links to cannot be found by a crawler or a reader, however
// well it renders. Walk the graph from the two entry points and demand that it
// covers every page on disk.
const seen = new Set()
const queue = ['/', '/parts/']
for (const start of queue) seen.add(start)
while (queue.length) {
  for (const next of graph.get(queue.shift()) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next) }
}
const unreachable = [...graph.keys()].filter((u) => !seen.has(u))

console.log(JSON.stringify({
  pages: graph.size, links, external, broken: broken.length, unreachable: unreachable.length,
  examples: broken.slice(0, 10).concat(unreachable.slice(0, 10).map((u) => `${u} (unreachable)`)),
}, null, 1))
if (broken.length || unreachable.length) process.exit(1)
