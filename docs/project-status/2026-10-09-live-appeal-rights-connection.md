# Original live appeal: legal rights evidence

This batch adds legal evidence admission to an already executed and imported
physical appeal. It does not establish moving-play completion, produce a new
appeal action, or close an official window.

## Implemented owners

- An optional `venueLegalCoveragePolicy` on the original physical field root
  binds accepted interior regions and optional pitcher-plate geometry to the
  actual fixture, venue, body/world model, contact-response model, geometry and
  registered RuleProfile. No dimensions or legal boundary convention are
  supplied by the implementation. Old roots and RuleProfile bytes are unchanged.
- `SamePlateAppearanceVenueLegalCoverage` replays the original physical prefix.
  Existing exact sphere-contact kernels certify whole curves strictly inside
  accepted regions. Edges, gaps, rolling partitions and unproved curves stay
  unresolved. A certain outside endpoint is evidence at that exact endpoint,
  not a claim about the first crossing time. Carrier body/feet containment is
  retained separately. Carried or constrained ball geometry outside a region
  alone does not prove legal entry into dead territory.
- `SqliteSamePlateAppearanceLiveBallStateStore` accepts explicit Play/Time
  Sources and separately authenticated original plate-umpire assignments and
  Persons. The existing Native transaction/proof bracket owns their occurrence
  at the current field cut and journals them in `pa_live_ball_v1_actions`.
  Play additionally requires the original registered pitcher, secure custody,
  actual foot/plate contact and current playable-region coverage. Lifecycle
  census/replay includes these actions. Neither declaration advances physics.
- Every original appeal-purpose throw is projected, including throws without
  a contact receipt. Purpose follows actual release through unsuccessful capture
  constraints until secure reception, another throw or the current cut. A
  forfeiture requires proven live state at release and a later certain unheld
  out-of-play occurrence. Later carrying cannot create throw forfeiture.
- `admit_live_appeal_rights` accepts only the original execution reference.
  Native replays its independently owned end, original physical receipt,
  historical declaration/venue prefix, and exact prior ledger import. The new
  versioned `OwnedLiveAppealRightsAdmitted` event preserves execution time and
  removes only that import's pending rights dependency. A fresh correct-rule
  snapshot and explicit official action remain necessary. Independent physical
  end, producer and official-window obligations remain unchanged.

## Rule authority

The registered NPB rule retains the first-fielder-touch tag-up basis and appeal
requirement. NPB's [2018 amendment, item 13](https://npb.jp/npb/2018rules.html)
bars subsequent appeals against every base/runner when an appeal-purpose throw
enters dead territory. The [2026 amendments](https://npb.jp/npb/2026rules.html)
do not replace that provision. This bounded interpretation does not change
the serialized RuleProfile.

For the underlying Play/Time and window conditions, the primary
[2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf)
§§5.01, 5.12 and 5.09(c) require an actual Play declaration, preserve dead state
until restart, and distinguish appeals from subsequent plays. Restart requires
the pitcher holding the ball on the plate and the plate umpire's Play.
Inning-ending departure means the pitcher and infielders have left fair
territory toward the bench/clubhouse. This batch never substitutes the later
post-play seal for those occurrences. Exact simultaneous order remains pending.

## Precise remaining connections

These are missing engineering owners or accepted content, not user-blocked
numerical choices:

1. **Initial live state:** `CanonicalWorldSnapshot.ball` has only nullable
   vectors. `prepareBetweenPlayWorld` creates no custody receipt or plate-contact
   history. The smallest next owner can bind the original
   `SqliteOfficialInitialWorldStore`/completed activation setup, the registered
   pitcher and Person from `PhysicalPlateAppearanceActorEvidenceFromSqlite`,
   original body materializations from the existing batting-posture scene,
   and accepted venue/plate data. It must execute an explicit initial custody
   setup and Play at that owned pre-pitch cut, then preserve its legal history
   into the pitch. The current live-ball store deliberately supports field cuts
   only. A launch, nullable ball value or later Play cannot fill this gap.
2. **Defense departure:** original field motion already carries all defender
   primitives, but no existing Native action records departure toward the bench
   or clubhouse. Actual paths plus accepted fair-territory/exit geometry and
   explicit departure purpose can supply a bounded window event. A catch,
   stationary hold, third-out candidate or PlayEnd is insufficient. This batch
   leaves inning-ending positive admission pending on that owner.
3. **Ordinary-play purpose:** `throw_plan_v1`/`throw_checkpoint_v1` own actual
   transfer, release and receiver; their optional appeal indication owns appeal
   purpose. An unlinked throw has no accepted ordinary-play target. Core
   `CoverageThrowPlan` binds a receiver to base-cover intent, but Native does not
   yet bind that purpose and actual attempted play to appeal-window closure.
   A versioned explicit target/purpose connection can do so without autonomous
   selection. Actual next-pitch owners also exist; cross-pitch legal continuity
   still needs its own bounded history connection.

Accepted venue interiors/plate data are required inputs. Boundary semantics,
carrier entry, complete rolling curves and coverage spanning multiple boxes
remain explicit unresolved evidence. Positive rights have a working projection
and ledger extension point; missing initial live evidence means this batch is
not a claim of complete Native appeal eligibility for an ordinary first catch.

## Author verification

107 focused cases across seven test files passed in bounded author runs. Core,
source/physical, Native schema/transaction guard and reducer tests cover the new
contracts. They include real Core capture/throw motion and failed
throw coverage; projection fixtures are explicitly not Native admission proof.
No populated long Native scenario or full compiler pass was run here. The parent
owns the one assembled review/compiler/combined selection.
