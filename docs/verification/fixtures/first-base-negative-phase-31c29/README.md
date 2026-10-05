# Original first-base negative-phase evidence

These three small publication projections preserve the completed real seal-INSERT and rollback phase on fixed source `31c29dee1fe60cba72511d2e30aa679712156e8d`. The original test witnessed its deliberate post-INSERT corruption, required rejection, and asserted rollback, unchanged original rows and zero end/seal records at 2026-10-05 00:56:56 UTC. The entire case was then deliberately interrupted with exit 130 for a phase-specific continuation; it did not pass.

Private absolute paths and process/session identifiers were removed before publication. Each projected receipt retains the SHA-256 of its original raw report, so these projections are explicitly not byte-identical copies. The original raw reports remain unchanged. The phase JSONL differs only by removal of the disposable local database path; its original SHA is retained in the receipt.

The resulting local backup had 72 tables / 143 rows, with every table count and logical row hash equal to the already published pre-end fixture (`a54678e3aae1c6df0d25683b65c2811cedfed98539ca604aa233563f9eee7caa`), and zero end/seal records. Its recorded byte digest is provenance, not a claim that another database is included here. The clean continuation uses a disposable copy of that published pre-end fixture, with all normal production owner checks.

Hash-pinning these records skips only a previously asserted test fault phase. It is never a production completion flag or a substitute for clean physical-end admission, close/reopen/retry, official closure or a current whole-suite result.
