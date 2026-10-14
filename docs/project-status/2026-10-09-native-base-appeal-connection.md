# Native original-base appeal connection

The existing post-play journal can now accept an explicitly targeted defender base appeal at the unchanged original catch-end cut. This is a bounded execution/admission connection. It does not choose whether to appeal, move a defender, add reaction time, end live action, or produce a replacement official ruling.

## Rule basis

The [2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf), §5.09(c)(1) and Comment (printed pp. 50–51), require a tag of the original base or runner plus an indicated appeal. The TAG definition (p. 158) permits a base tag by the defender's body while securely holding the ball. The [Japanese federation appeal guide](https://www.jhbf.or.jp/memberschool/umpire/08.pdf), pp. 95–96, also requires indicated intent, the relevant tag and ball-in-play status. Existing concurrent contact and control therefore need no invented movement or fixed latency; this is the implementation inference used here.

The registered profile remains `npb-2026`. [NPB's 2026 amendments](https://npb.jp/npb/2026rules.html) do not change that basic mechanism. [NPB's 2018 amendment, item 13](https://npb.jp/npb/2018rules.html) adds loss of appeal rights after an appeal throw enters dead-ball territory. This bounded route excludes all throw history and intervening post-play actions; it does not import amateur dead-ball exceptions or claim to implement the broader throw/appeal sequence.

The earlier source-only audit overstated the need for a new gameplay decision. Selecting a Native owner and journaling an explicitly indicated appeal are implementation choices once the rule's actual conditions are proved.

## Existing ownership and execution

- New sessions may explicitly select `baseAppealMode: 'original_catch_end_v1'`. The existing RuleProfile window owner opens the appeal window at the authenticated physical end. Sessions without that field retain their old shape and behavior.
- `defender_base_appeal` accepts only the original defender, runner and origin-base identity. An accepted Source cannot supply a timestamp, appeal fact, physical history, compliance or ruling.
- Native requires its real SQLite transaction, original reserved catch-end owner, original Match/participants, current field cut and initial journal cursor. It rederives the end and field evidence; a caller's cached receipt is not authority.
- The physical qualifier replays the original field evidence and requires a confirmed fair fly, a known uninterrupted no-throw prefix, secure current custody by the indicated defender and actual current contact with the runner's original base. The exact first-fielder touch and complete runner origin history feed the existing compliance contract. Neither physical PlayEnd nor an open window is used as proof that the ball is live.
- The explicit indication is executed at that owned moment only after those conditions concur. The existing journal stores the original execution evidence with its Source hash. Native rederives that qualification during replay and checks it again in the write transaction. Existing revision, parent, deduplication and immutable Source protections remain in force.
- The existing exact-history appeal orchestrator consumes the resulting attempt and original window. An updated correct-rule snapshot and applicable call/window obligations still block official closure. A qualified appeal against a compliant runner does not become an OUT.

## Bounds and verification

Missing end/field owners or current contact remain pending. The implemented route covers only the first post-play event at the original exact end cut. A later post-play cursor cannot reuse old physical contact. Runner-body tagging, throw-based appeals, intervening official/time actions and later physical cuts need their corresponding actual evidence owners; their absence is a code coverage limit, not a request to choose arbitrary latency.

The moving-runner end owner remains separately required. This change cannot use the stationary catch end to settle a moving runner. It preserves all previous physical history and producer obligations.

The final bounded author selection passed 50 cases across `SamePlateAppearanceBaseAppealExecution.test.ts` (16), `ActualPostPlayBaseAppeal.test.ts` (12) and the existing `ActualPostPlayReview.test.ts` (22), in 6.83 seconds. It covers real Core capture/contact/custody qualification, exact clocks, missing or changed physical facts, unknown/throw prefixes, accepted-input restrictions, original-window creation, ledger pending obligations and Native rejection of caller database substitutes. The physical records in those unit tests are structural Native fixtures; they do not claim a complete positive SQLite scenario. The later integrated qualification is recorded below. No long Native scenario was run.


## Integrated qualification

Tested local commit: `0805f39184ca99f666902c37c42c52417f30a530`.
Source tree: `13bbeabbfd0b05cbe71f0f55700c5d573a4ed426`.

Independent review found and then cleared a Native read-boundary gap: post-play
journal transactions are writable, whereas original lifecycle evidence requires
read-only proof. Each exported evidence operation now uses the existing Native
traversal and restores the caller's mode before journal effects and accepted
Source callbacks. New proofs after insertion retain freshness checks. Four small
real SQLite cases cover BEGIN and BEGIN IMMEDIATE, blocked writes inside the
proof, and writable restoration after success or missing-owner failure.

Full nonvisual TypeScript compilation passed in 30.96 seconds. The combined
94 cases in seven files passed in 9.92 seconds, with exact file/title inventory,
zero failures or skips, stable source/package/runtime/control inputs and no
remaining processes. All 18 protected blobs remain exact. Independent review
is clear. The earlier compiler error and the earlier 25 mock-export failures
remain preserved as failed receipts; the corrected tests substitute only the
field reader and retain the real traversal/frame exports and all assertions.

Compiler configuration SHA-256:
`aa80fbbfceee6097c3dcaa53d751434d76025580251d80b07e39db1b73615f59`.
Test configuration SHA-256:
`19cd8d060f56560a0cd5cd20f9f3e58fdd5b6f79d34fb1ba23a434a0f88cddde`.
Test report SHA-256:
`04e5b4309af222816252cba2663eff5b8477405798b7fddd63ee32fa31d56d5d`.

This qualification includes real transaction boundary controls, not a complete
positive Native baseball appeal scenario. The original moving-play settlement
contract and later physical cuts remain separate open work.
