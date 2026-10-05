# Related receipt scope census audit

Test-only child of `ae1019e9a5dbe40a8dbdec8693b5cf66f9c1e217`.
The original implementation `924f884` and its unrun GREEN controls, and the
32-case application/closure identity RED source/control cut, stay unchanged.
No production repair or extra runtime is part of this source checkpoint.

`OfficialStateApplicationReceipt` carries `previousPlayId`.
`NextLiveBallPlayActivation` carries `previousPlayId`, `applicationId` and
`closureId`. `OfficialGameResult` carries `gameId`, `applicationId`, `closureId`
and optional `venueBinding.gameId`. Those are real schema fields, not arbitrary
keys invented by a test.

The staging owner currently checks originalReceipt.receipt.previousPlayId but
misses originalReceipt.activation.previousPlayId and originalReceipt.result.gameId.
The closure owner census misses corresponding expectedOfficial/official receipt
and activation previousPlayId and result gameId. The original applications census
has no game+previousPlay identity pair at all.

Twenty-two test-only negative cases target these real receipt scope mirrors,
with ordinary and escaped duplicate key variants. Four positive cases preserve
an unrelated later-play metadata row in the same game. They assert a paired
(game, previous play) census, not rejection merely for sharing a game. The
positive rows are deliberately unrelated synthetic metadata, not evidence of
legitimate later gameplay execution.

A repair should retain metadata-only ownership discovery, include each real
receipt branch in application/closure/game/play ownership, and reuse the
existing actualLiveClosureApplicationRows application census. Selected domain
archives must still be fully rederived and compared. No extra ownership claim
should be inferred from nextMatchState.playId, which identifies the next play.

Remaining wider raw mirror examples include optional final-result
venueBinding.gameId and original application physicalTimeline.playId. Any
coverage claim must name which paths were tested; these 26 cases do not prove
all possible cached archive rewrites. All 26 are unexecuted at this checkpoint.
