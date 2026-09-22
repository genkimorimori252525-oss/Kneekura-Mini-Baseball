# Source-backed MatchImportance / Appraisal v1 — headless API

Approved behavioral source: 05 §§3–7,10,12–13,08 §15.50,09 §10.1,52 §4 at `782f6b8ef2406839de5678b00040001111cd8f77`. Parent: PR35 `e405394e9841c6a183d0234da069dc2d1712b54e`.

## Public entry points

Import from `src/core/world/psychology/appraisal/index.ts`.

- `deriveMatchImportance(input: unknown): EmotionResult<ImportanceResult>`
- `appraiseEmotion(input: unknown): EmotionResult<AppraisalComputation>`
- `evaluateAppraisedEmotion(state: unknown, input: unknown): EmotionResult<AppliedAppraisal>`

Successful results are detached, deeply frozen data. Failure is `{ok:false,reason:{code,path}}`; the caller's input/state is never modified. No I/O, random draws, wall-clock reads, UI or rendering. Full compile-time input contracts are exported; public calls still validate runtime data.

## Source-owned inputs, not magic match flags

`ImportanceInput` binds career/match/player/context/time plus club/opponent. It requires current competition, personal and directed-rivalry snapshots with distinct source IDs, revisions and canonical times. A source newer than appraisal time or older than the versioned permitted age is rejected, not converted to low importance.

The competition owner supplies projections of THIS club winning and losing THIS match from the same source snapshot. Each supplies rank, opponent rank, championship/qualification/elimination status. Ranks are within participant count and must move coherently. `null` rank explicitly means not applicable (e.g. a pure knockout bracket), NOT unknown standings; both projections must agree on applicability. Status flags are explicit booleans, with championship implying qualification and elimination incompatible with qualification. The next round/qualification target must mean the same thing in both projections.

This boundary does not solve schedules, standings, complex tie-breaks or every possible drawn result. It compares the supplied win/loss counterfactual endpoints; they remain hypothetical and do NOT declare the actual match winner.

## MatchImportance arithmetic (implementation/calibration choice)

The specification gives inputs and causal boundaries, NOT approved numerical constants. v1 implements:

- stage component: max(configured competition-kind level, configured stage level);
- standings leverage: own rank movement between loss/win divided by participantCount-1;
- championship, qualification, elimination leverage: 1 when the corresponding status differs between endpoints, otherwise 0;
- matchup leverage: the opponent's rank movement between own win/loss, normalized by field size;
- urgency: 1/(1+remainingGamesAfterMatch);
- personal components: record, return, personal history, and directed rivalry intensity * THIS player's club identification;
- PersonalStake: max(personal components), not their duplicated sum;
- importance: normalized nonnegative weighted mean of these eight components.

Kind/stage levels, weights and source ages come from an explicit versioned model. Weights and levels are [0,1]; at least one weight is nonzero. Relative weight scaling does not change the result. No per-match manual importance value is accepted. No production defaults are shipped. Source providers must supply current personal history/club identification and actual rivalry values, not infer them from a club name.

## Appraisal arithmetic (explicit versioned reference model)

The player snapshot contains CURRENT realized judgment, experience, concentration, stability, confidence, competitiveness, self-focus and aggression, each in [0,1], plus current long-term strain. These are numerical source inputs, not permanent ratings for fear/anger. The source owner must consolidate shared pressure/mental causes once before export. Trait grades, Star/Superstar candidate flags, raw latent potentials and direct outcome bonuses are not accepted fields.

The event snapshot supplies expected and perceived outcome on the same [0,1] appraisal scale, tactical deviation, local leverage and current recent-success/failure/hostility summaries. Those summaries and expectation semantics remain source-owned, not rederived from names or hidden outcome probabilities here. The initiating event ID must occur in the evidence list.

Positive/negative surprise are the nonnegative parts of perceived-minus-expected and expected-minus-perceived. Along with tactical deviation, recent history, strain, PersonalStake and local leverage they form nine situation features.

For every one of the FIVE emotion rows:

`drive = bias + dot(situation, situationWeights) + dot(currentResponse, responseWeights)`

`pressure = clamp01(drive * (1 + importanceGain * importance))`

`scale = pressure * (1 - currentStability * stabilityDamping)`

The row's full-pressure six-component effect offer is scaled. Signed integer tick shifts use symmetric half-away-from-zero rounding; unit decision deltas are scaled directly. Common behavioral impact is the maximum absolute component, with tick shifts divided by the shared `impactTickScale` and unit deltas already in [-1,1]. Timing templates exceeding this shared scale are rejected to prevent clipping unequal effects into false ties. Zero effective offers have zero behavioral impact.

All coefficients, effect templates, damping, importance gain and timing comparison scale are supplied as a versioned calibration. This is executable reference-model arithmetic, NOT a scientifically validated universal psychological formula or a production population calibration. Synthetic fixtures demonstrate possibilities, not deployment values. The model is memoryless given the full snapshots; history accumulation belongs to its existing owner.

## Single authority for actual influence

`appraiseEmotion` returns all candidates as PROPOSALS plus computed components, metrics and full normalized input provenance. Candidate effects must not be applied by an executor directly.

`evaluateAppraisedEmotion` validates the existing EmotionState, enforces exact full gate-policy equality, rejects reuse of the immediately preceding bundle ID, calls existing `evaluateEmotion` exactly once, and obtains existing `getEmotionInfluence` from the resulting state. No alternative selection, activation/sustain, calm counter or emotion store is implemented. Neutral influence has `effects:null`. The current winning emotion replaces rather than stacks influences.

Only the returned `influence` is a future execution input. The returned `state` and accepted gate `event` are a persistence proposal, not an already-committed world mutation. The headless scope does not bypass the eventual requirement that canonical execution and its observer see the same accepted state. Neither consumer is connected here.

## Provenance and replay

`bundleId` must name the exact immutable normalized source/model bundle retained in `computation.provenance`. `appraisalModelVersion` encodes model ID/version unambiguously. Accepted gate events replay through existing `replayEmotionEvents`; raw source bundles can also be recomputed with `appraiseEmotion` for equality checking. Replay does not consult a new model or reroll emotions.

The host authenticates genuine source IDs, event cadence, numerical units, causal decomposition and current selection; enforces immutable ID/version-to-content mappings and global deduplication (beyond the immediate prior bundle); and atomically saves bundle + state + event with the world revision. Structural validation and deterministic replay do not provide cryptographic authenticity, a full global historical audit, or physiological feasibility guarantees. Current sources may have different revisions and timestamps within the allowed age; selecting a coherent world snapshot is a host responsibility.

## Explicit exclusions / next

No source actor generation, new persistent emotion gauges, actual league projection solver, full Appraisal population calibration, outcome buffs, event collector, physical execution consumer, database, UI or renderer. Swing Kinematics remains separate and unchanged. Next review: source-backed numeric consumers/coordination with the verified production swing branch and coherent state+event acceptance. Remaining joint wild-stuff, matchup/history recognition and career/world/competition/manager/development queues are not closed by this work.
