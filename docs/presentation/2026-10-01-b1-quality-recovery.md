# B1 quality recovery / Pixel Player review v2

## What changed

The v1 contract fixture reduced the accepted B1 silhouette to roughly 12 × 16 body cells, painted solid rectangles, omitted the catcher and used a distant review camera. These choices lost the approved character's small head, broad shoulders and rounded limbs. Passing contract tests did not establish visual quality.

The new review uses a manually authored 72 × 72 transparent canvas with an approximately 38-cell standing body, shaded cap, broad jersey/sleeves, rounded hands and two staggered boots. The original approved PNG sheets remain unchanged references. No bitmap is sampled in this asset build; the checked-in named-part JSON is the maintained source. The new artwork is a quality review candidate, not a new declaration of user adoption.

- `assets/pixel-players/players/b1-recovery.pixel.json`: 50 explicit frame entries, including the eight R/L batting frames and FRONT/BACK pitching/idle/fielding/running coverage. Equipment and hands have separate layers; visible bat ownership survives compilation.
- `assets/pixel-players/players/b1-catcher.pixel.json`: crouching catcher in blue gear, used behind home plate in the mound view.
- `referenceHeight`: optional authored standing-height metadata. A 38-cell body does not inherit the old 16-cell body's automatic 2× scale at near LOD. Screen positions still come from camera projection; scales remain integer tiers. Legacy assets omit this field and retain their behavior.
- `scripts/pixel-review-raster.mjs`: the same 4px light lattice paints turf, dirt, chalk, sprites and zone. Sprite cells replace underlying ground lights. Ball painting follows the zone and labels.
- `scripts/pixel-preview.mjs`: rebuilds the v2 offline comparison HTML. Mound optical zoom is 400 logical focal units (old fixture: 160), preserving all canonical player positions. View labels and translucent black nameplates follow projection/LOD.

The 4px grid is a screen raster contract, not a mandatory limit of 12 × 16 cells per person. Art detail and camera composition must be reviewed together.

## Review behavior

`npm run pixel:compile` exports the recovery asset's PNG/atlas/runtime derivatives. `npm run pixel:preview` writes `.pixel-build/review/pixel-player-v2.html`. The original v1 builder is retained as `scripts/pixel-preview-v1.mjs`.

The v2 comparison toggle places old and new art in the **same camera**. The old art is display-only; its contact compatibility is not asserted under the new optical calibration. The new right/left impact frames are checked against the actual contact vertical slice's projected canonical contact point, with physical bat coordinates retained but not painted.

The stage has a 600 × 432 maximum reference viewport. On narrower screens it takes a centered crop with integer multiples of 4px instead of squeezing the lattice. Sprite/nameplate sizes therefore remain unchanged in screen pixels. The sprite gallery also paints from compiled PNG cells on this same lattice.

The field is a flat review surface with 27.432m base spacing, 18.4404m rubber position, both 1.2192m × 1.8288m batter boxes, home/catcher/rubber/base reference markings and foul lines. It is not a replacement for the production canonical ballpark builder or its terrain contract. Batters remain at their canonical ±0.97m x, 0.72m z positions; body bounds fit inside the independent box projection.

## Verification and limits

- Type checking and the full test suite pass, including authored-height scale regression and exact contact checks for both handednesses at the enlarged framing.
- Browser checks cover right/left, old/new toggle, four cameras, frame stepping, actual replay progress, Japanese offline labels and mobile grid size without page overflow.
- Core physics, world coordinates, events and results are unchanged. This remains a short drawing/contact fixture rather than a full causal Match replay.
- First-person body hiding is preserved. First-person bat rendering, seam detail in a close ball view, all throwing styles and final production camera calibration remain separate integration work. The contact ball in this fixture resolves to one white light.
- The full-body art currently has one base integer tier and its 2× tier; compact/dot LOD still uses the separately authored v1 compact silhouette and pink identity palette; defensive team recoloring currently covers the full-detail review artwork only. Intermediate art tier refinements can be authored without interpolating the full sprite.
- The generic CLI contact-sheet HTML still stretches non-square assets into its square thumbnail. Both new full-size assets are square; actual atlas/runtime dimensions remain correct. This pre-existing tooling limitation is not production rendering behavior.
