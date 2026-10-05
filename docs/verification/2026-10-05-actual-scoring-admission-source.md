# Actual-live downstream scorer admission: source checkpoint

This branch is separate from the cumulative four-slice freeze. It starts at
`860885bc812805e571ee11a5795fa4994fdccf1a` and adds an independent post-closure
accepted scorer Source. No original closure, Match, physics, review, workload,
World, UI or final-aggregate authority is replaced.

The only observed initial RED is the selected `base_hit` missing-adapter
assertion recorded in the original preparation's `red1/terminal.json`: one
capability-absence error after genuine closure/workload prerequisites, with
22 other cases excluded. That is not 23 independent behavioral RED proofs.
The original test cut and receipts remain unchanged.

## Source changes

- Strict accepted Source envelope with one scorer event identity and existing
  explicit H/E/FC evidence; the existing Core classifier still owns semantics
- Detached Source preflight, same-connection write reauthentication, exact
  original closure proposal/review/physical lineage, and SQL/raw JSON ownership
  census before and after Source INSERT
- Existing `SqliteOfficialScoringStore` writer and durable result format,
  authenticated by its own writer-connection guard before and after scoring
  INSERT; its evidence callback supplies only the persisted accepted Source
- Separate `QUEUED` reservation, generic scoring commit, and `SCORED` CAS
  checkpoint, with callback-free retained reads and authority-free reopen
- No current-Match-head requirement beyond the original closure owner's
  historical receipt checks; later legitimate progress is allowed
- The existing contiguous scoring-history reader and line-score fold are
  extracted into named functions and called from the original closure consumer
  without changing the fold or adding defaults for missing H/E history

## Verification scope at this checkpoint

Source review and `git diff --check` only. No test, compiler, catalog, timing,
Node or Native process was launched by this implementation worker.
The admission file now contains 36 declared cases, including the original 23
and new raw alias, real-peer-WAL mutation, callback change, witnessed local
Source/scoring archive corruption, and existing line-score consumer checks.
All new cases remain unexecuted; their presence does not prove any guard passes.

The fixtures use genuine disk/WAL SQLite, closure/scoring writers, ten actual
role workload effects and readiness readers. Physical and review projection
readers are explicitly substituted. This does not authenticate an original
safe-fair physical/review artifact or provide a complete review matrix.

The line-score opening fixture is synthetic and explicitly initializes its
own starting Match. The complete-game claim stays bounded: one retained scorer
record can feed existing history; missing earlier scoring or a ninth-inning
partial fixture remains incomplete. No late per-play evidence replaces the
separately accepted game-final aggregate.

Still unproven here: a genuine original safe-fair artifact, valid actual prior
runner FC, all real-review journal variants, complete full-game scoring,
coherent whole-archive rewrite/corruption matrices, and later genuine gameplay
and workload continuation. Fair-ball OUT remains unsupported. The available
original artifact is OUT and has not been relabeled. No artifact DB publication,
UI/design/workflow/home CI, merge or deployment occurred.
