# Minimal original-chain physical-end acceptance gate

This test-only continuation is based on `486708773c5092408e99d82b82d6ef22e6ff6b39`, with the reviewed archive and metadata preparation changes and bounded SQLite write witness. Production code is unchanged.

The input is the published synthetic pre-end artifact, SHA-256 `a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa`. It contains the original physical chain, adopted first defender, second defender's pending decision, delayed operative OUT, later retained quantizer tail, and ten scheduled future receptions. It has zero committed end and seal rows. The earlier Positive worker exited unexpectedly and is not a PlayEnd pass.

`ActualFirstBaseArtifactAcceptance.test.ts` uses manifest-known Source IDs to avoid redundant setup replays. Its raw input test checks every request/reference ID and all original table row hashes without invoking domain readers. The acceptance case invokes the real EndStore for the witnessed post-seal dependency fault, rollback, clean accept, complete close/reopen, and unchanged retry. It preserves original table bytes, delayed call/applicability identities, all 70 producer identities and 40 body/base histories, ten moving actors/controllers, the genuine pending second defender, and future communications.

The output path is required and must be new. After all owner assertions and reopen/retry succeed, a SQLite backup is written to a temporary path. That backup is opened read-only, checked for integrity and full raw-row equality, closed, and checked for an empty/absent WAL before the final output path is exposed. Source/input/output manifests, process resource receipts, and the final artifact audit belong to the external guarded runner.

`SqliteScalarCounters.test-support.ts` retains only SQL hashes, lengths, and prepare/get/all counters. It never stores statements, parameters, rows, or results. Plain prototype descriptor interception forwards native arguments and supports nesting with the bounded write witness. Closing restores full original descriptors and refuses to overwrite later changes.

## Verification status

The initial pre-gate on 2026-10-05 passed six tests: five tiny disk/WAL counter cases and one read-only raw input/manifest case. The actual acceptance case was explicitly skipped. Both executing Vitest workers reported a 1120 MiB V8 heap limit with 1024 MiB old-space requested; peak observed RSS was 121608 KiB. All 2062 recorded source hashes were unchanged. The terminal runner and workers were reaped.

Subsequent static review strengthened exceptional cleanup, verified the exported backup itself, withheld its final path until verification, and restored the inexpensive moving-actor and pending-decision producer assertions. A final pre-gate and full typecheck are required on that final source before a separately scheduled real acceptance run. No physical-end acceptance pass is claimed here.

## Final integrated pre-gate

Fixed local `31c29dee1fe60cba72511d2e30aa679712156e8d`, source tree `82b019197735fb351a0b3694e10c16f027914f15`, passed catalog generation, complete typecheck and the final six cases on 2026-10-05 00:28:02–00:28:29 UTC. The actual acceptance case was explicitly skipped and remains unverified. The process was reaped with exit 0; all 2,062 tracked hashes and the pinned input hash remained unchanged. Manifest SHA256: `850de8f4f8c8583df47951403ebabe3cf08676891936a33322801ba9e1ed65d2`.

Every observed test fork had the verified 1,120 MiB total V8 heap limit; peak worker RSS was 113 MiB. The direct compiler used 1,408 MiB old space and passed in 23.91 seconds. Independent static review cleared the final cleanup/export changes. Publication adds this documentation only and preserves the same executable source tree. The separately guarded real run must execute both cases with zero skips and complete its closed-output audit before any physical-end acceptance claim.

## Phased continuation after measured negative proof

On source `31c29dee1fe60cba72511d2e30aa679712156e8d`, the actual seal INSERT, intended dependency mutation, thrown rejection, complete rollback, zero terminal rows, and original-row invariance assertions completed at 2026-10-05 00:56:56.784 UTC. This took about 24 minutes. The whole case was deliberately interrupted during the following clean acceptance, with exit 130; it did not pass. Its consistent closed backup has 72 tables/143 rows matching every original table hash, zero end/seal rows, and SHA-256 `9b9540ee332d17da513fb015e7e3a5cef2ef6ef0eb06c7982e071a8783564c87`.

`BASEBALL_FIRST_PLAY_VERIFIED_NEGATIVE_DIR` selects clean acceptance/reopen only by supplying the hash-pinned public projections of the phase, assertion provenance, and interruption receipts from that run. These fixtures live in `docs/verification/fixtures/first-base-negative-phase-31c29/`, the continuation launcher’s default receipt directory. They retain original raw-file hash links and explicitly differ from the private raw reports; the raw reports remain unchanged. An absent setting retains the full combined negative/positive path. A wrong or missing receipt fails input sanity. This reuses only the already executed test fault phase; all four real clean-acceptance derivations and the three reopened read/retry derivations remain unchanged. The original a546 input, production owners, and complete end/future-work/applicability/output assertions remain required.

