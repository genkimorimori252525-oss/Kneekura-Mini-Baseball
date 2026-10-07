# Recovered activation readiness candidate

This Draft preserves the reviewed repair that hands an already authenticated historical readiness result from prior-closure validation into the same native activation read. Every prior scope still finishes, raw owner rows are checked again, final application identity and bytes remain checked, and independent operations authenticate freshly. Legacy autocommit and prepare-only behavior stays explicit.

The candidate is based on PR352 head `ae366870d28fab9061f0c5b673dc39cbc8ed7a21`. Its source tree is `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`. The recovered two-file production patch matches its original SHA-256 `406abae4b59c0f17b0cd7df078f90d84f4f4195d3a126de23b7125e9ec646a69`; all four recovered test/support files also match retained original file hashes. The focused compiler configuration was recovered from text, with its original byte identity unverified.

Workspace replacement on 2026-10-07 destroyed the previous raw test receipts and private artifacts. They are not inherited by this checkpoint. A fresh focused compiler passed on test-only baseline `5f4a0cc1a7f9d60517ddd2b3e8240a7c17d0a7fb`, before the production patch. The earlier full-project compiler attempt failed at its 1024 MiB V8 old-space limit. A subsequent bounded compiler launcher stopped in its preload because it incorrectly expected total V8 heap to be at most 1088 MiB; the exact Node 26.10 binary reports 1120 MiB for the 1024 MiB old-space setting. That launcher failure was reaped and produced no test credit.

The production candidate has not yet passed a fresh compiler or runtime gate. The 31 authored cases, adjacent regressions, genuine two-completed-prior fixture, actual flight, root continuation and whole-project acceptance remain unqualified here. The next step is the corrected runtime probe, fresh existing-API RED, candidate compiler and staged GREEN. No performance improvement is claimed.

This is a code and concise status checkpoint. It contains no database, domain-row export, raw execution log or test-receipt bundle.
