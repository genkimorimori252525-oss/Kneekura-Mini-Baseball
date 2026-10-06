# Original settled-foul stop producer contract

Status: source/type/test contract only. No producer behavior, runtime variant or schema installation is implemented. Base source is `11f5d7830ba2637debacdf7d59cd36416b2c7ac8`; the separate read-only count GREEN remains pending.

## Capability and bounded output

Add an explicit accepted runtime variant with the existing four reference fields, using capability `causal_original_settled_foul_runtime_v1`. It is registered through the existing runtime owner before governed field/controller work. Preserve the existing original-pitch and `(gameId, playId)` UNIQUE constraints, original ownership mirrors and late-registration rejection. Existing `causal_original_live_play_runtime_v1` Source and membership bytes remain unchanged.

The new membership uses version `original_settled_foul_membership_v1` and live-rule policy `untouched_settled_foul_producer_only_v1`. It retains all 70 existing participant/global producer entries exactly and adds one explicit global producer:

```ts
{
  producerId: json(['actual_settled_foul_stop_producer_v1', originalScopeId]),
  domain: 'settled_foul_stop',
  playerId: null
}
```

All ten original participants and existing admission/observation/controller policies remain present. The new domain accounts for original field-action stop interpretation; physical rule consumption remains separately unresolved. No first-base scope or completed frontier is inferred from this membership. A first-base end requiring its original 70-member scope must continue to reject this different capability.

The smallest new owner produces one authenticated settled-foul stop event and one pending `foul_rule_evidence` successor. It does not consume that successor, select count/bunt intent, end physical action, apply a foul timeline, create an official result, charge workload or admit another pitch. The existing first-base v1 queue/result format remains unchanged. A new read-only census adapter combines its represented queue with the explicitly versioned foul producer.

## Accepted Source and immutable schema

```ts
type AcceptedActualSettledFoulStopProduction = {
  sourceId: string;
  sourceVersion: string;
  capability: 'actual_original_settled_foul_stop_producer_v1';
  physicalPitchSourceId: string;
  runtimeSourceId: string;
  policySourceId: string;
  baseFieldSourceId: string;
  executionSourceId: null;
};
```

This first category accepts original field-action cuts only. A non-null execution cut is unsupported. No contact, stop time, availability, count, intent, result, schedule, producer set or replacement evidence is accepted. The physical pitch must equal the new runtime, accepted venue policy and selected field's original pitch. The policy binds the existing registered NPB profile/model/geometry/category; no new calibration or rule value is introduced.

Dedicated main table `actual_settled_foul_stop_productions`:

```sql
source_id TEXT PRIMARY KEY,
source_version TEXT NOT NULL,
capability TEXT NOT NULL,
physical_pitch_source_id TEXT NOT NULL UNIQUE,
runtime_source_id TEXT NOT NULL UNIQUE,
policy_source_id TEXT NOT NULL,
base_field_source_id TEXT NOT NULL,
execution_source_id TEXT CHECK(execution_source_id IS NULL),
game_id TEXT NOT NULL,
play_id INTEGER NOT NULL,
ownership_key TEXT NOT NULL UNIQUE,
original_stop_key TEXT NOT NULL UNIQUE,
source_json TEXT NOT NULL,
source_hash TEXT NOT NULL,
snapshot_json TEXT NOT NULL,
snapshot_hash TEXT NOT NULL
```

The result has revision 1 and singleton Source history. There is no mutable head. Its ownership key is `json(['actual_original_settled_foul_stop_producer_v1', physicalPitchSourceId])`; Source aliases cannot publish a second event for the same original pitch. Exact retries and historical reads rederive the immutable original prefix.

Use a dedicated owner with the existing transaction/admission pattern. The generic immutable receipt helper currently assumes a six-column table and a first-base capture ownership field; it is not extended by bypassing those assumptions. New writes must append the concrete producer to `actual_live_play_admissions` in the same write transaction, rederive all dependencies and raw mirrors afterward, and require exactly the receipt plus admission write with no unrelated trigger effect. Same-Source retry adds neither row nor admission. Main-only authority storage and caller-owned read transactions/authorizers/settings remain protected.

## Exact event and availability identity

Reconstruct the complete existing v1 venue evidence at the selected cut and require its actual untouched settled-foul conclusion. Retain its full raw decisive-stop origin array and all original physical contacts. The first slice requires the current original field head to be the decisive rolling-stop field action itself: no earlier raw rolling-stop owner, later field/execution work or delayed interpretation cut is admitted during first acceptance.

The original stop key is:

```ts
json(['original_settled_foul_stop_v1', physicalPitchSourceId,
  hash(basis.contactOrigins.decisiveStop)])
```

The origin array is the existing deterministic, unfiltered v1 order. Each entry already contains original owner/source/version/revision/source hash/snapshot hash, raw location/index and exact moment. It is part of the archived result and rederived on every read; no selected origin, rounded tick alone or filtered contact array may replace it.

The event ID is `json(['settled_foul_stop_v1', originalStopKey])`. Its queue key uses existing `actualLiveEventKey('actual_settled_foul_stop_productions', sourceId, eventId)`. The immutable event payload records `kind: 'settled_foul_stop'`, the original stop key and exact `{originTick, elapsedSeconds, tick}` from the decisive Core moment. Availability is separately derived from the authenticated original scope cut's `at`, with that cut and its physical references retained. For this first immediate-cut category occurrence and availability must be equal; wall-clock acceptance time is not a simulation clock.

