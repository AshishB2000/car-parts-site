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
  const collapsedRaw = new Map()
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
      collapsedRaw.set(parent, (collapsedRaw.get(parent) ?? []).concat(members))
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

  // A collapsed part's raw parent may itself have been merged away by rule 2
  // (e.g. wheels.fr.lugs -> wheels.fl.lugs), so resolve through canonByText
  // rather than using the raw parent id directly.
  const partsById = new Map(parts.map((p) => [p.id, p]))
  const canonicalParentOf = (rawParentId) => canonByText.get(textKey(partsById.get(rawParentId))).id

  // Merge raw-parent buckets that share a canonical parent, deduping by name
  // (order of first appearance) so a name doesn't repeat once several merged
  // parents' children land on the same page.
  const collapsedUnder = new Map()
  for (const [rawParent, members] of collapsedRaw) {
    const canonParent = canonicalParentOf(rawParent)
    collapsedUnder.set(canonParent, (collapsedUnder.get(canonParent) ?? []).concat(members))
  }
  for (const [canonParent, members] of collapsedUnder) {
    const seen = new Set()
    const deduped = members.filter((m) => (seen.has(m.name) ? false : seen.add(m.name)))
    collapsedUnder.set(canonParent, deduped)
  }

  // Every part, page or not, must resolve somewhere. A collapsed part points
  // at its parent's page; a merged part points at its canonical twin.
  const canonicalOf = new Map()
  for (const p of parts) {
    if (collapsed.has(p.id)) canonicalOf.set(p.id, canonicalParentOf(p.parent))
    else canonicalOf.set(p.id, canonByText.get(textKey(p)).id)
  }

  return { pages, canonicalOf, collapsedUnder, positionsOf }
}

/**
 * Labels for the "appears at" chips. Merged parts share a name by construction,
 * so the name itself says nothing: the label is the nearest ancestor that tells
 * the positions apart (the parent for most sets, the grandparent for the three
 * tire layers, whose parents are all named "Tire"). Returns [] when even that
 * collides, since printing one word four times is worse than printing nothing.
 */
function positionLabels(positions, byId) {
  if (positions.length < 2) return []
  for (const up of [1, 2]) {
    const labels = positions.map((p) => {
      let cur = p
      for (let i = 0; i < up && cur; i++) cur = byId.get(cur.parent)
      return cur?.name
    })
    if (labels.every(Boolean) && new Set(labels).size === labels.length) return labels
  }
  return []
}

/**
 * The link graph: for every page, the parts it links to. This is selection
 * logic, not I/O, so it lives here under test rather than in the generator.
 *
 * `parts` is the full list; `selection` is the result of selectPages.
 * Returns Map<pageId, { ancestors, children, siblings, collapsed, positions }>
 * where positions is an array of label strings, not parts.
 */
export function pageLinks(parts, { pages, canonicalOf, collapsedUnder, positionsOf }) {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const kidsOf = new Map()
  for (const p of parts) {
    if (!kidsOf.has(p.parent)) kidsOf.set(p.parent, [])
    kidsOf.get(p.parent).push(p)
  }
  const pageIds = new Set(pages.map((p) => p.id))
  /** The page that covers this part, or null when nothing covers it. */
  const toPage = (id) => {
    const canon = canonicalOf.get(id)
    return pageIds.has(canon) ? canon : null
  }
  const linked = (parts_, selfId) => {
    const out = []
    for (const p of parts_) {
      const id = toPage(p.id)
      if (id && id !== selfId && !out.includes(id)) out.push(id)
    }
    return out.map((id) => byId.get(id))
  }

  const links = new Map()
  for (const part of pages) {
    const ancestors = []
    for (let cur = byId.get(part.parent); cur; cur = byId.get(cur.parent)) ancestors.unshift(cur)

    const collapsed = collapsedUnder.get(part.id) ?? []
    // A collapsed member's own children (piston 1's rings, pin and rod) are
    // canonical for the whole set, so they must surface on the parent's page.
    // Without this they are generated but unreachable by crawling.
    const childParts = [...(kidsOf.get(part.id) ?? []), ...collapsed.flatMap((m) => kidsOf.get(m.id) ?? [])]

    links.set(part.id, {
      ancestors: linked(ancestors, part.id),
      children: linked(childParts, part.id),
      siblings: linked(kidsOf.get(part.parent) ?? [], part.id).slice(0, 8),
      collapsed,
      positions: positionLabels(positionsOf.get(part.id) ?? [], byId),
    })
  }
  return links
}
