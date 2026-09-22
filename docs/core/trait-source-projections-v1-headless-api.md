# Source-backed Trait Projections v1 — Headless API

Parent: PR32 `06428e50f96bbf49bd91aa1c5842ecb94750350b`.
Approved source: design `782f6b8ef2406839de5678b00040001111cd8f77`, canonical09 §§2.6/4/5.10/10.1/15 and53 §§18.1/20/21.4.

## What this module owns

`src/core/world/traits/sources/index.ts` exports:

| Operation | Contract |
|---|---|
| `getSourceTraitFamilies()` | Eight explicit example definitions across the four remaining lifecycle classes; immutable roles, owners, evidence mode, states and source references |
| `projectSourceTraits(request)` | Validate applicability of owner-produced classifications against supplied current snapshots and model/evidence policy; produce a fresh, recomputable description |
| `compareSourceTraitRequests(before, after)` | Recompute both descriptions and report changes without confusing unknown/stale data with actual disappearance |

Existing `traits/index.ts` continues to own graded, persistent learned and slow Green families. Its27-family registry and saved TraitState v1 are unchanged. New definitions have disjoint family IDs. Together the two modules represent examples of all seven lifecycle classes; neither is a claim to cover every catalog candidate.

No UI, screen, button, observer, Match Core, physical effect, action intent or storage adapter is connected here. Audit reference names are not final user-facing naming decisions.

## Explicit subset and ownership

| familyId | Lifecycle | Required owner data |
|---|---|---|
| `line_drive` | DYNAMIC_DESCRIPTOR | Batting contact distribution |
| `pitcher_contact_distribution` | DYNAMIC_DESCRIPTOR | Pitching contact distribution; one ground/fly variant |
| `gyro_pitch_shape` | DYNAMIC_DESCRIPTOR | Physical pitch trajectory/spin-shape source |
| `wild_stuff` | DYNAMIC_DESCRIPTOR | Real pitch-quality benefit AND command-variance cost |
| `release_miss_pattern` | CAUSAL_NEGATIVE_DYNAMIC | Unintended delivery failure/miss source, not ordinary side movement |
| `command_instability` | CAUSAL_NEGATIVE_DYNAMIC | Command/release reproducibility source |
| `team_matchup` | RELATIONSHIP_CONTEXTUAL | Player familiarity plus target roster, pitch profile and tactics |
| `pitcher_result_history` | CAREER_HISTORY_DESCRIPTOR | Retrospective player/team-result history, HISTORY_ONLY |

The registry explicitly owns `evidenceMode`. Statistical/contextual/history descriptions require recognition evidence even when a caller labels the update DEVELOPMENT. Actual physical/negative-source changes can project directly with cause evidence. No class is inferred from blue/red/gold naming and no unregistered family is guessed.

## Input boundary

`SourceTraitRequest` carries:

- `projectionId`, career/player `scope`, monotonic career `time {season,day,sequence}`, `worldRevision`, optional targetTeamId;
- a versioned policy with each assessed family's classifier model ID/version and recognition minima;
- `currentSources`, supplied by the authoritative owner, not copied from an old classification merely to make it pass;
- at most one classification per family in this query context.

Each source snapshot binds career, owner kind, subject ID, opaque source key, revision, immutable snapshot ID and time. Player-owned roles must match the request player; target-owned roles match the assessment target. One source namespace/current revision and one immutable snapshot identity are permitted. JSON tuple keys avoid delimiter collisions.

A classification includes its immutable ID, scope/time, recognized state ID or null, target, model ID/version, RECOGNITION/DEVELOPMENT/BOTH provenance, exact role-to-snapshot bindings and evidence episodes. Episode IDs, event IDs and instants cannot be duplicated to inflate recognition. Evidence must not come from the future or contradict season/day order.

