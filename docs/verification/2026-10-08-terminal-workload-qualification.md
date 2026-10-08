# Terminal TOTAL workload: source-qualified checkpoint

Status: focused qualification is in progress. This is a terminal workload
prerequisite, not terminal completion, next-play readiness, or a whole-project pass.
No merge or deployment is claimed.

## Source cuts

- Candidate implementation: `41b133a2904cfaa9e2ea0dfff81e37499682559f`, after the
  genuine missing-capability RED at `5bd6a8a836fd93d40ba33e1ef55b63719effc792`.
- Reviewed final production: `26a56cfdea490bb78eff4bbee0f88d265736f65f`, src tree
  `7f2bafee63aaee78a7b2de43d10e1eafa1ab4a29`.
- Reviewed test-only ready-checkpoint support:
  `5a9f85544352e64326068dd66df99283fa203c86`, src tree
  `64f3a72b5af62bdda51fcd4842e213ae5b92e612`.

The production delta from `cf5f83f` is exactly eight modules: terminal assessment,
evidence, metadata, storage, transaction and concrete store; the archived charge
guard; and the existing global Player writer's connection-bound extraction.
Original acknowledged P/C/E, receipt, proposal, acknowledgement, official Match
state and pending marker remain immutable. The frozen workload plan captures
settlement-time BEFORE, retains its original ancestry and hash, and never grants
completion or another charge. There is no invented effort, recovery, next actor,
calibration, scoring result, renderer, or UI capability.

## Verified repairs

Real SQLite mechanics exposed, then verified fixes for:

1. Same-connection byte-neutral writes during BEGIN acquisition escaping the
   original write counter.
2. BEGIN acquiring a transaction and then throwing outside owned cleanup.
3. Suppressed COMMIT, replacement transaction after COMMIT, and altered query-only
   state returning success. Failed or uncertain boundaries now retire the handle.

The focused mechanics suite also checks normal rollback/reuse, proof write
refusal, transaction replacement, rollback/restoration failures and a real
COMMIT that succeeds before throwing. Eleven cases passed on final transaction
bytes. Metadata and global connection parity bring that focused stage to 23.

Four independently reviewed genuine-fixture W08 regressions each reproduced an
exact RED and then passed on final production bytes:

- assessment acceptance with a corrupt original participant head;
- zero-write assessment retry with a damaged claimed frozen settlement;
- moved settlement aliases retaining the original E reference;
- a renamed original TOTAL activity with no settlement.

The orphan activity fixture uses the real global writer with independently
accepted fixture TOTAL and genuine original E/participant, then renames only its
activity identity. It is not a claim of authentic prior terminal partial
settlement. Raw ownership fallback is shared with legacy exclusion without
mistaking accepted assessments for charges.

Selected legacy/global/model regression files passed 42 cases. The three
initially excluded synthetic legacy-producer acceptance/retry/rollback cases
passed in their own subsequent bounded stage. Their earlier skips remain zero
credit in that earlier record.

## Independently qualified pre-charge checkpoint

A closed private artifact left by the actual candidate owner contained the exact
accepted baseline and assessment additions, before freeze or charge. Its still
running producer group was not treated as a successful gate.

W09 independently qualified a copy in 125 seconds. It starts from the pinned
acknowledged original, derives the exact expected policy/baseline/head and ten
assessment row deltas from the explicit fixture packet, compares every row and
schema entry, and authenticates current original owners and all ten global
chains. The only schema-cookie difference is the known two-step create/drop of
the producer test's fault trigger. It checks canonical paths, exclusive copies,
file hashes and absence of source sidecars, proves zero-write archived read and
assessment retry without authority callbacks, and rechecks untouched originals.
A qualified-manifest reuse case then passed the stale-uncharged-head rejection.
Its 27 nonselected integrity cases receive no credit.

The first W09 attempt stopped on a harness-only strict-equality mismatch between
SQLite null-prototype rows and JSON receipt objects. The corrected check compares
exact persisted wire data, preserving order and every value; it does not relax
schema or row conservation.

Freeze/charge/peer cases now use separately pinned fresh copies of that qualified
checkpoint. Assessment INSERT rollback keeps the original missing-baseline
fixture, since it requires no baseline. Each W07 baseline fault retries only its
own target through the existing exact allowed-delta oracle. No activities are
deleted and no ready checkpoint is manufactured by editing durable owner data.

## Evidence attribution and remaining work

`2026-10-08-terminal-workload-evidence.json` is a sanitized index of finished
supervisor records. It contains source/control/report hashes, selected test
names, exact credit and cleanup status, without databases, raw logs, private
manifests, host paths or process identities. Final-production byte matching is
computed from each admitted source snapshot's eight file hashes, not from the
current filesystem or the checkout HEAD label. Some runs admitted an uncommitted
working tree before its later byte-identical source commit.

Old grouped genuine W01/W02 and rollback runs use the `4ab120f` acquisition-fix
cut. They are not final-production completion evidence. Final-source W10 and
remaining integrity/rollback cases run in fresh capped stages. Each individually
finished stage is recorded; a running, skipped, timed-out or interrupted stage
never becomes a pass by inference. The broad project suite, all raw-alias
combinations, genuine independent scoring interleave and second-origin coverage
remain separate qualification work.
