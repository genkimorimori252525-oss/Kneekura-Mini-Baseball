# Persisted scouting and recruitment into accepted contracts

This continues original area 9 with one connected evidence path. The authority
is Canonical Foundation document 31, `31-scouting-recruitment-system.md` at
`44b9f5de7b9d87e649f12f1af78c202f2b5ab44d`: §§5.1 and 7.1 require report and
decision-time provenance; §§8, 9.1, 18 and 21 preserve Club knowledge, actual
recruitment authority and historical evidence without hidden Player truth.

## Connected owners

`SqliteRecruitmentEvidenceStore` adopts explicitly accepted scouting evidence
and reports through the existing Core `appendScoutingEvidence` and
`appendPlayerKnowledgeReport` functions. Its scouting journal and head retain
ordered revisions, complete original records, canonical source hashes and
replayed results. Unknown, backdated, missing and conflicting evidence cannot
be replaced by a later report or an invented default.

The same owner adopts an explicitly accepted recruitment choice. It reads the
actual Native Club, global roster, wage ledger and scouting prefix at the
specified revisions. Existing Core functions derive roster need, Club finance,
recorded-wage payroll checks and the current GM/Sporting Director authority.
SHORTLIST/PASS retain their original non-offer semantics; BID/ACQUIRE require
their explicit payroll proposal. No ranking or offer-generation formula is
introduced. The accepted source retains the supplied planning/governance
policies, fit estimate, market context, choice and terms.

Every decision retains its original Club/roster/wage basis and knowledge hash.
Reads replay the complete decision and scouting histories, including older
decisions before later entries. Club provenance is checked against the accepted
Club journal. At the original roster/wage revision the owned head must match;
later legitimate head revisions do not replace the archived decision basis.
Head CAS, journal insertion and post-insertion replay share one transaction.

`SqliteFreeAgentContractStore.applyAcceptedDecision` consumes the exact durable
decision reference, replacing the caller-supplied ledger for this additive
intake. It reads the original evidence on the contract writer's own SQLite
connection during first admission, exact retry and historical replay. The
existing contract owner still applies the Club, roster, wage and rights changes
atomically. The reference pins both source and complete snapshot hashes.

A separate application-reference marker binds the exact retained request. A
missing reference tag, changed source, different intake under the same
application ID or orphan marker cannot silently turn an accepted application
into a legacy request. Post-INSERT original-evidence verification detects
source-changing triggers and rolls back the contract effects together.

The legacy `apply` request serialization is retained byte-for-byte, with an
explicit compatibility assertion. Existing contract fixture construction was
moved unchanged into shared test support. New accepted-reference applications
require the new reader; this is not a claim of downlevel mixed-save support.

## Verification scope

Bounded author tests use real SQLite scouting, recruitment, Club, roster, wage,
contract and rights owners. Upstream scouting observations/reports and
recruitment instructions are explicit accepted test inputs. The fixtures do
not claim real match observation generation or numerical scouting calibration.

The first run identified the missing evidence-owner module. The initial
connected six-case run passed. The expanded run passed all ten new cases and
five selected legacy cases in 6.36 seconds; the existing 11,700-Player scale case
was intentionally excluded. After adding the bilateral-acceptance case, the
final selection passed 16 cases across both files, with only that scale case
excluded and zero failures. All eighteen protected blobs matched, and the
shared legacy fixture body was verified unchanged. Node 26, one worker, a
512 MiB heap, disabled cache, an external cache directory and a 35-second wall
cap bound these author checks. Full compiler and consolidated review/verification
remain with the parent batch.

## Remaining boundaries

This path persists accepted evidence and a chosen decision. It does not produce
scouting observations, estimate/confidence values, autonomous market candidates,
fit/market assessments, negotiations or bilateral acceptance. The existing
contract still requires an explicit acceptance matching its decision and cited
Club event. Missing accepted sources fail explicitly.

The calendar's market triggers, general Career clock, lower-tier physical games
and non-pitch practice/source-change producers remain distinct original-plan
work. No scheduler, new roster policy, UI, numerical development model or
production bootstrap is added here. Private databases and test reports remain
outside publication scope.


The assembled review/compiler and 179-case combined outcome, including the
explicit scale exclusion and report reconciliation, are recorded in the
[current integrated batch](2026-10-09-occupied-motion-attribution-batch.md#controlled-body-tags-persisted-recruitment-and-original-proof-reuse).
