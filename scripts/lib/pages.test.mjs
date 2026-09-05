import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PARTS, BY_ID } from '../../data/parts.ts'
import { selectPages } from './pages.mjs'

const { pages, canonicalOf, collapsedUnder, positionsOf } = selectPages(PARTS)
const ids = new Set(pages.map((p) => p.id))

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
  const allCollapsed = new Set([...collapsedUnder.values()].flat().map((c) => c.id))
  for (const p of PARTS) {
    const canon = canonicalOf.get(p.id)
    assert.ok(canon, `${p.id} has no canonical page`)
    assert.ok(ids.has(canon) || allCollapsed.has(p.id), `${p.id} resolves to ${canon}, which is not a page`)
  }
})

test('every page id is a real part', () => {
  for (const p of pages) assert.ok(BY_ID[p.id], `${p.id} is not in the data`)
})
