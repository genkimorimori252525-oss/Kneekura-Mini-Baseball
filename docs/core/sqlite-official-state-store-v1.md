# SQLite official-state persistence v1

`src/host/SqliteOfficialStateStore.ts` is a Node 26 host adapter for the pure Core official-closure and next-play APIs. It uses built-in `node:sqlite`; no package dependency or Presentation code is added.

## Transaction boundary

The host initializes a match once with `initializeMatch(matchId, initialMatchState)`. `applyAndActivate` then:

1. re-derives a closed live-ball or supported non-live official MatchState through Core;
2. validates the receipt and next-play activation against the closure, then constructs the next physical world from the official base occupants and supplied field/defender setup;
3. takes a SQLite `BEGIN IMMEDIATE` transaction;
4. checks the expected durable revision and prior MatchState;
5. writes the applied MatchState, next-play activation, reset world and application identity together;
6. commits before returning a receipt or activation.

The database uses WAL and `synchronous=FULL`. A failed insert rolls back the prior state update. A crash after commit but before the caller receives the result can be retried using the same `applicationId` and identical input; the stored result is returned without advancing the revision again. Reusing an ID with different input or applying one closure under a second ID fails. The `(matchId, closureId)` uniqueness constraint and revision comparison are enforced in the transaction.

`getMatch` restores the last committed MatchState, durable revision, next-play activation and reset world after process restart. Older v1 rows containing only an activation remain readable with `nextWorld: null`; the host must prepare a world before running that next play. The schema is versioned at v1; a newer schema is rejected rather than interpreted as v1.

`applyAndActivate` requires `worldSetup` for both live and non-live plays. Core uses the newly derived official base occupancy to generate exactly those stationary runner actors at the supplied canonical base centers. It resets all nine defenders to idle assignments and clears the old ball. Duplicate actors/positions, overlapping runner and defender IDs, non-distinct bases and active previous-play controllers fail before the SQLite transaction. The host supplies canonical field geometry and the actual current controller registry; this adapter cannot authenticate those external facts.

## Scope

The adapter covers live-ball closure and the non-live strikeout/walk paths that Core already supports. HBP is not added because no approved canonical non-live HBP application path exists in this stack.

The caller supplies the database location, match identity, canonical physical timeline and adjudication ledger. The adapter does not invent physical evidence or official rulings. Database backups, multi-host replication and schema upgrades are separate host operations.
