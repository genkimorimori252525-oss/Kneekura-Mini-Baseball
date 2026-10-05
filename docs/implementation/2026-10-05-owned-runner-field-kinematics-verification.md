# Owned runner field kinematics: verified integration

The dedicated `readOwnedRunnerField` API now reconstructs actual endpoint kinematics from the versioned eleven-player field prefix. It retains the original runner controller, Player/Person identity, root/body-pose decomposition, canonical cleanup residual and all fifty-five physical parts. Fractional contact moments and an actual zero-duration initial bag contact remain readable without creating future execution coverage.

The existing original-contact and legacy ten-player readers preserve their scope and archive bytes. This change does not issue a runner decision, change its controller, cross later analytic controller pieces, or admit a general-runner rule/Scope/closure path. The next implementation step is explicit retained-piece execution from the already owned controller.

## Exact integration evidence

Integration Source: `7a7f60bcca909e468a2485325ac39292083b86e9`, on the coherent PR309 stack.

- Full tree before documentation: `23152a7d0324b7e5a98fe8763e0b0a3e99e067db`
- Complete `src` tree: `1b391a61705bab6cbfdd3568796a222f42acc4f8`
- Prepared tracked-file manifest SHA-256: `f6b74b4d2764c8bea2371a97a58a0fd42478f7f6eefebf189c86b0d72a3946d4`
- Eight-path implementation patch SHA-256: `bfab07628562b1f018a73bfb70913ae04c9897886ae4ddc17c72318b384d9c60`

The fixed integration passed **6 files / 61 tests**, zero failures/skips/unhandled errors, in 47.402 seconds including catalog preparation. The selection includes the real Native close/reopen proof, new endpoint/reader cases, original-contact runner kinematics and original archive bytes. Peak aggregate RSS was 470,960 KiB; actual worker heap was 1,120 MiB. Terminal receipt SHA-256: `a2607455ba6c5bd0961a81f45ba52c59d8d848ba180dcd99c3c6ecd9d809107b`.

Full TypeScript compilation passed on the same Source in 32.586 seconds including catalog preparation, with peak aggregate RSS 1,355,356 KiB and actual heap 1,504 MiB. Terminal receipt SHA-256: `f49476bf46aa2c83a6337417db8bc7efd56e9447189f31dedb33bfac9d999687`.

Both gates held the three exclusive runtime locks, observed no resource stop, reaped all owned processes and verified unchanged Source/control/runtime bytes. Publication adds only this verification document and a status update after the fixed Source; the complete `src` tree remains identical.

## Author-source and review evidence

The separate author Source `49e1e98890ae52e17f51b2a658ba56f78f1fd4b7` passed 60 focused cases, full compilation, one genuine Native case and eight legacy prefix-reader cases, each as a separately bounded, fully reaped gate. The legacy phase completed in 122.126 seconds; receipt SHA-256 `96dfba046dbf9b6aa444b8ec3a9480c27bbfa953c78aa25d5eb5a26e8b9a95b7`. The Native receipt SHA-256 is `545c92bedb80b339dfc4c256b37824d7afe272e710a20fba77f56dcdcddc6dd9`.

Test-first API absence was observed in 26 cases. Independent review then exposed a valid initial bag overlap rejected by a strict elapsed-time comparison: the unchanged 26 cases passed while that added case failed. The narrow repair admits the genuine zero-duration physical boundary, followed by the author and current-stack gates above. These are fixed-source component results, not a cumulative whole pass.

## Remaining verification

The latest completed cumulative whole remains PR277: 697 files / 5,159 tests plus typecheck. The current-stack whole, forty-piece archive gate, all-role workload/next-pitch chain and remaining non-design plan are still outstanding. The separately proven physical-end and official-stage receipts retain their original source identities; this runner change does not inherit those stage results as its own proof.
