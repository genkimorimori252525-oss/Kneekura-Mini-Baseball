# V121 実装判断

日時: 2026-10-26 JST / Task MB-20261026-SWING-VISION-PITCH-V121

対象: SWG、BAT-MASS-MAX、PLV-75+と、本人が依頼した回転効率・球質・カーブ段階の確認。本人の「実装してくれ」を当該範囲への承認として使用。依頼範囲の通常判断は記録で進めるという本人の運用指示に従い、同じ承認を反復しない。

根拠のGitHub設計はcommit `ef0e516a32d3e810039ea229720f526592457773` に固定し、5原文のGit blob SHAを検証した。実装ownerはローカルNative branch HEAD `90dba70ba1a0b92840b303769e854047e725a317` と保全したV120の175 Native入力。共有worktreeの他の変更は戻さない。

判断:

1. 既存LivePitchと実測Reference運動へ統合し、新しい接触・試合エンジンは作らない。バット質量と剛体接触は既存実装を使用する。
2. 旧BAT文書のリーグ相対選球眼という記述より、現在の明示方針と既存Sourceの絶対1–100を優先する。1–75と旧JSONのfallbackを保ち、明示した75超の後半情報利用だけを追加する。
3. 旧JSONの最大芯速度を現在用具で測定済みと仮定しない。重量連動の数値には明示baseline/calibrationを必要とし、それがない場合は未算出にする。旧スイング方針も無断で新profileへ移行しない。
4. 回転効率は既存gyro/3D spinの重複入力にせず、導出・観測表示で扱う。『キレ』の名前で終盤の任意急変や結果buffを追加しない。調子・疲労・心理の未知Sourceは未接続とする。
5. 原測定673試技を維持する。677試技全部を収録したとは説明しない。窓外欠損2試技の追加は別の版変更とする。
6. 旧UI試験の同期呼出前提より、既存の非同期生成・受理境界を優先して試験を更新する。試験を通すためにCore・生成品質・表示時刻を変更しない。
7. V120のNative基準hashをrepo内に保存し、新builderから一時candidateのsnapshotへの依存を除く。旧公開HTMLは保護し、新ファイルは別ディレクトリへ生成する。

影響: 明示採用した新profileと明示75超の観測・運動が変わる。公開ランクを物理原因にせず、元PNG・原ライブラリー・球場/個人差・他の能力は維持する。schemaへの追加項目はoptional。

検証: `docs/verification/swing-pitch-v121-2026-10-26/RESULTS.md` と `integrity.json`。失敗時の元ログも保全。復旧: 新HTMLを採用せず以前の独立HTMLを開く。Sourceのcommit/push、merge、deployはしていない。判断要約のみ既存の公開PR #380へ記録する。

公開範囲を確認した既存PRへの判断要約: https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6402521851 。投稿本文をreadbackし一致を確認。Source本文・私的入力・画像の公開はしていない。
