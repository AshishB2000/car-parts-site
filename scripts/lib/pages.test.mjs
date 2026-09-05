import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PARTS, BY_ID, SUBSYSTEMS } from '../../data/parts.ts'
import { selectPages, pageLinks } from './pages.mjs'
import { partPage } from './template.mjs'

const selection = selectPages(PARTS)
const { pages, canonicalOf, collapsedUnder, positionsOf } = selection
const ids = new Set(pages.map((p) => p.id))
const links = pageLinks(PARTS, selection)

test('produces 240 pages from 372 parts', () => {
  assert.equal(PARTS.length, 372)
  assert.equal(pages.length, 240)
})

test('collapses numbered siblings into their parent', () => {
  for (let i = 1; i <= 6; i++) assert.ok(!ids.has(`engine.injectors.i${i}`), `injector ${i} should have no page`)
  assert.ok(ids.has('engine.injectors'), 'the parent keeps its page')
  const folded = collapsedUnder.get('engine.injectors')
  assert.equal(folded.length, 6)
  assert.equal(folded[0].name, 'Injector 1')
})

test('keeps the two turbos, which are not a numbered set of three or more', () => {
  assert.ok(ids.has('engine.turbo.t1'))
  assert.ok(ids.has('engine.turbo.t2'))
})

test('merges the four wheel corners into one canonical page', () => {
  const corners = ['wheels.fl.hub', 'wheels.fr.hub', 'wheels.rl.hub', 'wheels.rr.hub']
  const canon = corners.map((id) => canonicalOf.get(id))
  assert.equal(new Set(canon).size, 1, 'all four map to one page')
  assert.equal(canon[0], 'wheels.fl.hub', 'shallowest, first in data order, wins')
  assert.equal(positionsOf.get('wheels.fl.hub').length, 4)
  for (const id of corners.slice(1)) assert.ok(!ids.has(id), `${id} should have no page of its own`)
})

test('every part resolves to a page that exists', () => {
  for (const p of PARTS) {
    const canon = canonicalOf.get(p.id)
    assert.ok(canon, `${p.id} has no canonical page`)
    assert.ok(ids.has(canon), `${p.id} resolves to ${canon}, which is not a page`)
  }
})

test('lug bolts collapsed under a merged parent still resolve to a real page', () => {
  for (let i = 1; i <= 5; i++) {
    const canon = canonicalOf.get(`wheels.fr.lugs.b${i}`)
    assert.ok(ids.has(canon), `wheels.fr.lugs.b${i} resolves to ${canon}, which is not a page`)
  }
  for (const key of collapsedUnder.keys()) {
    assert.ok(ids.has(key), `collapsedUnder has key ${key}, which is not a page`)
  }
})

test('every page id is a real part', () => {
  for (const p of pages) assert.ok(BY_ID[p.id], `${p.id} is not in the data`)
})

test('surfaces a collapsed member\'s children on the parent page', () => {
  // engine.pistons.p1 has no page of its own, but its rings, pin and rod do,
  // and they are canonical for all six pistons. Nothing else links to them.
  const children = links.get('engine.pistons').children.map((c) => c.id)
  for (const id of ['engine.pistons.p1.rings', 'engine.pistons.p1.pin', 'engine.pistons.p1.rod']) {
    assert.ok(children.includes(id), `engine.pistons should link to ${id}, got ${children.join(', ')}`)
  }
})

test('every page is reachable from the index by following links', () => {
  // The index links the subsystems and the whole car; everything else must be
  // found by walking children, ancestors and siblings from there.
  const queue = ['car', ...SUBSYSTEMS]
  const seen = new Set(queue)
  while (queue.length) {
    const { ancestors, children, siblings } = links.get(queue.shift())
    for (const p of [...ancestors, ...children, ...siblings]) {
      if (!seen.has(p.id)) { seen.add(p.id); queue.push(p.id) }
    }
  }
  const orphans = pages.filter((p) => !seen.has(p.id)).map((p) => p.id)
  assert.deepEqual(orphans, [], 'pages nothing links to')
  assert.equal(seen.size, pages.length)
})

test('no appears-at list repeats a label', () => {
  let listed = 0
  for (const [id, { positions }] of links) {
    assert.equal(new Set(positions).size, positions.length, `${id} lists ${positions.join(' / ')}`)
    if (positions.length) listed++
  }
  const merged = [...positionsOf.values()].filter((v) => v.length > 1).length
  assert.equal(merged, 38, 'the dataset still has 38 merged sets')
  assert.equal(listed, merged, 'every merged set gets distinguishable labels')
  assert.deepEqual(links.get('wheels.fl.hub').positions,
    ['Front left wheel', 'Front right wheel', 'Rear left wheel', 'Rear right wheel'])
  // The three tire layers share a parent named "Tire", so the label climbs one more level.
  assert.deepEqual(links.get('wheels.fl.tire.tread').positions,
    ['Front left wheel', 'Front right wheel', 'Rear left wheel', 'Rear right wheel'])
})

test('every page title is distinct, so search results are told apart', () => {
  const titles = pages.map((part) => partPage({
    part, ...links.get(part.id), nav: [], siteUrl: 'https://x.test', appUrl: 'https://a.test', hasStill: false,
  }).match(/<title>(.*)<\/title>/)[1])
  const dupes = titles.filter((t, i) => titles.indexOf(t) !== i)
  assert.deepEqual([...new Set(dupes)], [])
  assert.equal(titles.length, 240)
})
