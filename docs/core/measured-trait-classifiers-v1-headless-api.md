# Measured Trait Classifiers v1 — Headless API

## Scope and source

Implements the numeric-recognition slice after PR33. Frozen source: `782f6b8ef2406839de5678b00040001111cd8f77`, doc09 §§2.6/4.1/4.2/4.9/5.1/10.1 and doc53 §§18.1/20/21.4. Those documents require actual-source-derived descriptors and separate recognition from development. They do NOT specify the numeric thresholds or every statistic below. These are explicit v1 implementation choices with mandatory caller-supplied, versioned calibration; test values are synthetic, not production standards.

Public entry: `classifyMeasuredTrait(input: unknown): TraitResult<MeasuredTraitClassification>` from `src/core/world/traits/classifiers/index.ts`.

No changes to physics, swing, true skills, RNG, outcomes, existing trait state or display/UI. The classifier reads supplied observations and computes a new detached deeply frozen recognition proposal. It does not subscribe to the live match or persist anything.

## Inputs and ownership

Common envelope: `classificationId`, `scope` (career/player), `time`, `source` (existing `TraitSourceSnapshot`), `model`, `observations`. Source owner and subject are checked against the existing family registry. Source time must enclose all supplied observations and not be later than classification time.

Each observation has scope, eventId, episodeId and career-monotonic season/day/sequence. Multiple distinct events can belong to one episode; they count as ONE recognition episode. Duplicate event IDs or identical day/sequence instants reject, including across apparent seasons. All input is validated before window filtering. Sorting is deterministic and locale-independent.

The sourceKey identifies the chosen population. The host must supply the complete intended population and define fair/foul, bunt, pitch-type and phase selection consistently. This module does not silently invent such selection rules. For spin descriptors, avoid mixing unrelated pitch-type populations unless that is explicitly the source definition. A snapshot is an observation-window source, not a claim that every pitch used the same physical parameters.

## Numeric algorithms (implementation policy, not extra buffs)

| Family | Owner | Observation | Computed statistic |
|---|---|---|---|
| line_drive | BATTING_CONTACT | Actual outgoing `exitVelocityMps`, world Y up | `atan2(v.y,hypot(v.x,v.z))` in degrees; share inside `[lowerAngleDeg,upperAngleDeg)` |
| pitcher_contact_distribution | PITCHING_CONTACT | Same actual outgoing contact velocity, attributed to pitcher | share below ground ceiling and at/above fly floor; mutually exclusive minimum shares |
| gyro_pitch_shape | PITCH_TRAJECTORY | Same-event velocity in m/s and angular velocity in rad/s | absolute normalized axis dot product; rpm from spin magnitude; joint gyro+high-spin share |
| command_instability | PITCH_COMMAND | Actual and intended locations at the SAME reference plane, horizontal/vertical meters | centered population RMS of actual-minus-target errors; report mean bias separately |
| release_miss_pattern | RELEASE_FAILURE | explicit `deliveryFailed` and failure-attributable `releaseMissM` | rate of failed deliveries above the magnitude threshold, number of distinct failure episodes, concentration of unit miss directions |

No zero-length outgoing contact or pitch-velocity vector is accepted. Zero spin is valid and non-gyro. Ground/fly angle ranges are disjoint and their minimum shares must sum to >1, so one family cannot classify both. High-spin criteria use the SAME aligned observations; high transverse spin cannot promote unrelated low-spin gyro samples.

A varying intended target is not command instability. Constant mean aiming bias is not centered dispersion. Small residuals are scaled before squaring to avoid false zero variance from numeric underflow; unsupported intermediate overflow rejects explicitly. Failure direction uses unit vectors: one huge miss does not get more votes. A successful delivery cannot carry a nonzero failure-attributable miss. Ordinary pitch movement must never be mapped to this failure field.

## Evidence and result semantics

Model contains `modelId`, `version`, `minimumEpisodes >= 2`, `minimumDays >= 1`, `windowDays > minimumDays`, nonnegative `maximumSourceAgeDays`, plus the family rule. Trailing window is inclusive `[time.day - windowDays + 1, time.day]`. Age at maximum is accepted. Episode span is measured between the last included events of first/last distinct episode, matching PR33 episode timestamps.

- `READY`: includes an existing `SourceTraitAssessment` with `changeKind: RECOGNITION`. State ID can be nonnull (present) or null (sufficient evidence did not meet the rule).
- `UNAVAILABLE`: includes NO assessment. Reasons distinguish stale source, insufficient general evidence and insufficient repeated failure episodes. Never convert this to a null-state ABSENT assessment.
- `ok:false`: structured validation error; no partial result or input mutation.

The result embeds the detached normalized request (including calibration and raw evidence), counts and named numeric diagnostics. Store it as provenance if needed, not as a new physical source of truth. No `DEVELOPMENT`, learning, mastery, effect or probability is emitted.

## Integration with PR33

Run the classifier, pass a READY assessment to existing `projectSourceTraits` alongside current source snapshots and the matching policy family. Keep `modelId`/version and recognition minima aligned; no weaker shadow policy. If UNAVAILABLE, omit its assessment and surface the classifier's reason rather than retaining a stale confirmed label. PR33 then leaves that family unassessed; comparing with a former present assessment yields BECAME_UNAVAILABLE, not CLEARED. Other family assessments can be composed by the host independently.

Tests exercise real numerical observations -> this classifier -> unchanged PR33 projection, current-source invalidation and before/after comparison. This is library-to-library integration, not a running-game event subscription or UI connection.

## Host responsibilities and remaining work

Authenticate source/events/actors/units/reference planes; assign meaningful distinct episodes and an honest representative population; prevent global ID reuse across requests. Pin a modelId/version to its complete immutable model definition and record the algorithm version. Single-request structural validation cannot authenticate data or detect a previously rewritten model version. Persist the accepted selection atomically with world/source revisions when integrating.

Five classifiers only. Wild-stuff joint quality/variance, matchup and history automatic classifiers remain separate. In particular do not invent a single quality score solely to enable wild-stuff. The mixed two-strike/pressure slice must keep learned foul-survival technique, current recognition/adjustment weaknesses and pressure appraisal as distinct causes: label consolidation cannot delete persistent mastery or double-apply pressure outside ActiveEmotion. This PR does not finalize new mixed-family tiers or implement Appraisal/MatchImportance.

No production calibration, complete catalog, effect consumer, swing migration, UI, storage, statistical inference guarantee or full-game simulation is claimed.
