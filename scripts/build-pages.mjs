// node --experimental-strip-types scripts/build-pages.mjs
// Writes the whole static site into dist/. This repo has no other build step.
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARTS, BY_ID, SUBSYSTEMS } from '../data/parts.ts'
import { selectPages, pageLinks } from './lib/pages.mjs'
import { partPage, indexPage, sitemap } from './lib/template.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const siteUrl = (process.env.SITE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
const appUrl = (process.env.APP_URL ?? 'http://localhost:4173').replace(/\/$/, '')
if (!process.env.SITE_URL) console.warn('! SITE_URL is unset, canonical and sitemap URLs will point at localhost')
if (!process.env.APP_URL) console.warn('! APP_URL is unset, every "View in 3D" link will point at localhost')

const selection = selectPages(PARTS)
const { pages } = selection
// Who links to whom is selection logic and lives in pages.mjs under test.
const links = pageLinks(PARTS, selection)
const exists = (p) => access(p).then(() => true, () => false)
const nav = SUBSYSTEMS.map((id) => BY_ID[id])

const problems = []
const urls = ['/parts/']

for (const part of pages) {
  const { ancestors, children, collapsed, siblings, positions } = links.get(part.id)

  if (!part.desc || !part.fn) problems.push(`${part.id}: missing desc or fn`)

  const dir = join(dist, 'parts', part.id)
  await mkdir(dir, { recursive: true })
  const hasStill = await exists(join(dir, 'still.jpg'))
  await writeFile(join(dir, 'index.html'), partPage({
    part, ancestors, children, collapsed, positions, siblings, nav, siteUrl, appUrl, hasStill,
  }))
  urls.push(`/parts/${part.id}/`)
}

// Page counts, not part counts: a subsystem with 93 parts may only have 28
// pages, and promising 93 and delivering 28 is a lie the index tells once.
const subsystems = SUBSYSTEMS.map((id) => ({
  part: BY_ID[id],
  count: pages.filter((p) => p.id === id || p.id.startsWith(`${id}.`)).length,
}))
const index = indexPage({ subsystems, nav, siteUrl })
await writeFile(join(dist, 'parts', 'index.html'), index)
// A deployed domain root must not 404. Same page, canonical still /parts/.
await writeFile(join(dist, 'index.html'), index)
await writeFile(join(dist, 'sitemap.xml'), sitemap(urls, siteUrl))
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`)

console.log(JSON.stringify({ parts: PARTS.length, pages: pages.length, urls: urls.length, siteUrl, appUrl, problems }, null, 1))
if (problems.length) process.exit(1)
