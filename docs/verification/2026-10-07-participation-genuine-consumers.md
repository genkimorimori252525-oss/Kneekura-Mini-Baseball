# Genuine participation consumer boundaries

This slice adds three explicit private-artifact acceptance leaves, not general
ACTUAL_LIVE_V1 National or rehabilitation support. Production code is unchanged.
The checkpoint was prepared with execution held, then verified in the five
bounded stages recorded below. The result applies only to those selected cases.

## Inputs and isolation

The consumer manifest uses schema `genuine_participation_consumers_v1`. It pins
the closed initial two-role participation database, initial report, successful
supervisor terminal, exact one-case Vitest report, and matching runtime output.
The manifest is supplied through the existing supervisor's
`ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT` channel. Its schema distinguishes it
from the initial-writer manifest; there is no automatic input/fixture fallback.

Each selected leaf makes a new disposable database copy. It verifies the actual
saved receipt identities against the initial report without doing an extra
original-proof read. All V2 rows (including raw receipt JSON), schema/index DDL,
user_version, main-file hash, and test-process database-handle closure are
checked afterward. Original V2 is never opened by SQLite or changed. Empty WAL
and a real closed shared-memory sidecar are permitted, as in the admitted input.

## Selected leaves

- C06-N: a separate National fixture consumes the actual V2 participation store.
  `adoptAppearance` must produce the exact tagged-participation error, with every
  consumer row and all V2 state unchanged. This invokes one genuine receipt
  authentication. It does not establish legacy National compatibility by itself.
- C08-R: the actual raw clinical validator consumes a real read-only V2 copy in
  a guarded read transaction. A separate existing clinical fixture supplies its
  genuine diagnosis/snapshot arguments. The exact tag error must precede legacy
  dereferences. No clinical effect, V2 write, or additional original-proof read
  is allowed. This is raw-validator evidence, not a public clinical apply pass.
- C07-P: the existing health fixture has an optional gameId, default `rehab-game`.
  Opting into `game-1` produces an independent genuine legacy receipt with the
  same requested ID as V2. Actual raw legacy capture succeeds before the public
  operation consumes the actual V2 store and rejects its tag. All clinical state
  remains unchanged at rejection. The original legacy sources then successfully
  apply the same clinical request; a closed/reopened clinical owner reads/retries
  it with exact bytes preserved. This positive is legacy-only.

The optional fixture identity is threaded through its existing schedule,
registration, Match initialization, accepted game reader, pregame binding,
official application, and legacy confirmation. Default clinical/rule constants
and existing callers are unchanged.

## Verification scope

`tsconfig.participation-genuine-consumers.json` compiles the three leaves and
existing legacy National and health regression controls. Each new leaf has its
own `.acceptance.ts` file and is excluded from ordinary `*.test.ts` discovery.
Run one selected file at a time with the dedicated Vitest config under the
existing finite-budget supervisor. Its exact case names must be pinned in each
run configuration. A timeout is inconclusive, never an expected tag rejection.

The separate retained ordinary controls are:

- `SqliteNationalParticipationAuthority.test.ts`: actual National pregame,
  senior actor receipt, adoption, and representation through native owners.
- `SqlitePlayerHealthRehabStore.test.ts`: default `rehab-game` medical/practice,
  played receipt, clinical effect, availability, and historical cases.

These new tests assert existing safety behavior. The specific production
mutations that would break them are removal of the National public tag guard,
raw clinical tag guard, or independent public clinical tag guard, respectively.
No production redesign or forced production change is needed to add coverage.
Full-suite execution, W/H/D/R/O/F/G/I remaining leaves, old-reader differentials,
old-handle WAL sessions, publication, merge, UI, and CI are outside this checkpoint.

## Bounded execution result, 2026-10-07

The focused compiler and all five selected unique tests passed on the exact
staged source checkpoint, with one heavy stage running at a time:

- Focused compiler: pass.
- C08-R genuine raw rehabilitation rejection: 1 passed.
- Existing genuine legacy National and default-health controls: 2 passed.
- C06-N genuine National public rejection: 1 passed.
- C07-P genuine public rehabilitation rejection and separate same-ID legacy
  apply/close/reopen/retry control: 1 passed. Raw capture established six real
  legacy evidence rows before the public guard was exercised.

Each supervisor terminal recorded child exit 0, no failures, no remaining owned
processes, and unchanged source/dependency/control/runtime hashes. Vitest reports
had exact selected cases, no skips, no suite errors, and no unhandled errors.
The coordinator also verified successful outer-process completion. All three
consumer leaves preserved the complete genuine V2 rows and closed file hash;
the raw and National consumers were unchanged, and the public clinical consumer
was unchanged at rejection before its explicitly separate legacy positive.

Terminal SHA-256 identifiers, in the order above:

- Compiler: affc8cc2af1f164a49419a4beeab99b43bac1cb5332a92ba07051e69c886c9e0
- Raw: c9201c745aee54b8c4ac17e64345a915126f89429856f86f8f3e02f98b77b06f
- Legacy: c257673efc76898fbbc449c13b07d3d53b9735c349307a87bb5831dcb1e59981
- National: de0a538a2133d8c72db2f6cb24368ad9e8cd904589d78ca861ea5d66951a6cee
- Public: 04bdd5e4434ec678cea28b8d97b8fa7f639e1e3f0c3727471c3b9ea78d497ecd

This is five unique selected tests plus the focused compiler. It is not a full
suite result, does not add earlier 59-case or initial two-role results into a
combined count, and does not complete the remaining participation plan.
Production source remained unchanged. Private databases, manifests, logs, and
runtime outputs are not part of this source checkpoint.
