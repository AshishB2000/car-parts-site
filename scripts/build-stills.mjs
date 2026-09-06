// node --experimental-strip-types scripts/build-stills.mjs [appUrl]
// One still per part page, rendered from the car-sim configurator in the other
// repo. Needs that app running (or deployed) and PLAYWRIGHT_BROWSERS_PATH set.
import { mkdir, access, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PARTS } from '../data/parts.ts'
import { selectPages } from './lib/pages.mjs'

const base = (process.argv[2] ?? process.env.APP_URL ?? 'http://localhost:4173').replace(/\/$/, '')
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const { pages } = selectPages(PARTS)

// Both ways this fails produce a wall of Chromium log lines that bury the one
// sentence you need, so translate them here. The browser is often not in the
// default cache, and a sandboxed shell denies Chromium its Mach bootstrap port.
let browser
try {
  browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  })
} catch (e) {
  const msg = String(e)
  if (msg.includes("Executable doesn't exist")) {
    console.error('! Chromium is missing. Run `npx playwright install chromium`,')
    console.error('  or set PLAYWRIGHT_BROWSERS_PATH to a directory that already has one.')
  } else if (msg.includes('mach_port_rendezvous') || msg.includes('Permission denied')) {
    console.error('! Chromium was denied a Mach bootstrap port, which a sandboxed shell does.')
    console.error('  Run this command outside the sandbox.')
  } else {
    console.error(`! Could not launch Chromium: ${msg.split('\n')[0]}`)
  }
  process.exit(1)
}
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
    // Photo mode leaves one "Show UI · P" pill in the corner, the only button
    // on screen once the panels are gone. A still is a picture, not an app: a
    // painted-on button in every og:image is worse than no affordance at all.
    // car-sim is a separate repo, so hide it from this side.
    await page.addStyleTag({ content: 'button{display:none!important}' })
    await page.keyboard.press('p')     // photo mode hides the UI chrome
    await page.waitForTimeout(2500)    // let the camera finish its flight
    // Write then rename. A run killed mid-screenshot would otherwise leave a
    // truncated jpeg that the skip-if-exists check above keeps forever, and a
    // broken image is worse than a page with none.
    // 90s, not the 30s default: screenshot waits for web fonts, and on a loaded
    // machine that wait alone blew the cap on 13 of 240 parts in a real run.
    await page.screenshot({ path: `${out}.tmp`, type: 'jpeg', quality: 82, timeout: 90000 })
    await rename(`${out}.tmp`, out)
    await page.keyboard.press('p')
    done++
  } catch (e) {
    failed.push(`${part.id}: ${String(e).slice(0, 120)}`)
  }
  if ((done + skipped) % 25 === 0) console.log(`  ${done + skipped}/${pages.length}`)
}
await browser.close()
console.log(JSON.stringify({ total: pages.length, done, skipped, failed: failed.length, examples: failed.slice(0, 5) }, null, 1))
