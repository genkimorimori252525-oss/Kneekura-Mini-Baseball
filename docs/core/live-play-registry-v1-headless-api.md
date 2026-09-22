# Live Play Registry v1 — headless API

This slice composes independent live-action/event sources into one shared ActionFrontier and PlayEnd decision. It does not calculate physics, interpret baseball rules, persist events, or implement OfficialPlayClosure.

Implementation: `src/core/sim/liveAction/LivePlayRegistry.ts`.

## Registry model

A `LivePlayRegistry` owns:

- `playId`;
- a CAS-style registry `revision`;
- active `LivePlaySource` entries;
- retired-source revision tombstones.

Each source may contribute:

- one event-queue watermark status or `null`;
- pending physical work;
- issued intents;
- in-flight information;
- pending actor decisions;
- live rule windows.

Source IDs are unique. Queue identity must equal the owning source ID.

## Updates

`upsertLivePlaySource(registry, expectedRevision, source)`

- requires the caller's expected registry revision to match;
- increments registry revision;
- requires source revision to increase monotonically;
- also compares against a retired-source tombstone, preventing stale work from being resurrected after removal.

`removeLivePlaySource(registry, expectedRevision, sourceId)`

- requires matching registry revision;
- removes the active source;
- records its last source revision as a tombstone;
- increments registry revision.

A later legitimate re-registration must use a strictly newer source revision.

## Resolution

`resolveLivePlayRegistry(registry, input)` performs the existing authority chain:

1. collect every non-null source queue;
2. `resolveEventQueueWatermark`;
3. merge all source work categories;
4. `createLiveActionFrontier`;
5. `resolvePlayEndFromFrontier`.

The registry does not resolve duplicate work IDs. If independent sources claim the same work ID, the existing ActionFrontier rejects the assembled frontier.

An unresolved event source may keep `nextPendingTick: null` while its `settledThroughTick` remains behind the current tick. That still blocks PlayEnd through the global watermark.

## Terminal conditions

Only the four existing terminal values are accepted:

- `none`;
- `dead_ball`;
- `all_offense_terminal`;
- `terminal_rule_event`.

A terminal condition may ignore irrelevant ordinary motion exactly as ActionFrontier already specifies, but same-tick event settlement and live rule windows still block physical PlayEnd.

## Input integrity

Registry and resolution inputs are descriptor-cloned before use. Active getters/accessors, symbols, functions, cycles, sparse/malformed arrays, non-plain objects and non-finite numeric payloads are rejected without executing caller code.

## Host responsibilities

The host still owns:

- producing/updating source contributions from batting, runner, fielding, perception, rules and downstream physical-event adopters;
- deciding which actors are relevant and supplying their explicit play dispositions;
- atomically applying canonical world/events before replacing/removing a source;
- global action/event deduplication and persistence;
- crash recovery;
- post-PlayEnd adjudication and OfficialPlayClosure.

This v1 is physical-live-action assembly only. UI/rendering remain read-only observers and are untouched.