The pending successor has kind `foul_rule_evidence`, local ID `json(['settled_foul_rule_evidence_v1', originalStopKey])` and existing `actualLiveSuccessorKey` derivation. It references the exact event key and remains pending with no consumption. The immutable snapshot omits a self-referential snapshot hash. The census wraps the rederived event/successor with the owner reference using `hash(savedProduction)`; all referenced original physical/policy hashes remain inside the saved production.

## Complete discovery for the new producer

A new census query accepts only its version, runtime Source and explicit physical cut. It authenticates the new runtime, derives the existing original participant/physical/represented queue at that cut, and accounts for the additional declared producer even when its table or row does not yet exist. Absence means pending production, never complete event generation.

Discover the union of every new-owner claim to the runtime/pitch, independently of the caller's requested Source ID:

- indexed original pitch/runtime/game-play, policy and base-field identities;
- matching original runtime admission rows whose owner is the new table;
- Source, snapshot Source and singleton history mirror references, including malformed object/array alternatives and duplicate metadata keys;
- snapshot top-level original pitch/runtime/scope and embedded basis physical-pitch/policy/field-cut identities;
- aliases whose Source/mirror identity names an already selected owner row.

Resolve policy/field/runtime references through their original indexed ownership before treating a foreign-looking row as unrelated. Every discovered claim must agree with the same original runtime/pitch/game/play and owner schema. Missing owner rows named by admissions, hidden cross-scope mirrors, duplicate/aliased ownership, foreign heads or malformed identity containers reject; they are not omitted by an indexed-only query. The Source/history shape, row columns, Source hash, unique ownership/stop key and complete admission identity must all reconcile.

Before replaying any event payload, compare the producer's field revision to the explicit query cut using authenticated original field metadata. A producer beyond that cut remains an accounted future claim with no event/successor projected; its future payload is opaque. A relevant Source/mirror identity corruption must still reject at an earlier cut. At/after its availability, fully rederive the original producer, snapshot hash, policy and physical stop, then project exactly one event and pending successor. No producer-local clock or missing table certifies a global watermark. The old represented queue's pending generation and closure state remain pending, with no PlayEnd.

## Test-first sequence

1. Freeze explicit runtime-variant acceptance contracts against the current owner. Prove the existing legacy runtime still registers before this real original field work and still rejects late registration. The intended new-capability Source rejection is distinct from fixture/setup failure. Implement only that bounded runtime variant after its observed RED and source review.
2. Under the now authenticated new runtime, execute a new original foul stop with the existing physical owners and accepted input `(1, 0, -30)`. Preserve the existing stationary bat-placement procedure, models, geometry, materials and legacy absent intent. Register before the first governed field action, never after the saved stop. Freeze the producer/census scaffolds and run their behavioral assertions before implementing successful production.
3. Positive producer contracts cover exact event/origin/availability keys, one admission, retry, alias rejection, earlier-cut opacity/current-cut projection, all-handle disk close/reopen, unknown count and pending successor. Negative contracts cover a legacy runtime, absent/late runtime, foreign policy/pitch/cut, unsupported execution cut, non-stop cut, supplied results/times/producer lists, hidden ownership mirrors, missing admissions, concurrent dependency changes, unrelated trigger rollback and caller transaction/main-only boundaries. Keep existing v1 Source/result bytes and registration tests unchanged.

The precise frozen case names/outcomes belong to each held gate. Future assertions behind an unsupported capability or throwing scaffold remain unproved until their respective GREEN. Producer/census success does not authorize the later causal foul consumer, physical end, same-PA reset/resume, workload reservation/settlement or repeated-batted-pitch geometry changes.

## Runtime gate classification

`OriginalSettledFoulRuntimeContract.test.ts` has six cases. On the current v1-only implementation, the three valid new-capability acceptance/retry/freeze cases fail at `invalid causal actual live-play runtime Source`; the fourth new-capability late-registration case fails its expected pre-work-fence assertion because capability parsing rejects earlier. The two existing-capability controls must pass, including a real original foul executed after legacy pre-work registration and the existing late-registration rejection. Include the unchanged one-case `ActualLivePlayRuntime.test.ts` shape regression: seven collected cases, four missing-capability failures, three passes, zero skips/setup errors. The late new-capability guard and later assertions behind valid new acceptance remain unproved at this RED.

Only the runtime variant is eligible for implementation after that RED. The producer and census stay throwing scaffolds until a separate behavioral RED executes them under the actual new runtime and genuine original foul prerequisites.

## Producer contract classification

`ActualSettledFoulStopProducerContract.test.ts` has 26 cases prepared for the later producer scaffold RED. Its shared fixture construction requires the separately verified new runtime capability and genuine pre-registered physical stop, so this file is not an eligible runtime-variant RED selection. Once that prerequisite exists, the exact expected outcome is 14 failures at `ACTUAL_SETTLED_FOUL_STOP_PRODUCER_NOT_IMPLEMENTED`, 12 rejection-only passes, zero skips and zero fixture/other errors. The contract includes pending producer discovery before publication, full event/origin/key/admission comparison, retry/alias fencing, future-payload opacity, four independent hidden metadata claims, missing admission, strict reference-only Sources, legacy capability separation, read transaction/authorizer/main-only behavior, unrelated Match-trigger rollback, a real concurrent WAL writer, and complete original-file close/reopen.

The producer tests use a separate unproduced scope for invalid Source fields/references; an existing published row cannot make those negatives pass merely through the uniqueness guard. Trigger/WAL cases first require the valid missing-row reader behavior, so no schema/setup error is misclassified as intended scaffold RED. All later assertions remain unexecuted at the throwing scaffold.
