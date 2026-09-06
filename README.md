# Car parts reference

A static reference site explaining how a car works, one part at a time. Every
part of a BMW M4 CSL gets its own page: what it is, what it does, how it fails,
what it is made of, and roughly what it costs to replace. Each page carries a
rendered image of that part highlighted on the car, and links through to an
interactive 3D configurator where you can spin the car and open it up.

The audience is people who arrive from a search like "what does a wastegate do"
and want an answer they can see rather than a forum thread.

## How it works

`data/parts.ts` holds 372 parts in a four-level hierarchy, each with prose,
material, spec, a failure note and a price. The generator turns that into a
static site — no framework, no router, no runtime JavaScript on the page.

**372 parts become 240 pages.** Two mechanical dedupe rules do the reduction,
with no hand-maintained lists:

- **Numbered siblings collapse.** "Injector 1" through "Injector 6" are one
  idea, not six pages. They fold into the parent's page as a list.
- **Identical text merges.** The four wheel corners carry byte-identical prose,
  as do the six pistons' internals. These share one canonical page that names
  every position it appears at — "front left, front right, rear left, rear
  right" — which is more useful than four copies of the same words.

Every part still resolves to a page, and every page is reachable by following
links from the index. Both are asserted by tests.

## Layout

```
data/parts.ts          part hierarchy, vendored from car-sim
scripts/
  lib/pages.mjs        which parts get pages, and the link graph. Pure.
  lib/template.mjs     part data in, HTML string out. Pure.
  build-pages.mjs      writes dist/. All the I/O lives here.
  build-stills.mjs     one rendered image per page, via Playwright
  check-links.mjs      every internal link and image must resolve
  sync-data.mjs        pull and drift-check the vendored part data
docs/                  the design spec and implementation plan
```

The split matters: selection and templating are pure functions under unit test,
and every filesystem call is confined to `build-pages.mjs`.

## Commands

```bash
npm test                                    # 31 tests: dedupe rules and template
npm run check:data                          # vendored part data matches car-sim
npm run build:stills                        # one render per page; needs car-sim running
SITE_URL=https://site APP_URL=https://app npm run build
npm run check:links                         # every internal link must resolve
```

Set `SITE_URL` and `APP_URL` for real deploys, or every canonical, sitemap and
"View in 3D" URL points at localhost. The build warns when they are unset.

## The part data

`data/parts.ts` is a vendored copy of car-sim's `src/data/parts.ts`. The two
projects deploy separately, so the file cannot be imported across the boundary.
`npm run check:data` fails when the copy has drifted; `npm run sync:data` pulls
the upstream version. Never hand-edit it — edit it upstream and sync.

## Rendering the stills

Each still loads the configurator at that part's deep link, waits for the scene,
enters photo mode, hides the UI, and screenshots. It skips parts that already
have an image, so an interrupted run resumes and a content edit does not
re-render 240 images.

Two prerequisites beyond a running configurator. Chromium must be installed, via
`npx playwright install chromium` or a `PLAYWRIGHT_BROWSERS_PATH` pointing at an
existing one. And it must run outside a sandboxed shell, which denies Chromium
the Mach bootstrap port it needs on macOS. The script names both failures in one
line rather than printing a stack trace.

Stills are rendered **before** the pages: the generator looks for `still.jpg` on
disk as it writes each page and only emits the image and its `og:image` when one
is already there. Render stills after a build and the pages will not mention
them until the next build.

## Deploying

The build emits a self-contained `dist/` — around 14 MB, mostly images. Any
static host serves it. It needs no server, no database and no build step of its
own beyond `npm run build`.

## Attribution

Part data and the 3D model come from the companion `car-sim` repository. The car
is ["BMW M4 CSL 2023"](https://sketchfab.com/3d-models/bmw-m4-csl-2023-26d05968e63b4fc28205cbb9abb0ea41)
by [Black Snow](https://sketchfab.com/BlackSnow02), licensed CC BY 4.0. "BMW" and
"M4 CSL" are trademarks of BMW AG; this is an unaffiliated educational project.
