# Received controller / terminal handoff component

Implementation checkpoint: `2c9eba396ed2347286d1695560482b0b1606851f`, source tree `b6d30c58943312e1478f9f89f9323abcfbffb719`, on top of the earlier continuation component `817e0e77fa84b984d4e618f8512a1ee665d92a23`.

The new `openSqliteActualReceivedUmpireHandoffStore` accepts a versioned handoff and independently accepted physical/communication Sources. It authenticates the current received adoption or continuation, derives the existing retained quantizer seal at that predecessor's tick, derives the normal communication revision at the actual resulting cut, and commits five writes with a separate receipt. Original runtime/admission bytes and owner enums are untouched. Both accepted successor Sources remain frozen on retry; cold reads need no callback.

Whole-play history records distinct received adoption and continuation kinds. The v2 retained-command parser preserves the received adoption's identity; the v1 parser still rejects it. The new current-work branch follows the admitted successor rather than asking the earlier received cut to remain current.

PlayEnd now authenticates the separate extension's physical/communication coverage, recognizes the received decision's exact observation, and checks each due recipient's own call/origin-communication/Player/Person/controller chain. Its existing operative retirement, exact quantizer seal, current heads, contact/rule consumption, body/base facts and independent pending work remain required. The original terminal fence compares extension claims around both writes. Historical replay does not acquire a current-head requirement.

Light author checks:

- 38 pure cases passed: seven new received-history cases, 25 existing history cases and six Source/recipient cases. That initial aggregate receipt remains failed because a missing brace prevented the two new Native fixture cases from collecting; the test syntax was corrected.
- A reached Native RED demonstrated that a changed accepted communication Source was silently accepted on handoff retry. The fix compares both referenced Source hashes with the authenticated saved receipt.
- Four Native lifecycle cases then passed in 0.582 seconds (3.19 seconds including load): five-write acceptance/cold retry, complete rollback after communication Source drift, and both successor Source redefinitions. These fixtures explicitly isolate lower physical/received/communication derivations; they are not genuine gameplay qualification.
- No owned processes remained, and all four input groups were stable. The 18 protected source blobs remain identical.

The final Native GREEN terminal SHA-256 is `274b0d59f63b9431ae3e08b208539ed6b8c3a402bf3325756cd901c0c06b86d7`. The intended RED terminal is `1a9ef036d910f09bdd19c2761301345defe2072c09aa7584436ab683c9409260`. Independent read-only review found the retry issue and confirmed its correction. The final current-qualification flag wiring was added afterward and awaits the connected batch's verification.

This is one finite seal → communication → terminal route, not unrestricted ordinary continuation. Accepted inputs must name the current received predecessor, the existing retained quantizer Source and the normal communication revision. Unresolved contact, exhausted coverage, new rule-relevant physical/base facts, or a due receiver without its own controller proof remain pending. Repeated/general renewal, post-reception offensive control and arbitrary later physical/observer admissions are outside this capability; no missing producer is disguised as an input choice.

Full compiler, shared-intersection checks and genuine execution remain assigned to the connected Match batch. No donor copy, genuine replay, broad rerun or remote publication occurred here. The earlier 279-case raw PASS/controller-inventory-failure attribution and every closed genuine checkpoint remain unchanged.
