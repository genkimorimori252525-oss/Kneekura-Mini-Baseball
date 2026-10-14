# TBD vs LAD v23 — camera, baseball geometry, bench and pitch-command correction

Date: 2026-10-14
Branch: `jolly/tbd-lad-playable-2026-10-14`
Status: **PLAYABLE STANDALONE BROWSER PROTOTYPE AUDITED; NATIVE MATCH CORE NOT CONNECTED**

## Owner-requested contract

- The previously accepted shallow **taken-pitch batter gaze is frozen**. The user explicitly withdrew the request to adjust that camera any further; v23 does not change it.
- When a fair fly is truly secured before dirt/wall, score an airborne out; stop the retired batter's run, allow third-base tag-up and time-legal sacrifice fly. When an ordinary-effort fly is mishandled, distinguish an **error** from a hit based on actual trajectory and fielder reach, never only a dramatic animation.
- Corner infielders initially stand within fair territory against the same 45° field boundaries used in presentation.
- Distance-dependent actual baseball angular size, small rotational seam study inset labeled as magnified, no minimum opaque 4px ball at long distances. Following catcher possession, hide ball in non-overhead cameras; do not raise it vertically to a fake catch point. Runner identity stays red in any view when shown.
- Terminal play 1-second visual hold. At third out, actors walk physically reachable distances **toward** their dugout for approx 2.75s. Tap from 1s into end scene to skip; early tap queues.
- On an ordinary user-started new game, regenerate seed; provide explicit seed-lock checkbox so same seed+inputs remains reproducible. Preserve manager instruction issue boundary: already-pitched balls cannot be changed by new command.

## Pitcher command vs catcher's game-calling: cause and fix

The user correctly questioned why NLB pitcher **ティカオ**, `control:97`, had too many walks and why he did not attack the edges. Detailed source inspection found that the old standalone `auto` target generator put a large proportion of pitch *intentions* too far outside and selected numerous broad random location samples. It did **not** read catcher ナッパ's existing `ratings.gameCalling=6` at all. Therefore attributing the original defect to Nappa was incorrect.

The new **standalone v23 browser** decision chain is:

```text
observed count + batter handedness + optional manager command
 -> catcher's suggested outside/inside and high/low quadrant (gameCalling)
 -> pitcher-owned count-aware correction / veto of risky suggestions
 -> concrete intended world plate-crossing coordinate (borderline strike side)
 -> pitcher CONTROL/command -> physical x/y scatter around that declared target
 -> actual ball flight + batter decision + umpire call + results
```

- Four near-edge zones are intentional. With 3 balls the pitcher tries to regain a larger inside-strike margin; when ahead at two strikes, an occasional chase ball is a valid tactic. Command accuracy does not imply always throwing in the strike zone.
- Low game-calling affects *proposals/selection*, not the pitcher's release dispersion, ball/strike decisions after the fact, or direct hitting probabilities.
- An explicit manager location request is accepted only when the **next pitch** is issued. Previously issued pitches/physical facts remain unchanged.
- Nappa has `gameCalling=6`; the historical LAD catcher in the browser roster has **no verified game-calling statistic**, so the prototype uses a neutral fallback 50 (not claimed as sourced reality).
- All comparative results are **prototype calibration** only; NLB world-relative values are not calibrated absolute 200–250 ratings in the real Native engine.

### Measured after the final edge-target revision

| Receipt | Result |
| --- | --- |
| Same 50 seed suite, **ティカオ** walk count (v22 -> v23) | **153 -> 10** |
| Same 50 seed suite, LAD pitcher walk count (v22 -> v23) | **132 -> 30** |
| First pitch in 600 seeded runs, corner-target intention | **600 / 600** |
| Realized pitch near horizontal strike edge | **476 / 600** |
| Change catcher `gameCalling` 6 -> 96 | **107 / 600** different side proposals |
| Same comparison, release deviation unchanged | **600 / 600** |
| Three-ball count: intended target inside | **600 / 600** |
| With two balls, elite pitcher vetoes overly risky bad-call proposal | **136 / 600** tested setups |
| Average measured coordinate deviation (320 each), control 97 vs 30 | **0.07667 m vs 0.14903 m** |

These are deterministic model comparisons, **not a prediction of real MLB/NLB walk frequency**. The release/command algorithm makes game outcomes different from v22. Do not assert same-score or tick-by-tick v22 parity.

## Verification and reproducibility

The user-facing single-file HTML (`ばせぼーるlv23_TBD_vs_LAD_物理描画再監査.html`), full source+baseline+receipts ZIP (`Kneekura-Mini-Baseball-v23-TBD-vs-LAD-audited.zip`), and Japanese README/receipt are **conversation artifacts**. This repository stores this receipt but does not commit embedded sprite masks and font again.

- Fixed `AUDIT100-000..099`: **100 completed nine-inning games**, **21,310 pitches**, **7,207 PAs**, **1,458,505 independent invariants**, 0 violations; raw pitch receipts `reports/audit100-per-pitch-receipts.jsonl.gz` with all 100 fingerprints.
- Additional **300 complete distinct stress games**, **63,944 pitches**, **2,238,040 invariant checks**, 0 violations.
- Fault-injection: **21/21 deliberately corrupted internal facts** detected, including misclassified fly/ground outcomes, false walk placements, unsupported HR, pitcher position mismatch, false sacrifice-fly clock, fielder outside fair line, and bench teleport.
- Browser Chromium desktop 1440px/mobile-sized 390px: **18/18 scripted checks** PASS; 5 original cameras, taken-pitch ball presentation, body move-to-bench, foul/third-out tap timing, red runners, outfield labels, 9-inning finish. Seed regenerate/lock verified separately. **Actual Android/iOS hardware NOT RUN**.
- Distinct ZIP extracted and rebuilt with Python 3, generating **byte-identical** standalone HTML SHA-256 `d2fe73e920e3910984bac26271e36521c4d7821438215295241bbcc3eaf9d3f4`. Independent receipts, pitch control, and asset checks PASS.
- Approved B1 sprite masks, palette, Japanese font embed and pitch symbol logic byte-identical to v22; sphere rasterizer **intentionally changed** to remove unnatural minimum opaque size and add distant rotational magnification.

## Important NOT VERIFIED

- Real `codex/current-nonvisual-owner-integration-2026-10-08` Native Node.js/SQLite Match Core and still outstanding genuine official LAN01 whole-case full execution are NOT tested or connected here.
- No complete production 9-inning physical adjudicator across all special rules, venue/crowds, all tags/appeals. The 400-game invariant corpus is finite and browser-model-dependent.
- Real phone hardware, browser storage restart, durable Career time, serverless PC/mobile parity and multi-device connections are NOT proven.
- Do not copy browser approximations into the Native source and claim those are the same physical model. The shared source should independently apply the tested **principles** at canonical motion/intent boundaries.

Original v16/v22 PNG and the main branch remain unmodified; this is an isolated test/Presentation branch.
