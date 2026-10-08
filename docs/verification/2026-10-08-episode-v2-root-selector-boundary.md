# Explicit v2 root selectors, closed field admission

Historical qualification record for source `e04ee7b23a600483f33d9c17c357d828e6e29d46`.
The later complete consumer implementation is described in
`2026-10-08-episode-v2-field-consumers.md`. The optional standalone read probe is
not a prerequisite for that implementation or its field gate.

This slice extends only the shared root-kind type, root identity discriminator
and physical geometry selector in `BattedWorldFieldRoot.ts`. Each root kind must
agree exactly with the receipt's Source version. Legacy and v1 identity encodings
are unchanged. V2 selects the same accepted geometry while retaining the original
calibration archive and all existing response/pitch/contact/field checks.

The finite positive root-identity projection first failed at the old v1-only
discriminator, after the existing original fixture completed. Source
`67bbeaf8672f59bc51654aeff3475cabf4d9572c` produced one expected failed case,
nine skipped cases and zero passing-test credit. Exact RED terminal:
`a24509669b463b6d0a9d916a35cadae8eb79cd7e974a389b4804242e3936a6c5`.
These are structural selector tests; their projected v2 object is never accepted
or archived by the binding owner. Genuine current-batter root authentication must
later read the closed actual v2 binding through its Native evidence owner.

## Caller audit

All ten production caller modules were inspected; their bytes remain unchanged:

- `SqliteBattedWorldFieldStore`: Source validation still calls the unchanged
  v1-only `battedWorldFieldSourceRootIdentity`. A raw v2 opt-in rejects before
  field work; a v1 opt-in cannot present a v2 receipt because root-kind/version
  equality rejects. Scope/read rederive from those same Sources and compare exact
  canonical archives. The private root factory constructs only legacy/v1 roots.
- `SqliteBattedWorldFieldExecutionStore` and `OwnedScheduledMotionExecution`:
  execution roots come from the normal field reader; scheduled motion receives
  the validated field prefix inside its existing owner traversal.
- `BattedWorldFieldPhysicalPrefix` and `BattedWorldFieldTerritoryFromPrefix`:
  selectors compare geometry and root identity within already owned prefixes.
  The physical prefix still exempts only v1 from legacy flight/calibration
  equality, so an actual new-pitch v2 root is not a completed field prefix.
- `SqliteBattedVenueLegalPolicyStore`: the anchor comes from the field reader;
  no new v2 policy or binding hash route is enabled. The corresponding venue
  evidence reader also remains unchanged.
- `ActualFieldObservation`, `ActualFirstBaseUmpire`,
  `ActualFirstBasePlayEndEvidenceFromSqlite` and
  `ActualLivePlayClosureEvidenceFromSqlite`: these selectors read base geometry
  from existing authenticated field/prefix or play evidence. They introduce no
  action admission path.

The finite suite checks the unchanged Source parser directly and through the
normal field writer: v2 rejects with zero accepted field rows. No field action or
motion interval is executed. Existing fixture calibration/clock values are reused;
no new duration or numerical calibration is selected.

## Separate genuine read gate

The next exact packet must depend on a closed, qualified current-batter binding
receipt. Use an exclusive copy and the ordinary Native/query-only snapshot route.
Read the actual binding, construct its explicit v2 root, check both shared
selectors and all reference identities, and retain the old calibration flight.
Require zero writes/schema changes, unchanged full census/main bytes, clean
close/reopen and unchanged inputs. A root/read receipt must state that field
continuation remains unexecuted. The strict positive-duration motion validator,
complete field write/read/current/prefix/venue integration and terminal-origin
setup are separate contracts.
