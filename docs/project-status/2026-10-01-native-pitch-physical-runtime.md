# Native pitch history into physical Match execution

## Approved source and change

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, frozen document55, approved pitch timing and the existing world-first physical/adjudication contracts. The user authorized all latest confirmed nonvisual work. Design/UI and merges remain excluded.

The existing Native delivery runtime stopped at a release DTO. Its new additive `resolvePlayerPitchAgainstBatterFromWorld` consumes the accepted timing/release history at the requested game day, starts an actual microsecond trajectory from that release, and records the actual take/swing resolution through the existing Core. Caller-supplied physical execution and batter action remain explicit. There is no forced target, counted-pitch label, form buff, new result engine or default calibration. Play scope, active timeline, ready time and flight duration are checked before history reads; Core checks the flight interval and swing time unit.

## Verification evidence

- RED: the new integration tests failed because the production function did not exist.
- GREEN: 2 files / 4 tests passed; `tsc --noEmit` passed.
- Actual Native roster, Player-Person link, pitch timing and release stores supply the physical runtime. 120 varied NORMAL/QUICK and STANDARD/DELIBERATE pitches retain exactly one position while release times vary.
- A physical taken pitch reaches the strike zone and causes a canonical terminal strikeout. Existing rules derive the next state and existing Native Official persistence saves it, activates the next play and replays the exact application after reopening.
- An accepted later form change lowers the physical origin and changes the actual plate-crossing result with identical velocity/spin/acceleration. A classification-only change has no effect. Past-day queries and the persisted Official application remain unchanged.
- Physical contact, missed swing and unresolved flight continue through their existing Core paths. Wrong play, stopped timeline, unsafe time, missing Player and pre-baseline day are rejected.
- One fresh independent read-only review: no Critical, Important or Minor findings; its focused 2-file / 4-test gate passed independently.

Final `npm run verify` passed catalog generation, typecheck and all 522 files / 3,116 tests in 681.18s. The actual regional registered-roster Match gate took 676.460s. No test timeout, P9 fingerprint or existing result engine was changed.

## Continuing scope

This connects accepted per-Player physics histories to actual pitch/batter execution and durable Official state. It is not a complete autonomous Match/Career driver. The ongoing approved audit includes causal workload/recovery, initial Player-body/release generation, larger national-pool selection and full season/Career integration. Exact content/calibration inputs remain explicit. No old candidate plan is promoted by these observations; the overall goal is active.
