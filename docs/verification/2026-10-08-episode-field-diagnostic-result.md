# Episode field diagnostic: completed timing observations

The current v2 field command reached Core with its accepted 2 ms interval
and all 50 actor primitives. The world segment returned in 0.79 ms; the full
initial-field Core call returned in 4.30 ms. The enclosing field execution
returned in 12.97 ms. No motion value, model, policy or horizon was changed.

The initial binding read took 105.59 seconds. During the subsequent normal
acceptance call, field root authentication took 114.30 seconds. Both invoked
the same historical actual-live closure through physical activation and again
through frame base-center authentication. Five recorded complete closure
derivations took approximately 52.65–58.86 seconds each. Acceptance then
entered its first pre-write binding-current check; that check had not returned
when the bounded diagnostic ended.

The diagnostic used source `61e225c0861b258349e8ccea8c6c67f51b330dbb`, source
tree `d6282acbf39547cc25d74ab213778291b4a050c0`. All 2,651 earlier tracked files,
including production and original F01, were byte-identical to `f43c7a9`.
Nine transparency checks passed, terminal
`3d25303d2e5008756d4862bc06d72ff80db06562a2570fb75c0ce7b93461837e`.
The full compiler passed, terminal
`16744105dfefa2beb0992f5c9b0504ebbbe9e55bf949bc619e1c836fa95bb732`.

The single diagnostic reached its 600-second wall cap and is FAILED, terminal
`ddf1731100cb4f2d842b6bb33f259c666b832848761e292ad94017398375e8ea`.
Both owned processes were reaped with exit -15/raw wait 15. All four input
groups were unchanged and no process survived. Peak combined RSS was
543,972 KiB. The retained main database still matched the closed binding
input; its WAL was empty. No persisted field delta or acceptance return was
observed. No SQLite connection was opened for post-termination inspection.

The trace admitted exactly 6,000 spans. The suppression notice occurred at
229.06 trace seconds; completions of already-open spans remained observable.
Four recorded spans were still open at termination: the fixture owner call,
field current-before, field current-root, and binding current. Trace time
starts after process launch; the unresolved pre-write duration is approximate.
Recorded observer I/O was about 0.34 seconds. These are bounded diagnostic
observations with instrumentation overhead, not production benchmarks.

Trace SHA-256:
`320c315ce8173eb590d7c815cb52825e8b2b6cd15ff5d64f9efd7ec633efa988`.
Full local byte/process/span audit SHA-256:
`b0aa16e140478782e8dfdffb43872d27ced9da672ffaaa53f6f71a6bedb85fdf`.
Private artifacts remain local.

Original F01 remains FAILED at its separate 3,600-second cap, with zero field
credit and unknown original close success. This diagnostic also grants zero
field credit; its original close success is unknown. The earlier failed P00
and distinct RC01 recovery remain separate in the accepted binding lineage.
No broader terminal support or hour-long retry was included. The next narrow
source correction concerns repeated readiness reads within one owned snapshot.
