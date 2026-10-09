# Native received renewal enrollment checkpoint

This checkpoint implements the first boundary of the reviewed Native renewal contract: reference-only enrollment derives the original received process, exact cut, accepted model references and ten on-play participants, then atomically owns one enrollment, head and journal row. It leaves a Native decision obligation pending. Decision, motor and physical adoption are not implemented by this checkpoint.

Source commit: `fe22166462417d5962cd2c348f5e8d42636a5255`; source tree: `831a7c2108ae386cf07f9175315669b103f14de6`. Contract: `16293f561b0b61be090f33bc0ac4978da475420e`. The 18 protected source/fixture blobs remain unchanged.

The new renewal family has five exact tables and fourteen automatic constraint indexes. Only first acceptance installs them, inside its transaction. Reads and retries create no schema. Fresh ingress discovers both received families and surviving renewal physical references, including when the old family is absent; historical journal conservation remains family-specific. Pre-bootstrap admission rejects orphan renewal claims before creating old or new ownership. Complete cut equality and exact integer locomotion boundaries reject equal quantized ticks with different elapsed instants.

## Verification

- The finite affected inventory passed **217/217**: the inherited 188 received/Core/fence cases and 29 new Native fence, bootstrap, enrollment, exact-cut and evidence cases. Test terminal SHA256: `a921055611c8e10a4f57f48bda2dbb40181f75f69f23521fad71c3f87956a60e`.
- Full project TypeScript compilation passed with no diagnostics. Compiler terminal SHA256: `653e2780e490a2903ebc82faad60c5de64bea7269fae3bd6096fc612a985c9ee`.
- Both final processes exited 0, left no owned processes, and preserved their source/dependency/control/runtime input groups. Native limits were 1024 MiB requested heap, 1120 MiB measured limit and 2048 MiB RSS. Compiler limits were the separately approved 1664/1760/2304 MiB. Both retained the 6400 MiB launch floor and 4096 MiB live reserve.
- Counterexamples reproduced missing renewal-only fences, premature old-family bootstrap, missing physical predecessor links, aliased physical execution owners, incomplete union admission and inherited proof-cleanup retirement. Real COMMIT/rebegin injection retains an honest uncertain durable outcome and retires the private handle; it does not repair committed rows.
- The evidence fixture has eighteen model entries and ten original on-play bindings. It checks participant/Person matching, bounded historical reads, model rebinding and complete cut equality. Native enrollment fixtures isolate original-owner authentication while exercising real SQLite rows, write counts, rollback, close/reopen and callbacks. These fixtures provide **no genuine received-donor qualification**.

Earlier attempts are retained honestly: the first 209-case compatibility run had one failure caused by unnecessary unrelated legacy JSON traversal; a focused corrected run passed all 40 executed tests but its supervisor rejected an incomplete inventory of four existing parameterized cases. An initial evidence fixture had a syntax error and ran zero tests. Those records remain failed. The final 217-case inventory and compiler above supersede their qualification, without rewriting them.

The prior 216-case/compiler checkpoint remains valid for its earlier source; one subsequently reproduced physical table alias case and its four-line fix produced the final 217-case checkpoint above.

The previously completed eight genuine received checkpoints remain separate evidence for the received enrollment/replan path. Their donor and controls were untouched. Full Native renewal and any subsequent genuine artifact gate remain later qualification work; no motor, physical advancement or SAFE closure is claimed here.
