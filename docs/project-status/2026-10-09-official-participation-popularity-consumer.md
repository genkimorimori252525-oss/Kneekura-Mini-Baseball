# Official participation to persisted Career exposure

This closes a concrete area-9 consumer gap on top of the original participation
connection. Previously `readAcceptedPopularityEvent` projected an authenticated
receipt for direct Core callers, while `SqlitePopularityHistoryStore` persisted
only free-agent transfer exposure. `applyOfficialParticipation` now adopts that
same `OFFICIAL_GAME` event into the existing durable history.

The approved authority is Foundation
[`50-popularity-reputation-architecture-DRAFT.md`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/core-foundation-plan-2026-09-17/docs/game-design/50-popularity-reputation-architecture-DRAFT.md),
blob `88dca7bee8b7297d102d160e2d75cef57755cc5f`, especially sections 11–13,
21 and 28. Actual exposure and audience response remain required inputs. A
participation event never grants an automatic popularity increment, ability,
Manager estimate, Team Mood or Star status.

## Persistence contract

- The existing receipt owner can lend read capabilities on the consuming Native
  connection without creating schema or exposing writes/close. It retains every
  existing legacy and tagged receipt dispatch and original-proof check.
- The consumer reads the actual stored receipt and its original Player/Person
  link inside its own snapshot. Caller-declared career, Player, Person and event
  identities must match. National membership retains its existing original
  receipt authority rather than becoming Club assignment.
- The existing versioned popularity policy and audience observations stay
  explicit request inputs. This change supplies no audience generator or new
  scoring formula.
- Head CAS and application persistence use one transaction. Original evidence is
  authenticated again after the actual INSERT, so source-changing triggers roll
  back the application and head together.
- Retry, application reads and historical head reads reauthenticate the saved
  original evidence. Later head revisions retain the earlier official-event
  prefix; a newer Club/roster state does not replace an original participant.
- The receipt ID remains the single binary game/Player event identity. It is
  neither a count of plate appearances nor permission for repeated exposure
  adoption of the same event. A conflicting request or legacy/event dispatch
  fails explicitly.
- Existing free-agent request/result encodings and SQL schema are retained.
  `readApplication` has an additive result union for game applications. Older
  consumers do not understand that new stored variant; no downlevel mixed-save
  support is claimed.

## Checks

Two affected files passed all 10 cases in 7.93 seconds under an external
60-second wall cap, one worker, no cache and a 512-MiB Node heap. Coverage includes
legacy transfer compatibility, mixed transfer/game history with exact legacy
row preservation, an actual ordinary physical batter receipt, private-source
and Person tampering, missing exposure, identity/revision fences, retry/reopen,
and rollback after an INSERT trigger changes the original receipt. The affected
TypeScript configuration passed under a 45-second cap and 512-MiB heap. These are
focused author checks, not whole-project or genuine-artifact qualification.

The initial run had one assertion mismatch: the test expected input event fields
that the existing processed-event projection intentionally omits. That failed
run is retained separately. The corrected test checks the persisted projection's
actual contract. No production change was needed for that failure.

## Remaining area-8/9 prerequisites

The present-owner census found these already connected paths, which this delta
does not rebuild: Manager executed-roster observation and historical belief;
Manager-issued actual pitch practice; practice-origin development intake;
measured NORMAL/QUICK practice into timing learning; timing development history
and retrospective breakthrough projection; domestic schedule/event snapshots,
market triggers, Match-to-World settlement and season advance; National original
participation and rehabilitation consumption.

The remaining boundaries are narrower than “Career is unimplemented”:

1. **Missing production evidence owners:** complete per-Player, per-appearance
   attribution and season statistics. `SupportedOfficialScoringRecord` currently
   records bounded team/play classification and R/H/E; a binary participation
   receipt cannot supply batting opportunity, innings or individual performance
   totals. Award/All-Star/statistical Career producers need that original actor
   evidence and complete supported official game paths first.
2. **Missing general execution/orchestration:** non-pitching practice/repetition
   and corresponding durable source changes, autonomous drill/opportunity/market
   candidate production, and the Career clock dispatch across required lower-tier
   games. Existing accepted orders, snapshots and calendar triggers do not prove
   those producers exist. These are remaining implementation work, not newly
   unapproved architecture, and are not replaced by synthetic outcomes here.
3. **Explicit model/content inputs:** audience reach/response, personal appraisal,
   developmental prescriptions and measurement calibration, Manager knowledge
   estimates, and scored Star-season evidence remain accepted policy/source
   inputs. Producing their values from raw game facts needs the corresponding
   defined model and calibration; participation alone cannot decide surprise,
   successful high-stage performance or iconic salience. Existing adapters in
   `DevelopmentEpisodeFromAcceptedAppraisal`, `ActualPitchTimingLearningFromPractice`,
   `PitchTimingBreakthroughFromAcceptedSources`, and `SqliteStarStatusStore` keep
   those boundaries explicit.
4. **Existing historical bootstrap:** the first two WBC cycles' production roots
   remain absent, as recorded in
   [National persistence, Remaining implementation boundaries](2026-09-30-national-competition-persistence.md#remaining-implementation-boundaries).
   The prior accepted-history wiring is retained; no historical inputs were
   manufactured or requalified by this change.

UI/design, new PitchArsenal, unapproved draft work, private artifact publication
and home-PC CI remain outside this component. Overall nonvisual completion is
not claimed.
