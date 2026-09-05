// node --experimental-strip-types scripts/build-pages.mjs
// Writes the whole static site into dist/. This repo has no other build step.
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARTS, BY_ID, CHILDREN, pathOf, SUBSYSTEMS, descendants } from '../data/parts.ts'
import { selectPages } from './lib/pages.mjs'
import { partPage, indexPage, sitemap } from './lib/template.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const siteUrl = (process.env.SITE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const appUrl = (process.env.APP_URL ?? 'http://localhost:4173').replace(/\/$/, '')
if (!process.env.SITE_URL) console.warn('! SITE_URL is unset, canonical and sitemap URLs will point at localhost')
if (!process.env.APP_URL) console.warn('! APP_URL is unset, every "View in 3D" link will point at localhost')

const { pages, canonicalOf, collapsedUnder, positionsOf } = selectPages(PARTS)
const pageIds = new Set(pages.map((p) => p.id))
const exists = (p) => access(p).then(() => true, () => false)

const problems = []
const urls = ['/parts/']

for (const part of pages) {
  // Ancestors go through canonicalOf too: an ancestor that merged into another
  // page must link to that page, and one that has no page at all is dropped
  // rather than linked into the void.
  const ancestors = pathOf(part.id).slice(0, -1)
    .map((a) => BY_ID[canonicalOf.get(a.id)] ?? a)
    .filter((a) => pageIds.has(a.id) && a.id !== part.id)
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
  const collapsed = collapsedUnder.get(part.id) ?? []
  const children = (CHILDREN[part.id] ?? [])
    .map((c) => canonicalOf.get(c.id))
    .filter((id) => pageIds.has(id) && id !== part.id)
    .filter((id, i, a) => a.indexOf(id) === i)
    .map((id) => BY_ID[id])
  const siblings = (CHILDREN[part.parent] ?? [])
    .filter((s) => s.id !== part.id && pageIds.has(s.id))
    .slice(0, 8)
  const positions = positionsOf.get(part.id) ?? [part]

  if (!part.desc || !part.fn) problems.push(`${part.id}: missing desc or fn`)

  const dir = join(dist, 'parts', part.id)
  await mkdir(dir, { recursive: true })
  const hasStill = await exists(join(dir, 'still.jpg'))
  await writeFile(join(dir, 'index.html'), partPage({
    part, ancestors, children, collapsed, positions, siblings, siteUrl, appUrl, hasStill,
  }))
  urls.push(`/parts/${part.id}/`)
}

const subsystems = SUBSYSTEMS.map((id) => ({ part: BY_ID[id], count: descendants(id).length + 1 }))
await writeFile(join(dist, 'parts', 'index.html'), indexPage({ subsystems, siteUrl }))
await writeFile(join(dist, 'sitemap.xml'), sitemap(urls, siteUrl))

console.log(JSON.stringify({ parts: PARTS.length, pages: pages.length, urls: urls.length, siteUrl, appUrl, problems }, null, 1))
if (problems.length) process.exit(1)
