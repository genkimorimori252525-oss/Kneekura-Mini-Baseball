# Actual observation writer read phases

`SqliteActualFieldObservationStore.accept` now places its prewrite
`currentBefore` and postwrite `current` / `read` verification in two separate
existing physical traversals. The preflight read already owned a traversal.
Repeated dependency reads inside each phase can therefore reuse an authenticated
field root while continuing to audit its original archives.

Authority callbacks, `BEGIN IMMEDIATE`, fence creation, observation/head/admission
writes and `COMMIT` stay outside these scopes. The postwrite phase starts after
all writes and authenticates their actual state. Independent retries and reads
retain fresh scopes. No cache, schema, Source, archive format, physical model or
child-frame reuse rule was added or changed.

The focused Native regression uses the existing explicit synthetic observation
fixture and real owners. Passive witnesses count original response reads caused
by field reads; they do not replace evidence or return values. It requires one
field-root authentication per each of three distinct phases, reuse by subsequent
dependency reads, and three new scopes for an exact retry plus an independent
read. A real post-INSERT trigger corrupts the field archive; the test witnesses
the write, requires rejection, and checks exact rowid/value rollback. Corrupting
the original response from the retry authority callback also requires rejection.

TDD: the unchanged writer failed the intended missing-frame assertion after a
real successful observation. The two-scope change passed that regression; the
final test also passed with the stronger original-response callback fault.
Author validation is this one focused case with Node 26.10.0, one worker,
`--no-cache` and an external cache directory. Full compiler, existing observation
controls and genuine National continuation remain central batch checks.

This establishes reuse and freshness boundaries, not a wall-time improvement.
The earlier completed National historical read identified expensive original
binding authentication, but did not exercise observation admission or its
current-pitch checks.
