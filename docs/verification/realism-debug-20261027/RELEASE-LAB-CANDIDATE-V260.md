# 同一 r6 Core の調整室候補

2026-10-31。旧調整室を保持し、同期 Main Host を使う埋込 game の Native を、メーカー・通常試合候補と同じ r6 Core `b664cc5c3b3a9146b1f19107ccd8a30600d3df6bd08e9228693ad8a577d589aa` へ交換した。camera A/B・音声・既存素材と外側処理を維持。候補 `work/release-lab-r6-v260-03/lab.html` SHA-256 `c448b4fd2f2449f7081dbcce1eee0ca1bf8586545a938cea1839e6f193dad1f0`。元 roster・素材の公開可否は未審査で、local-only 検証版。

最初の候補は実行Coreが新 r6 なのに metadata が旧Coreのままで、旧sessionを新Coreで誤って再生成する P1 が見つかり受入保留。修正版は実 game/Core hash と入力数を記録し、未証明の旧Core互換を付与しない。旧metadataの構造と非path値を維持し、既知の端末絶対path値だけを伏せる。旧labと元情報はローカルに保護する。旧sessionおよび旧camera調整JSON／localStorageの新candidateへの自動移行は未対応であり、旧調整室を保持する。

実Chrome 156.0.8078.76で固定seedの１球、実Core表示・script一致、同期Main Host・Worker生成なし、camera A/Bのtickとscene一致、cameraと音声設定の保持を確認。正規UIから同buildのsessionを書き出して再読し、history・state・設定がlossless一致。旧Core identityへ改変した **synthetic** sessionは拒否し、直前stateを保持。390pxも確認。receipt `f471cf7e06344a51ba2ad4e8785e24c6` PASS、report SHA-256 `cadface1521330fb3a49f89834abd3a926130d46447114bbcf054608f06fa339`、終了pinsとローカル証拠４件を照合した。

先行 `4ffcc5ddcccc4e46a2be36f01ed3f924` はsession段階のtimeoutとして保持。閉じた操作セクションは原因候補だが、初回の厳密な失敗操作は確定していない。旧候補の不正identityは修正し、旧互換を偽る説明も変更した。実在の旧ユーザーsession／旧tuningの新build互換、音声の実再生、全９回、完成版３HTML配送は未証明。
