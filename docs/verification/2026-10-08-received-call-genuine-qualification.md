# Genuine received-call Native input qualification

## Result and scope

The existing read-only Native adapter is now qualified against a newly accepted genuine received call, constructed through existing owners on private copies of the approved public `bf8233fa` original chain. No root was regenerated, no historical row or original coverage was rewritten, and no production code changed in this qualification slice.

The adapter's full input and result match an independently assembled input from original Native owners and the existing Core function. After actual reception it reports `communication_received` and `call_profile_unavailable`, with null selection, selection time, target and policy binding. The exact original issued decision and physically adopted motor remain retained. One decision work item remains pending. Before reception it reports `no_new_trigger`, with no work or call payload.

This is read-only input qualification. It supplies no accepted call policy, durable received decision, renewed motor, new adoption, settlement, SAFE closure, full Positive, whole-current or full-project runtime credit. PR350's lost private provenance remains unavailable and receives no recovery credit.

## Source attribution

- Parent source: `f4b95edbde68fcdee239b28bf712de719e635536`.
- Final tested tree before these documentation edits: `3a4021b275bbd8eee53ddd257d80ff4a7b8f6d9c`.
- Final tested src tree: `1a9d46ff3ecf6a50ae34f02c4fce666827264cda`.
- Final compiler, independent expected-input stage and all three genuine consumer stages share source census `f62cc3e8aec8817602488ab5a83f7daa4dcd8f5761f8bbdf93572054c7fcb253`.

Prerequisite stages retain their own exact source inventories as the test harness evolved. Their accepted outputs are linked by database, receipt, report and terminal hashes; they are not relabeled as reruns on the final harness. The production adapter and original owners are unchanged throughout. The earlier 83 guard/Core assertions and original-root authentication remain separate evidence described in [the input-adapter record](2026-10-08-received-call-native-input.md); they are not added to these stage counts.

## Authentic extension and conservation

The original authentication pins public database hash `691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810` and receipt `42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f`. It authenticated 63 tables, 113 rows, 14 admissions, ten players, fifty roles and the physically active incumbent.

A combined extension exceeded its original 300-second ceiling after three committed umpire rows. That attempt remains failed, with zero pass credit. A separate 9.78-second recovery gate verified its exact failed terminal and full reap, folded its committed WAL into a fresh closed SQLite backup, compared every original schema/row with an exact allowlist of the three added owner rows/admissions, and replayed the real scheduled-call owners. Original main and WAL bytes stayed unchanged. The recovery's successful authentication does not convert the failed attempt into a pass.

Subsequent stages each start from a qualified closed copy and use ordinary owner acceptance. They advance retained commands to the call deadline, accept the operative call, accept the declared communication model and send, accept the scheduled observation, advance to reception, accept the actual reception, and accept its observation. No old Source, coverage, command, policy profile or receipt is manufactured. The independent expected-input stage then authenticates the original owners without invoking the adapter under test.

Every successful stage verifies exact row/schema conservation. Only declared inserts and declared single-head revision increments are permitted. New schemas are checked against the existing six owner layouts, including columns and uniqueness constraints. The final closed artifact contains 69 tables, 135 rows and 24 admissions. Original rows remain unchanged except the explicitly advanced physical/observation heads; the original input artifact itself remains byte-identical.

## Bounded execution evidence

All runtime rows below are separately selected **1/1 passes, zero failures and zero skips**, with exit 0, no owned processes left, and unchanged source/dependency/control/runtime inventories. These are staged qualification cases, not a full-suite pass.

All stages use pinned Node 26.10.0 and a single worker. Runtime heap/RSS caps remain 1,024/1,536 MiB, with 6,144 MiB launch headroom and a continuously enforced 4,096 MiB reserve on an exclusive private-copy lane. Runtime caps are 300 seconds except the separately reviewed, operation-specific 600-second receive and after-observation gates. Their observed costs justified those finite test-policy changes; no validation or production behavior changed. Compiler caps are 1,408 MiB heap, 2,048 MiB RSS, 6,400 MiB launch headroom and the same reserve. Lock identity, inherited descriptor, process identity, cleanup and immutable-input checks remain enforced.

