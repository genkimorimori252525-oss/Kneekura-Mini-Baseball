# Observation and communication private-read qualification

This checkpoint scopes each store-owned observation/communication read group to one private read transaction and physical traversal. Accepted-Source callbacks stay between fresh snapshots; caller transactions and the existing writer revalidation keep their ownership. The compatibility fixture installs complete mocks before binding real traversal helpers, avoiding the prior circular mock setup failure.

The nine source paths above PR340 head `d2d0ce960b65a510dd2529cca475262014eeacb9` reproduce the entire qualified `src` tree `2f5b2b4cbbea388eca21f9979be52260d7cea677` of source `ac26dffb3033e63b2ae78c8ad84cfaa2e23fc1a7`. Every other parent file is preserved; only this result note is added. Repository runtime/test configuration and dependency declarations match that source. This publication has a distinct full tree and is not a new runtime execution or an integration of other pending slices.

The source-ac26 gate ended at **2026-10-07 04:06:21 UTC**: full compiler/catalog and **137 PASS / 0 FAIL / 0 SKIP in 16 complete selected test files**, across 13 successful stages. All stages exited 0; source/dependencies/controls stayed unchanged, all owned processes were reaped, and no owned process remained. Terminal SHA-256: `402cc2960a5a897873bb34fbd234ac4aa3baf48e4c6cffcb1d9d1cfbe10c14bb`. Coverage includes 18 authentic private-read cases for observation and communication, WAL visibility, fresh authority/retry reads, cleanup/error identity, caller ownership, writer revalidation and the preserved compatibility/physical traversal controls.

Earlier evidence keeps its original attribution:

- Source `579b74d53a79847eda81da599dae83dab9fc52b1`: genuine RED qualified with one Native baseline pass and two intended private-read failures; 21 other discovered cases were pending. Receipt `f682e159a3a41b92862c7c34ac68eb95b59dc804ac0a9b3c496300aaa4f74554`.
- Source `5ecb99e7681ae7fdb8e0cf1a1ff6b1b25e28ef49`: the first GREEN attempt remained FAILED, with 14 compatibility passes, nine mock setup failures and 114 planned cases unstarted. Receipt `413d1cc6d755ed6ad21a4c9e1dc197b6d2411aecd55618d69bdacc77d71a0993`. The new result does not rewrite that attempt.
- Source `dbb032dd43d6ce3856a9a6b921af63569b897215`: the original received-call prerequisite remained FAILED at its 1,200-second wall cap; its process exited -15 and was reaped, with zero Native prerequisite qualification credit. Receipt `46d208de679be3ca45e7eaee31b8176dd6c930c65476bce9073b4984ccc5ae4e`.

Four existing prerequisite fixture/test paths are retained solely to preserve the exact qualified source ancestry. The standalone `ActualReceivedCallControllerPrerequisite.test.ts` is outside the 16 selected files; its presence and successful compilation do not mean its prerequisite passed. No database, domain archive, raw log, receipt bundle, manifest or execution controller is added.

This result claims **no measured speedup, received-call semantic consumption, replan, motor renewal/adoption, PlayEnd, full Positive, whole-project success or completion of the existing implementation plan**. The received-call prerequisite and later Native path remain held.
