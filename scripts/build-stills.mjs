// node --experimental-strip-types scripts/build-stills.mjs [appUrl]
// One still per part page, rendered from the car-sim configurator in the other
// repo. Needs that app running (or deployed) and PLAYWRIGHT_BROWSERS_PATH set.
import { mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PARTS } from '../data/parts.ts'
import { selectPages } from './lib/pages.mjs'

const base = (process.argv[2] ?? process.env.APP_URL ?? 'http://localhost:4173').replace(/\/$/, '')
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const { pages } = selectPages(PARTS)

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
})
const page = await browser.newPage({ viewport: { width: 1000, height: 750 }, deviceScaleFactor: 1 })

let done = 0, skipped = 0
const failed = []
for (const part of pages) {
  const dir = join(dist, 'parts', part.id)
  await mkdir(dir, { recursive: true })
  const out = join(dir, 'still.jpg')
  if (await access(out).then(() => true, () => false)) { skipped++; continue }
  try {
    await page.goto(`${base}/?part=${part.id}`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__CAR || window.__ERR, null, { timeout: 60000 })
    await page.keyboard.press('p')     // photo mode hides the UI chrome
    await page.waitForTimeout(2500)    // let the camera finish its flight
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 })
    await page.keyboard.press('p')
    done++
  } catch (e) {
    failed.push(`${part.id}: ${String(e).slice(0, 120)}`)
  }
  if ((done + skipped) % 25 === 0) console.log(`  ${done + skipped}/${pages.length}`)
}
await browser.close()
console.log(JSON.stringify({ total: pages.length, done, skipped, failed: failed.length, examples: failed.slice(0, 5) }, null, 1))
