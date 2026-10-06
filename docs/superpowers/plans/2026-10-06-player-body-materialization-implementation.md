# Player body materialization implementation plan

**Goal:** Compose accepted body/pose/calibration and original native role evidence into immutable actor receipts consumed by the existing Batted World contact owner.

**Spec:** `2026-10-05-player-body-capability-materialization-contract.md`; exact 84-case contract carried in dceaf2b. Coordinator-qualified RED: `/workspace/shared/baseball-body-materialization-current-preparation-dceaf2b-v2/red1/terminal.json`, SHA-256 `29dd1ef691e778c5643b1bb4414616af5971713a23a7a37573b90cd68aa7e03c`.

**Architecture:** Reuse the existing Person/fielding/reach kernels. Expose the existing release validator on the composing connection, retain its original accepted history prefix, and add two immutable composition archives. Extend the existing model shape additively and keep physical execution in the existing contact consumer.

## Constraints and review focus

- Accept explicit body/pose/calibration; derive only supported reach; preserve skills and supplied pose dimensions
- Preserve opaque sourceVersion and legacy archive bytes, including versions equal to the new kind string
- First release admission selects current at-day evidence; replay validates the original pinned history prefix after later equal-day append
- Validate dependencies and inserted archives on the writing connection before commit; trigger mutation must roll back
- Discover original claims in main scalar keys and every exact source/snapshot JSON path; reject moved, duplicate, inconsistent or downgraded claims
- Missing required pins remain pending after supplied evidence is validated; no partial actor or fabricated geometry
- Actual registered actor superset is supported; absent away-2 inputs do not reuse the earlier batter

## Steps

- [x] Preserve and inspect the qualified intended missing-opener RED
- [x] Extract the original release reader and expose native pin/replay without schema installation
- [x] Add accepted input/actor composition and immutable same-connection receipt ownership
- [x] Add immutable model assembly ownership and connect native contact writer/archive checks
- [ ] Review exact production diff and prepare bounded 84-case, compatibility, Native and compiler controls
- [ ] Coordinator runs held checks; repair observed failures and preserve all attempts

No runtime, lock admission, GREEN or aggregate acceptance is authorized during this source-preparation phase.
