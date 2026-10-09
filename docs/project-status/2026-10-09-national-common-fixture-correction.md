# Prospective National two-play fixture correction

This corrects the inputs of the existing NAT-N01 acceptance case. It does not repair or replace any accepted model in a retained database. No production guard, numeric model, rule policy, or archived hash changes.

## Proven failure and reusable state

The retained National continuation on source `545e2301a64bc6a31f920d2ec056a79838b093a9` / src `3554109fa2c0f878893fa44a1a7ef1ebf22290d2` actually failed after 182.13 seconds. The original second pitch retried successfully and `national-live:flight` committed, then the game-model owner rejected a different immutable model. The whole acceptance case remains failed. Its original database, WAL/SHM, receipts and comparisons remain preserved privately.

The available snapshot inventory contains 46 National database paths. Genuine copies descend from the completed-foul original; diagnostic provenance names that same completed donor. The other retained National dispatch fixtures explicitly substitute readers and are unsuitable as original gameplay donors. No available genuine snapshot predating the first game-model admission was found. Existing National fixture defaults use an in-memory URI, so earlier non-retained fixture construction supplies no persistent pre-model entry.

A new genuine database must start at the original fresh NAT-N01 entry. Old completed foul, statistics and retry receipts remain evidence for their original lineage; they cannot supply accepted gameplay or statistics in the corrected lineage.

## Complete immutable declaration

`NationalBattedFixtureDeclaration.test-support.ts` declares and checks both planned plays before the first batted model admission:

- One world model Source, `national-common:world-model`, contains all 19 already registered eligible Player/Person bindings. Each play still commands only its actual batter and nine defenders.
- One response model Source, `national-common:response-model`, covers the same full roster.
- `national-foul:bases` and `national-foul:geometry` remain the one accepted original base/field calibration. They belong to `national-foul:flight`.
- The second response remains `national-live:response`. Its existing v3 episode binding names the actual next actor, first field calibration, and completed origin `{kind:'foul_terminal_completion', sourceId:'national-foul:terminal'}`. No first-play row is relabeled as a second-play root.

The audit found no additional game-global owner or conflicting Source ID in this one-foul/one-first-base composition. Runtime, legal policy, official and communication owners are separately scoped to the pitch/play. The fixed first-base helper IDs are appropriate for this one tail, not a claim of arbitrary third-play reuse.

## Explicit prospective numerical changes

The former initial foul had a pitcher glove offset `(0, .9, 0)` and capture dissipation power `1000 W`. The later helper attempted to replace those immutable inputs. The new declaration uses the existing first-base forecast calibration from the start of the game: the pitcher glove center is the planned next ground position relative to the original stationary pitcher, with the existing `+.12 m` z displacement and `ballRadius + .02 m` y offset (`.0566 m`). All glove response profiles use the existing first-base `100,000,000 W` capture dissipation power from first admission.

The common calibration is calculated prospectively by existing Core pitch/contact/flight functions and the existing first-base fixture solver, not copied from a retained result. The original TOTAL vector is shared with foul completion; its sorted p0 entry is zero, so the declared next-pitch fatigue remains the original baseline zero. The two initial TAKE pitches still contribute the original active-prefix fatigue before the bunt. Existing pitch speed/spin, swing recipe, body dimensions, primitive radii, base geometry/materials, foot solver and `.24/.28/.30` timing choices are unchanged. The initial physical recipe has changed as described above; it is not labeled unchanged.

The inexpensive scene check executes both explicit scenes with the common model. It requires ground before any actor contact, the original untouched rolling stop and Core `foul/settling` ruling, and the next play's actual Core capture candidate. A translated start clock checks the common geometry independently of the absolute time origin. Forecasts never enter a Native evidence callback; the real owners must calculate and authenticate every accepted play.

## Verification scope

Eight bounded fixture checks passed, including missing-reserve, response identity, model ID, geometry, first-flight ownership, former response calibration and former glove incompatibility controls. The first author run's geometry-mutation control failure is retained: that test mutated a shared object alias in both its expected and actual data; the corrected control replaces only the proposed geometry center.

`NationalBattedFoulOriginalTail.test-support.ts` is byte-unchanged from the qualified source, retaining all 37 downstream assertions. The corrected full Native scenario has not run. The next central check should use the original `NationalBattedFoulConsumers.acceptance.ts` NAT-N01 entry, a fresh private database, and the existing bounded supervisor and retention mechanism after the combined source is reviewed and preserved. It must not restart any old failed lineage or infer a whole-case pass from a committed prefix.
