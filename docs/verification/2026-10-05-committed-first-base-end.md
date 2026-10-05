# First real physical end checkpoint

The clean acceptance on immutable source `9e27dc8ba4c3ac29f18069a9761a05177ecbac62` returned a committed physical end at **2026-10-05 02:13:32 UTC**, about 49 minutes after it began. Source tree: `04e926d2fec7a6045ed56424288c75f7459a39ad`. The 2,067-file source manifest, including the generated catalog, is `fc8164236a9acd7a4d0b747a55639e5b395f63adb79ba8fa6565f6ac57580d6a`.

The test used the checked pre-end input `a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa`. Its earlier real seal-insertion fault, corruption rejection and rollback are preserved by the separate [negative-phase receipts](fixtures/first-base-negative-phase-31c29/README.md). The clean continuation still performed all four acceptance derivations. No production source or running control was changed.

The actual owner committed one end row and its game-1 / play 7 / pitch-0 seal. The returned original-rule/call applicability, causal membership, exact boundary and future-work assertions passed, after which all original test connections closed. The fixed run is now rederiving the reopened owner and exact retry. **Its terminal result is still pending; no completed Native gate or downstream pipeline success is claimed.**

The [bounded synthetic backup manifest](fixtures/first-base-committed-end-9e27d.manifest.json) records database SHA-256 `7a5ac68f840f0d5127c62ad9d1134e4bcc0bb746036734a22c34677ddc266bd8`, 72 tables and 145 rows. Both a read-only row-hash audit and an independent exact-row comparison confirm that all 70 original nonterminal tables remain unchanged. The backup passed SQLite integrity, empty-WAL and deterministic encoding checks. Its text fields contain no credential, email or private-filesystem markers. This is synthetic test output, not an application/user database dump.

The end snapshot is `f35a1d6f5b7b2d70bff1a9e38f27c237b23788a5f6c1210b391cbe82dd1dedc3`. It preserves the existing whole-history end as unestablished and adds the separately authenticated Native end/fence. Future work remains explicit: ten controllers, one pending defender decision, twenty observations and ten communications. None was cancelled or fabricated to obtain the end.

This documentation/artifact checkpoint has no production-code delta. The official closure, all-role workload, next-pitch pipeline, general runners, practice/Career and current cumulative whole gate remain open. The downstream verifier must reject this pending-proof artifact until the real producer's complete terminal receipt and lineage are verified.

## Subsequent complete verification

At 02:44:01 UTC, the same immutable source completed both actual cases with zero skips, including all reopened-owner reads, exact retry and final backup audit. [The complete physical-end verification record](2026-10-05-minimal-first-base-artifact-acceptance.md#verified-physical-end-result) preserves the exact receipt, source, input and final-artifact identities. Every logical row of the final artifact matches the approved first committed backup published here; the byte-distinct final file is identified separately. This later success does not rewrite the manifest's pending-at-capture status or turn a publication summary into a raw producer receipt. Downstream official/workload/next-pitch and later-source gates remain separate.
