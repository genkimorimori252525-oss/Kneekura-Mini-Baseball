# Received-call live enrollment: reviewed implementation

The corrected source `9bc84012aecef8f1016589eede5be04eeea058cb` passed 183 scoped tests and full-root compilation. Independent re-review cleared the five recorded findings. Genuine original-owner execution remains unqualified.

## Initial implementation record

2026-10-08. Implementation `6f546da00a206d6cc3939747d75ef52ba33ad40c`, src `1a0bb7b79297bfff5652aba22471722f62a20a01`, built from inert-policy baseline `01f3e42cb994175e35fbff4451a2aeaae6586e68`.

At this initial checkpoint, independent implementation review and genuine original-owner execution were both pending. No private received database was opened or copied, and no original root, call, reception or observation pipeline was reconstructed. This checkpoint does not claim live qualification, physical renewal, closure or production calibration.

## Implemented boundary

The reviewed contract is `docs/superpowers/specs/2026-10-08-received-call-live-enrollment-contract.md` (SHA-256 `d965e45f2fcfab2088afedc50ccf5446dcce211fc697d2cd4fa046f2d19d7c4f`).

- Exact reference-only Sources for prospective enrollment, separate current-cut policy availability and received replan v2.
- Five separate owner tables: enrollment, availability, immutable process revisions, one receiver head, and a four-stage extension journal. Bootstrap is transactional; reads/open/retries create no schema.
- Original-runtime/admission-prefix and physical/observation/incumbent anchors, derived from original owners. Fixed prospective producers do not extend the v1 runtime membership or admission enum.
- Enrollment immediately owns a pending obligation and fences every fresh legacy admission. Metadata-only namespace-qualified discovery follows moved scopes, original references, heads, journals and prior/origin process links. Both terminal writers have separate guards.
- One null-policy process may consume the newly admitted availability in its sole second revision. Core process/work identity stays equal to the origin process Source ID. Selection uses the unchanged Core's exact boundary; renewal remains pending.
- Historical owner reconstruction is separate from current qualification. The v1 adapter, Core implementation, old decision/motor ownership and physical action wires are unchanged.
- The inert policy's new same-connection evidence export preserves the caller transaction/query-only setting and does not create schema or call accepted-input authority.

## Executed verification

A bounded combined gate passed **169 tests across 16 files**, with no skips or errors:

- 48 new contract, metadata discovery, ingress, transaction, enrollment/process and inert-reader tests
- 26 existing inert policy Native tests
- 83 existing received-call v1 guard/Core tests
- 12 existing legacy write-fence tests

The enrollment/process test file explicitly mocks the original-proof module and the inert-policy evidence reader. Its positive cases prove the isolated SQLite state machine and real Core conversion/selection, **not original Native dependency authentication**. The policy-reader tests separately use real Native Player/Person/model fixtures. No substitute fixture is represented as the qualified received artifact.

Separate behavioral REDs preceded fixes for legacy/post-write/registration/terminal bypasses, hidden Core reference claims, unsupported and incomplete Source claims, orphan enrollment reads, post-INSERT accepted-Source drift, non-Native proof access, swallowed exceptions, and independent index-constraint checking. Missing-entry REDs are setup evidence only.

The combined gate's terminal SHA-256 is `08dce8ed85ef417cefd72ad62c7b2dca54274b0bbf10e844383bb4655ae0562a`. Full-root TypeScript compilation passed; its terminal SHA-256 is `6b56ebc34fd625f850b20259e4920a8e5500e0a882318712cd5e6477dc1da232`. The compiler first identified two test-only overloaded-method/`this` annotations; these were corrected. Production bytes did not change after the 169-test gate. A prior compiler attempt was refused before launch by the memory floor and has zero execution credit.

