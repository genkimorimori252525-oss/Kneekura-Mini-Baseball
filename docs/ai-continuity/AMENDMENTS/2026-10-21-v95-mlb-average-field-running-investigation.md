# MB-20261021-V95 — MLB平均基準の守備走塁検証

出典: 本チャットの人間の直接依頼、2026-10-21。ライトゴロ多発・肩力過大・エラー後の走塁不自然さを調べ、全員MLB平均の「The平均選手」で基準を検証し、球場/能力/緑得能/方針の自由度を維持して検証エンジンを改善する。根本設計に問題があれば再構成可。必要なら一次資料等を調査する。

調査で一塁停止、全野手最大肩の転用、新ミス認識の走者反応非依存、診断default未較正/ケース不足を再現した。悪送球や捕球弾きが走塁へ全く接続されていないという仮説は否定。断定を区別し、現Core/HTMLは変更していない。

調査証拠 `docs/verification/releases/v95-investigation/README.md`。製品変更案 `docs/design/2026-10-21-v95-mlb-reference-field-running-harness-proposal.md`。ユーザー指定AGENTS.mdの事前確認に対し、`call_361dfc22b7fd4eb3940b0f33cd79bfbd` item0で人間が「この計画で実装する（推奨）」と明示回答。記載範囲を承認済みとして実装を進める。全Charter承認へは拡張しない。実装計画は `docs/design/2026-10-21-v95-implementation-plan.md`。

既存v94・旧FAIL/UNKNOWN・Charter HOLD・元計画の残件を保持。GitHub公開/commit、別UIデザインや全Native認証は本調査から承認されたと解釈しない。
