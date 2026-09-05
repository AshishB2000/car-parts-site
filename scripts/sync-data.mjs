// node scripts/sync-data.mjs [--check]
//
// data/parts.ts is a vendored copy of car-sim's src/data/parts.ts. The two
// repos are deployed separately, so the file cannot simply be imported across
// the boundary. This keeps the copy honest: `--check` fails when it has
// drifted, so the divergence is caught by a command rather than discovered
// months later on a page showing stale specs.
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const mine = join(here, '..', 'data', 'parts.ts')
const source = process.env.CAR_SIM_PATH ?? join(here, '..', '..', 'car-sim', 'src', 'data', 'parts.ts')
const check = process.argv.includes('--check')

const upstream = await readFile(source, 'utf8').catch(() => null)
if (upstream === null) {
  console.error(`! cannot read upstream at ${source}`)
  console.error('  set CAR_SIM_PATH to the full path of car-sim/src/data/parts.ts')
  process.exit(check ? 0 : 1) // --check must not fail a build just because car-sim is absent
}

const current = await readFile(mine, 'utf8').catch(() => '')
if (current === upstream) {
  console.log(`data/parts.ts is in sync with ${source}`)
  process.exit(0)
}

if (check) {
  console.error(`! data/parts.ts has drifted from ${source}`)
  console.error('  run `npm run sync:data` to pull the upstream version')
  process.exit(1)
}

await writeFile(mine, upstream)
console.log(`updated data/parts.ts from ${source}`)
