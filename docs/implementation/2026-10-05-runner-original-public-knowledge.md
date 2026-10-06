# Runner original public knowledge receipt

This is the next source contract within remaining-plan §5 item 7. It builds on
the durable sensory-history and explicit runner-model candidate `2c7a0bd`, whose
review repair and runtime acceptance remain pending. No production change or
execution is included here.

## Permitted information and its original owner

The P6 time/running/perception specification §4.2 explicitly permits known outs,
score context and current-base context. The P6 decision acceptance audit's
game-state risk policy also names inning and batting-team score. The
player-perception foundation permits known game context supplied to the observer,
while excluding a canonical-world argument from the perceived-state builder.

The first receipt therefore owns this bounded original subset:

- inning and half, with batting/defending side derived from that half
- outs before this pitch
- original home/away score and batting/defending score
- the runner's original occupied base and ordinary adjacent next-base reference
- the original activation availability, official revision and Match hash

These are available pre-pitch public facts, not permanently unknown data. They
must come from original activation and recipient evidence, rather than a caller
Match DTO or the mutable latest Match. Starting/next-base labels remain context;
they do not supply root position, body pose, a new touch or an award.

`PhysicalPlateAppearanceActorEvidenceFromSqlite.ts` reconstructs the exact
initial World or activation application, its original official/scoring evidence,
the activated Match/World and official revision. `PrePitchRunnerEvidenceFromSqlite.ts`
then binds the runner to the batting-side Player/Person/Club/fixture/day, original
official occupancy and actual World participant. The dedicated physical pitch
reader rederives this same original actor/runner, rather than accepting a saved
peer snapshot as authority.

The new reader must select only the permitted subset. Validate original outs,
score and inning domains, half, identity, revision and clock before publication.
A source fixture missing those fields is incomplete; do not fill it with zero or
an assumed inning. A newer valid global roster may continue supporting the
original participant, but an orphaned original intake must not be accepted.

## Proposed immutable Source and result

Tentative owner: `SqliteOriginalRunnerPublicKnowledgeStore.ts`, with a dedicated
read-only evidence facade and a separate immutable writer. Source fields are:

```ts
{
  kind: 'original_runner_public_knowledge_v1',
  sourceId, sourceVersion, physicalPitchSourceId, playerId,
  physicalActorSourceId, prePitchRunnerSourceId
}
```

The reader derives Career/Person/game/play, original binding, official revision,
exact available-at anchor and the selected original public fields. It stores
hashes of the original actor, runner and pitch evidence. It accepts no supplied
outs, score, current base, forced flag, tag-up state, observation, result or time.

This baseline is not a per-observation consumption event. A later knowledge
incorporation Source names both the baseline and the durable runner observation
revision, checks the same participant/play and exact availability, and records
which original facts that observation/decision can consume. Repeated reads or
observations do not create another initial-information event. Identity keys must
use the original baseline/recipient, not a later progression Source alias.

The baseline's provenance may refer to a prior official application, but no
current-play correct-rule result or later OfficialPlayClosure belongs in the
AI-facing subset. Every fact remains labeled as original pre-pitch knowledge.
No mutable current Match lookup is permitted to refresh an old saved receipt.

## What this does and does not establish for P6

The receipt supplies known original outs/score/inning/base context. With an owned
explicit `RunnerRiskPolicyCalibration`, the existing `deriveRunnerAdvanceRiskPolicy`
may consume that permitted subset. The owner must pass its validated original
public projection and profile-derived regulation innings, not expose unrelated
Match truth to the decision. No new coefficients are selected here.

After the batted event, force creation/dissolution, caught-ball first touch,
retouch and later outs/scores need their actual information-update owners. An
initial lack of an obligation cannot become a fresh assertion of
`forcedToAdvance:false` or `tagUp:{kind:'none'}` at a later field cut. The partial
baseline must not be cast to complete `RunnerKnownContext`.

The subsequent live semantic receipt must identify, for each force/tag-up field,
the original observable event or received message, its actual availability to
this runner, and the existing rule/semantic transformation being applied. An
unseen future catch or true defender-control time is not such an event. Pending
information remains pending; a selected hold is not a substitute for missing
inputs. This does not alter the existing projection/history contracts.

## Test-first acceptance map

| Proposed test | Required proof |
| --- | --- |
| `OriginalRunnerPublicKnowledge.test.ts` | Top/bottom side mapping; original inning/outs and both scores; bases 1/2/3; exact original activation availability and hashes |
| `OriginalRunnerPublicKnowledgeBoundary.test.ts` | Wrong recipient/Person/pitch/actor/runner; future or inconsistent revision/clock; missing or invalid original scalars; caller field/force/tag-up/result injection; changed later Match leaves original receipt unchanged |
| `OriginalRunnerPublicKnowledgeIntegrity.test.ts` | Original Source reconstruction, duplicate/moved ownership, immutable retry, original activation/intake/roster tamper, complete same-transaction rollback |
| `OriginalRunnerPublicKnowledgeNative.test.ts` | One genuine registered-profile runner activation; original receipt; close all handles; callback-free file read/retry; same-attempt insertion witness before rejected write rollback |
| Later knowledge-consumption contracts | Own baseline plus own observation, availability and recipient; one original-information identity; no current-play truth leakage; pending later force/tag-up updates |

The small positive fixture must supply a complete prospective Match before
original derivation. Altering a saved Match to make a positive case is not proof.
Negative tests may corrupt stored originals to verify rejection, with those
mutations and their scope explicit. Native acceptance must use the original
owner chain and a real database file.

Implement only after the independent Source/fixture review and observed intended
RED. This is one information dependency toward the executable runner decision
path, not completion of general runner, rule/custody, Scope or closure.
