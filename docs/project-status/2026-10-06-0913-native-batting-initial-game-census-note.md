# 2026-10-06 09:13 UTC: initial-game census repair note

The earlier [bounded source audit](2026-10-06-native-batting-legacy-scope-source-audit.md) is preserved byte-for-byte as historical analysis. Its proposed exact-play pairing is superseded for this stance owner by the proved initial-only game admission rule.

`BattingStanceEvidence.derive` requires initialWorldSourceId and rejects activation-origin actors. The existing initial-World owner enforces an unplayed pregame Match; actor reconstruction fixes officialRevision0. Current admission also rechecks the exact original open frame and applicable model. Therefore any recorded execution claiming this original game makes a first new initial stance ineligible, regardless of moved play/timeline mirrors.

The repair checks heads.game_id and all four existing primary action game mirrors: SQL game_id, source_json.gameId, snapshot.source.gameId and snapshot.frame.gameId. The prior registered actor/match fallback stays intact. Historical read and same-source retry retain their original evidence and skip current admission. No new owner, recursive search or generic verification framework is introduced.

Source recheck accepted exact BattingStanceEvidence SHA256 `3f318786784fdebff48b50841c2bd6e0f053ff5ede6643bd3656705956510316`. The five first guard REDs fcbd9668 and five additional local legacy-scope REDs ec82d9f7 remain separate observed prerequisites. Final158 qualification is still held and unproved.
