# Completed Match participation and rehabilitation connection

Base: `f90218f87aa283eb202485f7155988712edd9374` (`src` tree `9c2127597dcec43a60d30d07bebefe4f213ac981`).
Scope: the approved nonvisual Match-to-Career connections in the October 4 checkpoint, section 5. No new content calibration, scoring formula, visual design, National Match producer, or unowned runner motion is introduced.

## Additive participation receipts

`SqliteOfficialParticipationStore.confirmPhysicalPlayed(gameId, playerId, closureSourceId)` emits `PHYSICAL_PLAY_V1` only after the original ordinary physical closure has its authentic official, scoring, effort and workload effects. Membership comes from the original physical pitch frame, not the successor World or the closure's next-actor collection:

- The nine original defenders are `DEFENDER`.
- A separately authenticated original batter is `BATTER`. Physical pitches alone do not identify a batter or establish running.
- `RUNNER` requires the already-owned pre-pitch runner execution and matching original World membership. This connection adds no runner body, path, action or capture semantics.

`confirmFoulTerminalPlayed(...)` emits `FOUL_TERMINAL_V1` from the existing terminal completion owner. Both continuing and final completions retain the original nine defenders and batter. Incoming defenders and the next actor never supply that appearance.

Both receipts use the existing binary `(gameId, playerId)` identity and existing popularity `OFFICIAL_GAME` projection. Existing legacy and `ACTUAL_LIVE_V1` bytes are retained. An exact retry rederives the original receipt. Another closure or format for the same game/Player remains an explicit collision; it does not overwrite or reinterpret the accepted fact.

Original historical proof remains readable after later Match advancement. First admission additionally requires the current exact completed Match. Reads reject a regressed Match; final proof cannot be followed by another official revision. Both admission passes rederive original owner facts on the participation writer's Native connection around the actual INSERT, with no physical-read cache spanning that write.

## Rehabilitation consumer

The rehabilitation owner now accepts supported tagged participation only by independently rederiving its original closure on the clinical database connection. A peer receipt with the same public ID cannot replace a different local proof. The stored clinical proof retains the original receipt, original closure row and official application, fixture, binding and exact captured pregame roster snapshot.

The existing clinical requirements remain: matching Player/Person, career, fixture and day; the binding's exact roster revision; actual `REHAB` status and permitted competition participation; and genuine preceding medical/practice effects. A played appearance supplies one game fact. It does not itself create recovery, practice, fatigue or ability improvement.

Read groups use the existing Native main-only snapshot boundary. Original evidence is checked again inside the clinical write transaction and after its INSERT, preserving rollback and callback-free historical reopen/retry.

## National prerequisite

National adoption stays closed to all tagged receipts. Current actual-live, ordinary physical and terminal producers authenticate domestic `world_season_heads` fixtures and reject National registration pins. National support requires an actual Match producer tied to an accepted National competition fixture and the original National registration event/roster snapshot, with the corresponding Nation, Player, Person and day ownership. Removing a receipt discriminator check would not supply that evidence.

## Author validation and remaining integration

The focused author group covers original physical pitcher/batter participation, absence of an inferred batter, later-play history versus first admission, collision semantics, malformed completion rejection, raw ownership aliases, writer-local receipt rollback, eligible rehabilitation, unavailable-roster rejection, clinical rollback, existing legacy receipts, National rejection, and existing clinical history/WAL behavior.

Author result: **6 files / 89 tests passed**, exit 0, 26.44 seconds on Node 26. A targeted TypeScript project rooted at the changed production/test imports also passed with exit 0. These results qualify this component's focused author checks, not the complete parent integration.

```sh
node node_modules/vitest/vitest.mjs run \
  src/host/world/CompletedPlayParticipation.test.ts \
  src/host/world/CompletedParticipationRehab.test.ts \
  src/host/world/ActualLiveParticipationConsumers.test.ts \
  src/host/world/ActualLiveParticipationMetadata.test.ts \
  src/host/world/SqlitePlayerHealthRehabStore.test.ts \
  src/host/world/HealthRehabWal.test.ts --maxWorkers=1 --minWorkers=1
```

These are small Native fixtures with explicitly synthetic bodies and calibration. They do not qualify production numerical content. The terminal tests in this group reject malformed original owners; successful authentic terminal half/final participation and genuine actual-live rehabilitation remain for the parent batch's consolidated integration run. Existing genuine rehab consumer leaves now expect missing original roster proof or a different local receipt, instead of universal tag rejection; their large-artifact gates were not rebuilt or rerun here.

No full suite, home-PC CI, publication, merge, deployment, or large artifact copy was performed for this component. The supplied base's unrelated `BattedEpisodeV3FieldContract.test.ts` widening error is fixed separately in the parent assembly; this branch does not edit that file.
