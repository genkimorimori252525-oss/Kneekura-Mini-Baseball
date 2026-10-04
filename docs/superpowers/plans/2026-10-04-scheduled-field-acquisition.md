# Scheduled actual field acquisition

Status: implementation in progress, 2026-10-04 JST

Continues the confirmed non-design plan after actual observation. The prior cumulative Source at [8d752788](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/8d75278876c179974bd037f5736cb3d40cc1e6e8) passed `npm run verify`: typecheck, 648 files / 4,554 tests, exit 0. That result does not certify the changes described here.

## Contract

1. Begin only from an adopted sole-glove contact, original Player/Person and complete inherited motor/geometry/retention evidence
2. Prepare immutable scheduling metadata without executing future collisions or selecting a future result
3. Derive exact energy-completion time from the existing load and dissipation power; retain its original recorded-tick competition fence
4. Advance only a bounded actual interval. Preserve original trajectory basis, incoming energy, contact offset and every physical companion contact
5. Distinguish capturing, energy-complete/fence-pending, confirmed acquisition and interrupted capture
6. Confirmed evidence retains the original exact secure moment, while the current carried cursor remains at the executed fence. Never rewind the adopted physical horizon
7. Before confirmation, known constrained ball motion may be observed, but it grants neither possession nor ordinary continuation authority
8. Preserve pending possession uncertainty in base/rule observations. Empty confirmed control cannot prove SAFE when an unresolved earlier secure candidate could change the race
9. Keep the existing single Native execution owner, immutable bounded reads, current writes, own-DB proof, WAL rollback and archived atomic formats
10. Completion of this one source leaves custody/contact/rule consumers open. It is not actor settlement, a complete registry, PlayEnd or official closure

## Implementation sequence

- Add Core prepare/validate/advance/replay with TDD for partial energy, fence boundaries, zero duration, inherited coverage, overflow, actual collisions and partition equivalence
- Add source-specific live work, confirmation receipts and still-open successor handoffs
- Extend Native actions with acquisition plan/advance and reject competing physical actions while pending
- Extend whole-play/field histories with actual deltas, exact dissipation/confirmation markers, confirmed custody and constrained observations
- Add a separate possession-evidence rule guard without fabricating contacts or changing legacy race interpretation
- Verify Native reopen/retry, stale and future bindings, rehashed corruption, original archive compatibility and late WAL mutations
- Review and freeze the resulting Source, run focused regression/typecheck and then a separately identified cumulative gate

## Boundaries

No production calibration defaults, alternative collision tolerances, UI/art/Presentation connection, inferred physical result, empirical realism claim or complete autonomous game/Career claim. Existing numeric fixtures remain explicit synthetic test inputs. Subsequent individual decision/motor ownership and full contributor integration remain separate dependencies.
