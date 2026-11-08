# v81 無劣化性能標準と最新版移植

人間はcommit34fc254の旧lv76実証と将来計画を提示し、品質維持の無駄削減を次版以後の標準方針へ恒久化するよう要求。主担当が現行v79/v80を調査し、描画・DOM・軌道複製・全シーン時計・3HTMLとGitHub記録の5段階案を提示。人間は非同期質問に「この計画で実装する（推奨）」と明示回答。再確認不要。

実装計画docs/plans/2026-10-20-v81-lossless-performance-port.md。原文2件はwork/performance-reference/34fc254へpinned取得（a00b628c/cd4d08c3）。基準は通常/labv79、makerv80ローカル未commitを保全。旧v2HTML/patchは未取得で機械的転用せず、現関数へ個別に適用する。

PNG/4px/色/透過/深度/ラベル/UI/音/機能/物理/判定/seed/入力順序を維持。既存673件の選択と全検証を維持。画像や結果が変わる最適化は棄却。実機FPS・熱・電力、ネット対戦、未検証Worker/GPU/配信方式は達成済みにしない。元Charter独立承認HOLD/全FAILBLOCKEDUNKNOWN/元計画残件を保持。
