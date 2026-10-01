# Native catalog and atomic Career Club creation — 2026-10-01

## Approved scope

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4` documents 21/26/27–30/33 and the existing Core `createCareerClubs` contract. Visual design and merges are excluded. Exact money, geometry, geography identifiers, foreign Player/Person references and league financial profiles are explicit creation inputs; catalog labels and target ranks do not generate them.

## Implemented

- `SqliteClubCatalogSnapshotStore` archives the actual compiled approved catalog with a SHA-256 snapshot identity and catalog/dataset/source version tuple. Reads validate the Core catalog, canonical saved content and identity. A content change under the same tuple is rejected; accepted older datasets remain available independently of a future compiled dataset.
- `SqliteCareerClubCreationStore` consumes an accepted archived catalog and explicit creation inputs. It generates all 234 Core Clubs, then commits their Native shared heads, initial checkpoints, catalog provenance, directed rivalry graph/references and competitive threats in one SQLite transaction. The compact immutable manifest avoids duplicating all Club states.
- Persisted existing heads/checkpoints prevent reinitializing a partial Career, regardless of caller CREATION flags. Exact retries return the accepted manifest; changed inputs are rejected.
- Replay rebuilds the initial Core bundle from the archived catalog/request, verifies every initial checkpoint, and validates current heads through the accepted Club event journal. Later economic events advance current states without replacing initial seeds.
- Existing per-League World settlement owners remain responsible for their own seasons. The integration gate initializes all 21 actual catalog Leagues after the atomic Club creation.

## Verification

Focused catalog/creation gates: 2 files, 5 tests passed; `tsc --noEmit` passed. Tests cover the actual 234-Club dataset, all initial relations, reopen/idempotency, 21 domestic League owners, actual Native structural-revenue advancement without reseeding, rollback after the 101st Club insertion fails, partial existing Career rejection, invalid/missing Source/profile rejection and catalog/request/manifest/checkpoint corruption. A future compiled-dataset change is simulated only in a test, without changing production data.

An independent read-only review of all four new source/test files reported no findings. Final `npm run verify`: catalog compilation and typecheck succeeded; 519 files / 3,107 tests passed in 491.26 seconds. No rereview was performed.

## Remaining scope

This is the Native consumer of the complete Core Club seed transaction, not a UI bootstrap or a calibrated population generator. Population/person/facility initialization, full global-roster capacity, career-clock orchestration and the broader physical/runtime integration gates remain subject to the ongoing approved nonvisual audit. Existing historical content and numeric profiles remain explicit inputs. The overall goal is active.
