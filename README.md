# Car parts reference

A static, zero-JavaScript reference site: every part of a car, what it does, and
how it fails. The 3D configurator it links out to lives in the separate `car-sim`
repository.

`npm run build` writes one page per part to `dist/parts/<id>/index.html`.
372 parts collapse to 240 pages:
numbered sibling sets (Injector 1 to Injector 6) fold into their parent, and parts
whose text is identical across positions (the four wheel corners, the six pistons'
internals) share one page that lists where it appears. Each page carries the part's
description, function, failure note, spec and price, links to its ancestors,
children and siblings, and a "View in 3D" link to the configurator.

`data/parts.ts` is a vendored copy of car-sim's part data. `npm run check:data`
fails when the two have drifted; `npm run sync:data` pulls the upstream version.

Set `SITE_URL` and `APP_URL` for real deploys, or every canonical, sitemap and
"View in 3D" URL points at localhost.

```bash
npm test                                    # dedupe rules and template
npm run check:data                          # vendored part data matches car-sim
SITE_URL=https://site APP_URL=https://app npm run build
npm run check:links                         # every internal link must resolve
npm run build:stills                        # one render per page; needs car-sim running
```
