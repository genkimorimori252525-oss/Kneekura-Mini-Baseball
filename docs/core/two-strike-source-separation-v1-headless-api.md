# Two-strike technique, weakness and emotion inputs v1

## Authority and scope

Public entry: `src/core/world/traits/twoStrike/index.ts`.
Approved ownership/lifecycle source: canonical09 §§2.5–2.6,5.1,5.3–5.4,10.1 and canonical53 §§18,21 at `782f6b8ef2406839de5678b00040001111cd8f77`.

The existing `cut_contact` / `two_strike_adjustment` families retain their persistent consolidated proof in TraitState. A separate `two_strike_weakness` family describes current technical weakness, with exclusive null / RED / RED_EXTREME states. It never replaces or deletes learned mastery. These are implementation identifiers, not a final UI taxonomy.

This library does not execute a swing, generate a technique, calibrate a population, award mastery, change a probability, or connect a screen. It prepares numerical inputs for a later consumer, and tests the composition using the real existing TraitState and EmotionState libraries. The completed Swing Kinematics implementation remains a separate unchanged branch.

## 1. classifyTwoStrikeWeakness(input)

Signature: `classifyTwoStrikeWeakness(input: unknown): TraitResult<TwoStrikeClassification>`.

Input is `TwoStrikeClassificationRequest` (exported type): classificationId, scope, time, source, model, observations. All fields are required; extra fields are rejected.

- `scope`: careerId and playerId.
- `time`: season, monotonic career day (not day-of-season), same-day sequence.
- `source`: sourceKey/revision/snapshotId plus scope/time, owner `TWO_STRIKE_TECHNIQUE`, effectBasis `TECHNICAL_ONLY`.
- Observations: scope, episodeId, eventId, time, strikes=2, recognitionErrorTicks, adjustmentErrorM.
- recognitionErrorTicks is a nonnegative safe integer residual in simulation ticks; adjustmentErrorM is a nonnegative finite residual distance in metres. They must be attributable to technical recognition/adjustment, not already include an emotional contribution. They are not strikeout counts, hit counts or ordinary pitch movement.

The host's collector owns residual attribution and measurement. A source label cannot prove that a supplied number actually excludes emotion. This module validates the declared contract; it does not infer attribution from an outcome or authenticate an event.

### Explicit algorithm / calibration choices

The source design establishes causal ownership and persistence, not exact residual thresholds or statistics. The following is the versioned implementation choice `two-strike-residual-incidence-v1`, not a claim about real-world cutoffs:

1. Validate all observations, including observations outside the window; reject foreign scope, future evidence, duplicate events/instants, contradictory season order and malformed shapes.
2. Use observations where `evaluationDay - observationDay < windowDays`. This is a window length in calendar days, including the current day. `minimumDays < windowDays`; minimumDays is the elapsed first-to-last evidence span, not a sample count.
3. Count each episode once. An episode is failed if any of its observations has recognitionErrorTicks >= redRecognitionTicks OR adjustmentErrorM >= redAdjustmentM. It is extreme if the corresponding stronger threshold is crossed. Both dimensions together still count once.
4. Failures must meet both the supplied incidence fraction and the supplied minimum number of failed episodes. The strongest supported tier is returned once. Extreme thresholds are strictly greater than Red thresholds; the extreme episode requirements cannot be weaker.
5. If sufficient general evidence exists but the failure rate is concerning and repeated-failure evidence is insufficient, return UNAVAILABLE/INSUFFICIENT_FAILURE_EVIDENCE rather than falsely clear the weakness.
6. Stale source or insufficient general evidence also returns UNAVAILABLE with null stateId. A READY result with null stateId means this model's absence criteria are supported; UNAVAILABLE/null does not.

All thresholds are supplied through modelId/version with minimumEpisodes, minimumDays, windowDays, maximumSourceAgeDays, red/extreme recognition and adjustment thresholds, red/extreme episode fractions, minimumFailedEpisodes and minimumExtremeEpisodes. No production defaults are shipped. Tests use synthetic settings only.

READY/UNAVAILABLE output retains the normalized full request, sample/episode/span counts and failed/extreme counts/fractions. It is recognition, not development. Repeated calls do not write state. Representative exposure and the meaning/uniqueness of a real episode remain collector responsibilities; counting identifiers does not prove representative sampling.

