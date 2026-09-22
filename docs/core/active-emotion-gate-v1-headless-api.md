# ActiveEmotion gate v1 — headless API

## Scope and source

Implements the approved gate in `05-psychology-emotion.md` §§2–3, 6–8, 12–13 at design commit `782f6b8ef2406839de5678b00040001111cd8f77`. Trait pressure ownership remains with 08 §15.50 / 09 §10.1; acquisition and lifecycle remain separate work.

This is a functional gate, not full psychology, a calibrated appraisal model, a visible emotion mark, or live-game effect integration. It changes no physical swing, hit/out probability, player ability, UI, or renderer. A future host must connect execution and observation together: no invisible effect and no cosmetic-only mark.

Import from `src/core/world/psychology/index.ts`.

| Operation | Input | Result |
|---|---|---|
| `createEmotionState` | `{scope, policy}` | Validated neutral state |
| `restoreEmotionState` | Serialized state | Detached validated checkpoint |
| `evaluateEmotion` | State and complete appraisal | Next state + receipt, or original state + rejection |
| `getEmotionInfluence` | State | Exactly one active identity/current effect offer, or empty influence |
| `replayEmotionEvents` | Checkpoint and accepted receipts | Recomputed validated state |

Creation, restore, query and replay return `{ok:true,value}` or `{ok:false,reason:{code,path}}`. Evaluation returns `{ok:true,state,event}` or `{ok:false,state,reason}`. Rejected evaluation retains the original input-state reference without changing it. Success data is detached and deeply frozen; caller input is neither modified nor frozen. These functions are synchronous and perform no I/O.

## Contract

`scope` is `{careerId,matchId,playerId}`. IDs are opaque nonblank strings, not trusted evidence merely because they exist.

The host supplies a versioned policy, with exactly one threshold pair for each of `SUPERIORITY`, `MOTIVATION`, `FEAR`, `IMPATIENCE`, `ANGER`. Each pair must satisfy `0 <= sustain < activation <= 1`. Equality enters/sustains. `clearAfterCalmEvents` is a positive safe integer. No production threshold or clearance default is selected here. Policy is fixed for this state; mid-match policy migration is not supported.

An appraisal includes exact scope, policy reference, expected revision, `{tick,sequence}`, appraisal ID, context ID, appraisal-model version, source-snapshot ID, nonempty unique evidence-event IDs, and exactly five emotion candidates. Time fields are nonnegative safe integers. Sequence orders appraisal evidence at one simulation tick; it does not adjudicate physical simultaneity.

Each candidate supplies `candidateId`, `pressure`, `behavioralImpact`, and `effects`. Pressure and impact are finite [0,1]. Upstream must produce comparable impact estimates for this appraisal and authentic causal evidence. This module does not derive pressure or impact from match importance, personality, rivalry, traits, or raw events. Model-version authenticity and compatibility are host responsibilities.

The bounded effect vocabulary is:

- `swingDecisionShiftTicks`, `throwIntentShiftTicks`, `defenseReplanShiftTicks`: signed safe-integer simulation-time offers;
- `swingAggressionDelta`, `throwAggressionDelta`, `runningRiskDelta`: signed [-1,1] decision offers.

All six fields are required. Positive impact requires at least one nonzero offer; zero impact requires all-zero offers. This structural check does not prove an actual downstream behavioral change. The caller must ensure feasible physical timing, prevent addition overflow, interpret decision units consistently, and never map these offers straight to a hit/out/error probability bonus. They are not necessarily probability deltas. New effect dimensions require an explicit compatible contract extension, not unknown fields.

## Transition rules

Non-incumbent candidates require their activation threshold. Only the current emotion may use sustain or the configured calm-event grace period. Below sustain increments the calm count; meeting sustain resets it. Reaching the configured consecutive calm count clears the incumbent unless another activation-qualified candidate wins. A zero-effect incumbent clears immediately, avoiding cosmetic-only activity.

Among eligible candidates, choose maximum supplied behavioral impact, not maximum pressure and not a hard-coded emotion priority. Equal impact retains an eligible incumbent; with no incumbent, lexical candidate ID breaks the tie deterministically. Array order is irrelevant. The incumbent retains its original activation stamp while its effect offers always come from the latest appraisal. Switching replaces the bundle, never stacks it. Clearing produces `activeEmotion:null`, `effects:null`, `source:null`.

Every accepted appraisal increments revision and emits an `EmotionEvaluated` receipt, including neutral and calm-counter changes. Its transition is `NONE`, `ACTIVATED`, `MAINTAINED`, `CHANGED`, or `CLEARED`. The receipt stores normalized input, before/after revisions, active identity/start stamp, and calm count. Effects are not separately copied into persistent active state.

`getEmotionInfluence` returns a data contract labeled `EMOTION_GATE_ONLY`. It is a single read model for future execution and observer consumers, not permission to design a screen. Both consumers must use the same accepted state/revision. The exact internal pressures, thresholds and effect amounts are not a proposed ordinary player-facing UI.

## Example (synthetic calibration, not production defaults)

```ts
import { createEmotionState, evaluateEmotion, getEmotionInfluence } from './src/core/world/psychology';
import type { EmotionAppraisal, EmotionPolicy } from './src/core/world/psychology';

// policy and appraisal come from an authenticated game host; no formulas are implied here.
export function evaluateExample(policy: EmotionPolicy, appraisal: EmotionAppraisal) {
  const initial = createEmotionState({ scope: appraisal.scope, policy });
  if (!initial.ok) return initial;
  const transition = evaluateEmotion(initial.value, appraisal); // expectedRevision must be 0
  if (!transition.ok) return transition;
  const influence = getEmotionInfluence(transition.state);
  return { transition, influence }; // host must atomically commit state + receipt before consumption
}
```

## Save/replay and rejection

Restore checks schema, complete current appraisal, scope/revision/policy consistency, active-start chronology, calm-count feasibility, effect availability and necessary dominance invariants. It rejects neutral checkpoints that hide an activation-qualified candidate and active checkpoints dominated by another activation-qualified candidate. It does not reconstruct all unknown prior history or prove a checkpoint authentic.

Replay recomputes each receipt and rejects mismatches. Duplicate appraisal IDs are rejected throughout the supplied replay window and against the checkpoint's last appraisal. Normal evaluation rejects an immediate duplicate. A compact checkpoint does not retain every past ID: global deduplication across earlier checkpoints is the persistence host's responsibility. Evidence-event IDs may legitimately reappear as context across distinct appraisals; the host must not manufacture extra calm events by resubmitting the same physical observation.

Wrong scope, policy, revision, non-increasing time, malformed fields, sparse arrays, accessor properties and unknown fields are rejected. Validation assumes inert application/serialized data, not adversarial executable JavaScript proxies. Receipt comparison is consistency checking, not a cryptographic signature: an attacker able to replace a checkpoint and all evidence coherently is outside this module's authenticity boundary.

## Remaining consumers

MatchImportance/PersonalStake, per-player Appraisal, pressure-Trait single-source composition, production calibration, skill feasibility, whole-trajectory timing execution, game persistence, and shared execution/observer integration remain separate. The completed Swing Kinematics v1 must remain the physical batting authority; this gate does not shift only a swing search window or revive the legacy first-order path. Full player-trait lifecycle (09 / 53), other trait families and their effects are not completed by this slice.