The 300-second receive attempt remains a separate failed result: terminal `6f1c37fdf87cd9523ef2dd904c07536c5763dcf4da42add6436a9ca8a46ffb2c`, exit -15, full reap and zero pass credit. Its application rows/schema match the prior reception-cut checkpoint exactly; no received row committed. The successful 600-second attempt resumed that qualified checkpoint without regenerating earlier stages. Timings isolate 403.42 seconds inside receive acceptance and 536.10 seconds inside after-observation acceptance.

| Stage | Seconds | Peak RSS KiB | Terminal SHA-256 |
| --- | ---: | ---: | --- |
| compiler | 23.15 | 1,506,648 | `2a18d6cf4a130a890a3a3d7d74135a22176133b7effdaf7008806f0be1739635` |
| scheduled recovery | 9.78 | 436,480 | `eeeb9bac1009ce6011be5897ca1fe2ae3e0f4ddfae35938fc186e7b9e28194f1` |
| call-due | 59.46 | 483,244 | `3402423eeb0ace91d561a4d15c027166000c15348215d4a1c76390528f196d61` |
| operative-call | 268.74 | 490,256 | `00c6f41ec716bfa6f22cf575aa39c7ed66d12fc8221e5093b83dbfcfafba1cf6` |
| send | 222.99 | 498,876 | `dbff43abc306213f243f68eb85f5cc0dd48b5ec0637fb411d8c242fed01d2670` |
| before-observation | 233.12 | 497,252 | `32a1de64d19328d66bba85493567249a062a2c0259e91ebc72add225f6b8e314` |
| reception-cut | 77.93 | 504,436 | `5b0cb53f1250a9760f840bd277a532b3a1e80efc2f9060014dd9f56c43e6a229` |
| receive | 414.07 | 495,600 | `f5a6823ee7d3c9d5ea4a3e2fc44993908e4d9a310114c50b97eaa7fc37d704cc` |
| after-observation | 556.04 | 499,012 | `3d47bdb4b3c33c3e742950e3023915aecf860d9bbee83cabe330416aef2e1a52` |
| expected-input | 32.56 | 512,116 | `6c7786a5d60b4c3f10c14452e104e73704cf613c74547c23767700739f55ee0d` |
| semantics | 193.54 | 472,744 | `16e91979eda7f7ab60995adaa284b203f88ef026529945125063af25cb99fd4a` |
| source-faults | 161.49 | 480,216 | `80b7cc6ac1e5f255a67f1a389230f0ef93b1461760b0d8f24383107fedf155c2` |
| corruption | 164.82 | 474,724 | `6fd911558fcdce57b8099fb0498c97777283d30e9020539a2eea37820d049c4a` |

## Final consumer checks

The consumer was split into three independent bounded read-only gates to avoid one large replay-heavy test:

1. **Semantics:** full independent input/Core equality, missing-policy pending state, exact retained incumbent, scheduled no-payload history, deterministic historical retry, caller-owned transactions, query-only settings, authorizer preservation and reopening.
2. **Source faults:** foreign player and pitch, wrong adoption, unowned execution, observation beyond the selected physical cut, unauthorized caller clock and unsupported policy. Each rejection leaves no transaction behind; a subsequent valid read and complete row/schema census remain unchanged.
3. **Corruption:** observation and communication snapshot hashes are changed only in rolled-back transactions on a separate fault copy. Current reads reject each corruption, earlier scheduled reads remain bounded to historical payloads, transactions/rows stay intact, and restored reads return the original evidence hash.

Each consumer gate separately verifies a genuine positive baseline and unchanged bytes of the certified input and its read copy. All three bind the same final database hash `b281f59e66237b93b33d985db53f260566fcbf5facc07eb477e5eb5baf4c4c7f`, extension receipt `e99ebb8f9ff7a0f74d19650a7d41cb21a044fc5def56a0655b581089e1bd84b1`, and bridge evidence hash `624396f1f8e42c0859c722598b7e62cc647487ca63b56743eceb6b4b6ce3e756`.

The tests are explicitly selected with pinned private stage inputs. Default-suite exclusions supply no acceptance credit. Private databases, manifests, controls and raw logs are not published; this record contains only sanitized outcomes and immutable evidence identifiers.