Both qualified terminals report unchanged pinned inputs and full process reap. Node 26.10.0, one test worker and the existing exact dependency/CPU fallback pins were retained. Native limits were 1024 MiB old-space, 1120 MiB measured heap and 2048 MiB RSS; compiler limits were 1408/1504/2048 MiB. The 4096 MiB reserve and 6400 MiB launch floor were not lowered. The ignored catalog was transferred only after its generator and 14 data inputs matched; catalog SHA-256 `4a7452ba4b6d600cfca498f79759f678f4c85884add1d7eee866638e222c0263`.

No full repository test-suite result is claimed.

## Review and remaining gate

Review the Source/schema/claim contracts first, then original evidence reconstruction, journal and transaction ownership, the three durable stores, and the current-work projection. In particular, check historical payload bounds, transitive claim completeness, stage/CAS conservation, callback/rollback behavior and real original-owner compatibility. The mocked state-machine tests cannot close those Native integration questions.

Only after independent review and a separately pinned runtime release may a fresh private copy of the qualified inert-policy database be used. That gate must independently prove the original 69-table/135-row baseline plus its inert-policy row, all 24 legacy admissions and all original heads/commands/roles remain exact. Expected additions are five schemas, nine final extension rows and ten row changes (including the head update).

The genuine expected endpoint remains tick `12030302`, Core-selected `ball_handler`, phase `renewal_due`, and one origin-qualified `renewal_adoption` obligation. OUT `(0.1,0.9)` and SAFE `(0.9,0.1)` are synthetic test priorities. There is no received motor/adoption, physical advancement, queue settlement, SAFE/PlayEnd/official closure, UI change, home-PC CI, merge or deployment credit.


## Independent-review correction checkpoint

Correction implementation `7bee991cb66d5a9ce1952823a910ec9b2db5af87`, src `9bc84012aecef8f1016589eede5be04eeea058cb`, was made in a separate checkout from frozen final `6e362c3c07d0fe318fa11994a0501bb68f914730`. The preceding 169-test/compiler record and its source/control bytes remain unchanged.

Independent re-review cleared these five corrections on `83d365e9c51dae2dd966324cd31222e086e06ffd`; this review did not run or qualify a genuine received database.

The bounded correction addresses five findings:

- A write-transaction savepoint spans bootstrap, producer/head/journal writes and their proofs. A real observer's COMMIT/ROLLBACK followed by BEGIN loses that ownership marker. Loss rejects and retires the private handle. A forced post-INSERT COMMIT can leave a durable partial enrollment; the code reports uncertainty, never repairs rows or claims that rollback undid that commit. The partial state still blocks legacy ingress.
- Namespace discovery includes SQLite case aliases, then rejects noncanonical or partial owner layouts unchanged.
- Journal reads authenticate later owner scope/Source-version mirrors, frozen Source references, predecessor/policy edges and declared snapshot/history headers. Later Core inputs/results remain opaque to earlier replay.
- Read COMMIT, write COMMIT and final durable-readback COMMIT verify query-only state plus row/schema conservation. Post-boundary drift retires the handle with an honest uncertain outcome.
- Proof RELEASE/restoration cleanup failures poison the private connection; a later successful outer rollback does not make it reusable.

Eleven isolated Native lifecycle/namespace counterexamples and two journal counterexamples first failed for their intended reasons. Their corrected runs pass. A separate positive historical control reseals a non-executable later Core payload and proves earlier read/retry remains valid; it does not certify the later receipt.

The corrected combined gate passed **183 tests across 17 files**, with no skips/errors. Full-root TypeScript compilation passed on the same corrected source. Both terminals report unchanged inputs and full reap under the unchanged caps. The mocked original-proof/policy seam limitation remains: no genuine received database was copied or executed, and genuine integration still requires review and its separately pinned release.

- Combined terminal SHA-256: `3717cd44763b3d7553d4e36848373280832f912dd10776012e64e065edccf09d`
- Compiler terminal SHA-256: `7510cf72c1bb8a9c9e5c5720256e4704cf16678b1021494156eb68181b63b5ab`

This correction adds no gameplay capability or production-calibration credit. It does not turn the scoped test results into a full repository suite result.