## 2. prepareTwoStrikeInput(input)

Signature: `prepareTwoStrikeInput(input: unknown): TraitResult<TwoStrikeInputBundle>`.

Input has exactly frame, traits, emotion, current, classificationRequest. Supply original state/request objects, not an arbitrary already-projected tier or precomputed emotional bonus.

### Frame

`TwoStrikeFrame` binds career/player scope, matchId, decisionId, contextId, worldRevision, TraitTime, EmotionTime, strikes 0/1/2, expectedTraitRevision, expectedEmotionRevision, the selected currentSource reference, emotionSourceSnapshotId and the selected recognitionModel reference.

EmotionTime is the existing simulation tick/sequence clock, not render cadence. The host maps the two clocks to the same actual context. `worldRevision` and decisionId are host transaction identities; this library cannot inspect the whole world to authenticate them.

### Current technical source

`CurrentTwoStrikeTechnique` provides a `TwoStrikeSnapshot`, nonnegative recognitionDelayTicks and adjustmentSpreadM, and exactly two technique source references/feasibility decisions for cut_contact and two_strike_adjustment. Source keys cannot be duplicated. A skill may genuinely exist before its named trait is recognized.

Historical proof and latest recognition source references must be consistent with current skill source keys/revisions/snapshot IDs. The original mastery proof is retained separately; the assembler does not replace it with a new current snapshot. A false feasibility flag leaves historical acquisition intact. Physical/cognitive/health feasibility is source-owned, not inferred from a color or age.

### Output channels

- `technical`: the source's current numbers and feasibility, unchanged, only at two strikes; otherwise null. No bonus/penalty is generated from a recognized tier or mastery label.
- `learnedTechniques`: historical acquisition/proof and current source/feasibility separately. An unrecognized label never blocks a real source skill; an acquired label never overrides infeasibility.
- `weakness`: recomputed classification and applicability. Missing request is UNASSESSED. Old current source/model is UNAVAILABLE, not recovered. A previous calendar-day assessment expires even if its source reference still matches. Future/internally conflicting requests reject. At another count the status is OUT_OF_CONTEXT. Audit classification may retain its historical tier, but only the view's status/stateId applies now.
- `emotion`: exactly the existing `getEmotionInfluence` result from a validated EmotionState. Match, context, selected appraisal-source snapshot, revision and chronology are checked even for a neutral last appraisal. A pristine revision-zero state is neutral. An active effect is not pre-added to the technical numbers, and no additional effect is derived from pressure grades.

General emotion remains available at zero/one strike even though the count-specific technical channel is inactive. A later consumer must apply the one emotion channel once, not once here and again elsewhere. This library prepares the channels; it does not prove that every future external consumer follows that rule.

### Ownership examples

`learned=true, feasible=false, weakness=RED_EXTREME` is a valid combination: the player retains knowledge but current execution is constrained. Neither the negative descriptor nor the feasibility flag erases the consolidated technique.

Changing only `bat_pressure` from G to GOLD leaves this assembler's technical values and selected emotion influence unchanged. A truthful upstream appraisal may eventually respond to a changed pressure source, but there is no independent grade-to-batting bonus here.

## Error/immutability contract

Both APIs return the existing TraitResult: `{ok:true,value}` or `{ok:false,reason:{code,path}}`. Successful results are detached, deeply frozen plain data. Inputs are not mutated or frozen. This follows existing inert-data validation and is not a sandbox for arbitrary JavaScript proxies.

The host must authenticate source/model/event identities, enforce immutable ID/version mappings across requests, select genuine current state, capture complete relevant opportunities, and atomically persist/use the proposal with world revisions. No cryptographic authenticity or global ID deduplication is claimed. No persistent state transition is introduced by these pure reads.

## Remaining integration

Raw match collection, real source skill evolution, production recognition/calibration, complete Appraisal/MatchImportance, execution adapters into the separate Swing Kinematics branch, persistence, and UI remain separate. No skeletal simulation or second swing/contact engine is introduced. Other measured-trait families still missing classifiers are not declared complete by this change.
