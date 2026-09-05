import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esc, partPage, indexPage, sitemap, SITE_NAME } from './template.mjs'

const wastegate = {
  id: 'engine.turbo.t1.wastegate', parent: 'engine.turbo.t1', name: 'Wastegate',
  desc: 'Electrically actuated flap in the turbine housing.',
  fn: 'Bypasses exhaust around the turbine to cap boost.',
  material: 'Stainless flap, electric actuator',
  spec: 'Actuator travel 12 mm | 0 to 100 % in 120 ms'.replace('|', '·'),
  maint: 'Rattle at idle is a worn flap pivot.', price: 380,
}
const base = {
  part: wastegate,
  ancestors: [{ id: 'engine', name: 'S58 engine' }, { id: 'engine.turbo', name: 'Turbochargers' }],
  children: [], collapsed: [], positions: [wastegate], siblings: [],
  siteUrl: 'https://example.test', appUrl: 'https://app.example.test', hasStill: true,
}

test('escapes HTML-significant characters', () => {
  assert.equal(esc('Tom & "Jerry" <b>'), 'Tom &amp; &quot;Jerry&quot; &lt;b&gt;')
})

test('renders the part name, prose fields and price', () => {
  const html = partPage(base)
  assert.match(html, /<h1[^>]*>Wastegate<\/h1>/)
  assert.ok(html.includes('Bypasses exhaust around the turbine'))
  assert.ok(html.includes('Rattle at idle'))
  assert.ok(html.includes('$380'))
})

test('emits no executable JavaScript', () => {
  const html = partPage(base)
  const scriptTags = html.match(/<script\b[^>]*>/g) || []
  assert.ok(scriptTags.length > 0, 'sanity check: page does have script tags to examine')
  for (const tag of scriptTags) {
    assert.match(tag, /type="application\/ld\+json"/, `every <script> must be JSON-LD, got: ${tag}`)
  }
  assert.ok(!/ on[a-z]+=/.test(html), 'no inline event handlers')
})

test('escapes </script> inside JSON-LD data so it cannot close the script tag', () => {
  const html = partPage({ ...base, part: { ...wastegate, desc: 'Seals well</script><script>alert(1)</script>' } })
  assert.ok(!html.includes('</script><script>alert(1)</script>'), 'raw closing tag must not survive into the HTML')
  const scriptTags = html.match(/<script\b[^>]*>/g) || []
  for (const tag of scriptTags) {
    assert.match(tag, /type="application\/ld\+json"/, `every <script> must be JSON-LD, got: ${tag}`)
  }
})

test('links to the 3D app with an absolute part deep link', () => {
  assert.ok(partPage(base).includes('href="https://app.example.test/?part=engine.turbo.t1.wastegate"'))
})

test('exports a single brand constant so renaming is one edit', () => {
  assert.equal(typeof SITE_NAME, 'string')
  assert.ok(partPage(base).includes(SITE_NAME))
})

test('splits the spec string into one row per separated value', () => {
  const html = partPage(base)
  assert.ok(html.includes('Actuator travel 12 mm'))
  assert.ok(html.includes('0 to 100 % in 120 ms'))
})

test('omits the price when it is zero', () => {
  const html = partPage({ ...base, part: { ...wastegate, price: 0 } })
  assert.ok(!html.includes('$0'), 'zero price means structural, not free')
})

test('omits empty spec and material rows', () => {
  const html = partPage({ ...base, part: { ...wastegate, spec: '', material: '' } })
  assert.ok(!html.includes('<td></td>'), 'no empty table cells')
  assert.ok(!html.includes('Material'), 'the row disappears entirely')
})

test('renders an appears-at list only when the part has several positions', () => {
  assert.ok(!partPage(base).includes('Appears at'))
  const many = partPage({ ...base, positions: [wastegate, { ...wastegate, id: 'x', name: 'Rear wastegate' }] })
  assert.ok(many.includes('Appears at'))
  assert.ok(many.includes('Rear wastegate'))
})

test('renders collapsed children as plain text, not links', () => {
  const html = partPage({ ...base, collapsed: [{ id: 'a.i1', name: 'Injector 1' }, { id: 'a.i2', name: 'Injector 2' }] })
  assert.ok(html.includes('Injector 1'))
  assert.ok(!html.includes('href="/parts/a.i1/"'), 'collapsed parts have no page to link to')
})

test('breadcrumb links every ancestor', () => {
  const html = partPage(base)
  assert.ok(html.includes('href="/parts/engine/"'))
  assert.ok(html.includes('href="/parts/engine.turbo/"'))
})

test('sets canonical and og:url from the site url', () => {
  const html = partPage(base)
  assert.ok(html.includes('<link rel="canonical" href="https://example.test/parts/engine.turbo.t1.wastegate/">'))
  assert.ok(html.includes('property="og:url" content="https://example.test/parts/engine.turbo.t1.wastegate/"'))
})

test('omits og:image when no still was rendered', () => {
  assert.ok(!partPage({ ...base, hasStill: false }).includes('og:image'))
})

test('index page lists every subsystem with its count', () => {
  const html = indexPage({ subsystems: [{ part: { id: 'engine', name: 'S58 engine' }, count: 90 }], siteUrl: 'https://example.test' })
  assert.ok(html.includes('href="/parts/engine/"'))
  assert.ok(html.includes('90'))
})

test('sitemap emits absolute urls', () => {
  const xml = sitemap(['/parts/engine/'], 'https://example.test')
  assert.ok(xml.includes('<loc>https://example.test/parts/engine/</loc>'))
  assert.ok(xml.startsWith('<?xml'))
})