The continuation's external wall bound is proposed as 7200 seconds based on the measured derivation cost. Worker old-space remains 1024 MiB, actual Node 26.10.0 total heap 1120 MiB, and RSS bound 1536 MiB. A consistent backup at the first committed-end phase is explicitly pending final reopen/retry; only terminal success and the complete exported artifact audit establish the full gate result.

### Fixed clean-selection pre-gate

Local `9e27dc8ba4c3ac29f18069a9761a05177ecbac62`, source tree `04e926d2fec7a6045ed56424288c75f7459a39ad`, passed catalog generation, full typecheck and six preflight cases with the published negative-evidence directory selected. The actual acceptance case remained explicitly skipped. The gate ran 2026-10-05 01:19:59–01:20:31 UTC and was reaped with exit 0. All 2,066 tracked hashes and the original a546 input hash were unchanged; manifest SHA256 `24cec43cd73b09e24f437648688cad7e6c4ff4f938cd02d9da8ad090efa575b2`. The compiler used 1,408 MiB old space; both executing test forks reported the expected 1,120 MiB total V8 heap limit. No wall/RSS guard fired. Publication adds documentation only; its executable source tree remains identical.

## Verified physical-end result

The clean continuation passed on immutable source `9e27dc8ba4c3ac29f18069a9761a05177ecbac62` on 2026-10-05. Both selected cases executed and passed, with no skips: the raw input/manifest sanity case and the real EndStore acceptance, complete close/reopen, unchanged retry, and closed output verification. Native duration was 4773.35 seconds. The completed negative seal-mutation/rollback phase remains separately attributed to source 31c29; its interrupted whole case is not a pass.

The actual end committed at 02:13:32 UTC, and the final reopened/read/retry and backup checks completed at 02:44:01 UTC. This is a final-source rederivation and continuation of the preserved genuine original chain, not a new reconstruction of that entire chain. The test fabricated no physics rows, rule facts, call outcome, retirement, or completion certificate; production owners performed the admitted writes.

The final closed artifact has SHA-256 `3627a8d4e7cf99404eef8a6eefd22af591317a6dedcf46d82a0f61972dfa9331`, 72 tables and 145 rows. Every original nonterminal table count/hash matches input a546. Only the authenticated end and seal rows were added. All final row hashes also match the earlier qualified committed backup; its different file SHA was never presented as the final gate artifact.

- End Source: `physical-end`, version `fixture-v1`
- End snapshot hash: `f35a1d6f5b7b2d70bff1a9e38f27c237b23788a5f6c1210b391cbe82dd1dedc3`
- Seal: game `game-1`, play `7`, original pitch `pitch-0`
- Exact end: origin tick `11180360`, elapsed seconds `0.8499380000000024`, tick `12030298`
- Whole-history manifest hash: `ee1eaec4f6670a66a372adb0b734483effb9b1cbc5155d1b253921356611731e`
- Preserved future work: ten active controllers, one genuine pending defender decision, twenty observation schedules, and ten future communications

The proof retains the original delayed operative call and acknowledged rule identity. Its source-qualified applicability certificate covers the later retained physical suffix without rebinding the old call. All ten players and fifty parts remain owned, with seventy producer identities and forty body/base histories. The old whole-history end stays `unestablished`; the completed envelope supplies the new physical PlayEnd. Moving actors and future work were not cancelled to obtain completion.

All 2067 source hashes, launch controls, Node runtime, public negative evidence, and original a546 input were unchanged at terminal. Input and final output WAL files were empty, every owner handle was closed, and the runner/worker were reaped with exit 0 and no stragglers. The actual worker used Node 26.10.0, a verified 1120 MiB V8 heap limit with 1024 MiB old-space requested, and a peak observed RSS of 324972 KiB. No wall or RSS guard fired.

Verification identities:

- Source manifest SHA-256: `fc8164236a9acd7a4d0b747a55639e5b395f63adb79ba8fa6565f6ac57580d6a`
- Original terminal receipt SHA-256: `9d5f0f99a094a60f0010c41bc1a2c9d3445b4d4bb9c99de7d5e65836ebd9472b`
- Original complete artifact audit SHA-256: `723a93863cd22820589c99ceb7a5c0dc1d2b4c0e44bfdca05d03833f20498a57`
- Original test result SHA-256: `52eb5bc760de7f285020b58f1ee4392023cd994a1cfe139aee18167479880fc7`
- Original actual-worker resource receipt SHA-256: `1310864a039cee9aa4626047e91b0cc5e144a8e4c80c8fc1092b4995b5eec928`

The bounded scalar instrumentation observed 348 distinct SQL hashes, 5,437,615 prepares, 4,460,337 gets, and 2,164,237 alls; 5,437,267 prepares repeated a previously observed SQL hash. It retained no statement or row results. These counts document remaining verification cost and do not change the production proof.

This establishes the concrete physical-end fixture. Official adjudication/application, workload settlement, next-pitch activation, broader unsupported policies, and any later performance changes retain their own separate acceptance gates.
