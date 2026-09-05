// Decides which parts get their own page. Pure: no I/O, no HTML.

/** "Injector 3" -> "Injector". Used to spot numbered sibling sets. */
const stem = (name) => name.replace(/\s*\d+\s*$/, '').trim()

/** Two parts are the same page when every prose field matches. */
const textKey = (p) => [p.desc, p.fn, p.material, p.spec, p.maint].join(' ')

export function selectPages(parts) {
  // Rule 1: three or more siblings whose names differ only by a trailing
  // number are one idea, not N pages. They fold into the parent's page.
  const byParent = new Map()
  for (const p of parts) {
    if (!byParent.has(p.parent)) byParent.set(p.parent, [])
    byParent.get(p.parent).push(p)
  }
  const collapsed = new Set()
  const collapsedUnder = new Map()
  for (const [parent, kids] of byParent) {
    const groups = new Map()
    for (const k of kids) {
      const s = stem(k.name)
      if (!groups.has(s)) groups.set(s, [])
      groups.get(s).push(k)
    }
    for (const members of groups.values()) {
      if (members.length < 3) continue
      for (const m of members) collapsed.add(m.id)
      collapsedUnder.set(parent, (collapsedUnder.get(parent) ?? []).concat(members))
    }
  }

  // Rule 2: parts with byte-identical prose share one page. The shallowest
  // id wins; ties break on data order, which is stable and human-ordered.
  const survivors = parts.filter((p) => !collapsed.has(p.id))
  const depth = (id) => id.split('.').length
  const ranked = survivors
    .map((p, i) => ({ p, i }))
    .sort((a, b) => depth(a.p.id) - depth(b.p.id) || a.i - b.i)

  const canonByText = new Map()
  for (const { p } of ranked) {
    const k = textKey(p)
    if (!canonByText.has(k)) canonByText.set(k, p)
  }

  const pages = survivors.filter((p) => canonByText.get(textKey(p)) === p)

  const positionsOf = new Map()
  for (const p of survivors) {
    const canon = canonByText.get(textKey(p))
    if (!positionsOf.has(canon.id)) positionsOf.set(canon.id, [])
    positionsOf.get(canon.id).push(p)
  }

  // Every part, page or not, must resolve somewhere. A collapsed part points
  // at its parent's page; a merged part points at its canonical twin.
  const canonicalOf = new Map()
  for (const p of parts) {
    if (collapsed.has(p.id)) canonicalOf.set(p.id, p.parent)
    else canonicalOf.set(p.id, canonByText.get(textKey(p)).id)
  }

  return { pages, canonicalOf, collapsedUnder, positionsOf }
}