There is no production classifier or numerical game calibration bundled here. The source owner must derive the classification from actual physical/technical/statistical evidence. The library validates that classification's links, currentness and declared recognition sufficiency. A valid ID does not prove a truthful diagnosis. Test policies/fixtures are synthetic and not tuned world defaults.

## Status semantics

| Status | Meaning |
|---|---|
| PRESENT | A current, applicable and sufficiently supported classification names one recognized state |
| ABSENT | The current qualified classification explicitly names null |
| UNASSESSED | No classification was supplied for this registered family |
| UNAVAILABLE | Model changed, dependency missing/stale, or recognition/cause evidence insufficient |
| OUT_OF_CONTEXT | Target-specific classification is not for the requested opponent, or no opponent was requested |

`UNAVAILABLE` and `UNASSESSED` are **not** null diagnoses. They must not be displayed/stored as proof of recovery, loss or absence. The root `stateId` is null in those statuses, while the old parsed assessment remains audit evidence only. Consumers use effective status/stateId, not `assessment.stateId` as a shortcut.

Changing current opponent roster/pitch/tactics/familiarity invalidates old `team_matchup` evidence even if the club name is unchanged. A different opponent produces OUT_OF_CONTEXT, not another permanent killer trait. No reverse relationship or target debuff is generated.

History-only labels never expose executable effects. Changing or clearing their current description does not rewrite match results or erase original history. Likewise wild-stuff produces no extra unpredictability advantage, and descriptors never re-add their physical/skill source as a bonus.

## Difference semantics

Both input requests are reparsed and projected; caller-made projection rows are never trusted.

PRESENT->PRESENT with another variant is CHANGED. PRESENT->qualified ABSENT is CLEARED. A fresh PRESENT after a non-present state is APPEARED. Losing known presence/absence to stale/missing evidence is BECAME_UNAVAILABLE. Unknown->qualified ABSENT is RESOLVED_ABSENT. Other label-preserving cases are UNCHANGED, with before/after evidence retained.

These are description transitions, not acquisition/development events. A disappearance alone does not establish why a player improved, and a newly recognized descriptor does not prove new skill growth.

Comparisons require the same career/player/target, nondecreasing world/time and source revisions, consistent immutable IDs and unchanged content under the same policy version. Recomputing the identical request is allowed. New target contexts require new queries rather than a misleading cross-target loss event.

## Example integration shape

```ts
import { projectSourceTraits, compareSourceTraitRequests } from './src/core/world/traits/sources';
// Owner services construct these typed requests from authoritative snapshots.
const result = projectSourceTraits(currentRequest);
if (!result.ok) return result.reason;
for (const entry of result.value.entries) {
  // Expose data to a future read-only consumer; do not mutate ability state.
  if (entry.status === 'PRESENT') collectDescription(entry.familyId, entry.stateId, entry.route);
}
const diff = compareSourceTraitRequests(previousRequest, currentRequest);
// Persist provenance or send a domain notification only through the host's transaction.
```

`SourceTraitFixtures.test-support.ts` contains complete synthetic examples for tests. It is not production setup or a sanctioned classifier implementation.

## Host responsibilities and remaining work

Authenticate snapshot/model/event identity and immutability, genuine source changes, meaningful episode cadence, evidence quality and physical causality. Maintain global uniqueness/version registries across requests; pairwise comparison sees only the two supplied requests. Select truthful current source references atomically with the world revision, resolve target identity, and manage persistence.

These are data-consistency checks, not cryptographic proof or an authorization boundary. Proxy objects or adversarial code execution are not sandboxed; public inputs are inert JSON-like DTOs. Validation rejects accessors/sparse arrays/unknown properties and never invokes normal property getters.

Future work includes calibrated source classifiers and actual numerical consumers, full Appraisal/MatchImportance, additional approved family ownership, negative two-strike/pressure family consolidation, development, world integration and a separate UI handoff. Do not independently revive rejected probability buffs or replace the completed Swing Kinematics engine.
