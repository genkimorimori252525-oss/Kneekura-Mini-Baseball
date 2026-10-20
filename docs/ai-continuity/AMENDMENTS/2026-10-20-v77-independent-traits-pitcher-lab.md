# v77 承認された変更

人間は確認案に対し「この範囲で順に実装する（推奨）」と明示回答した。

1. 基礎能力と得能を分離。公開/詳細基礎値は得能によって変更しない。独立効果を実行時に1回だけ反映。
2. 分かる元名を表示、説明は?へ。先行追加4familyはinside_command/high_zone_hitting/low_zone_hitting/pitcher_field_reaction。119inventoryの既存IDを使い重複しない。
3. 同Coreの球種別spin/releaseと無回転差を使う投手調整室。フォームはrelease高/幅/伸び・準備時間・頭移動の作者設定。実測と偽らない。
4. 人間を初期表示とするメーカー共通AIモード。試投は即再実行、通常試合の能力反映は既存どおり新試合から。

[承認された範囲・検証](../../plans/2026-10-20-v77-traits-and-pitcher-lab-review.md)。旧v1意味/元ファイル/初期20/既存HTMLは保全。旧送球の元基礎値は復元不能なので現在値を維持し新traitを自動付与しない。旧greenの保存baselineを使う。

旧canonical09 §3.3のSOURCE_DERIVED送球と独自表示名方針への、人間の最新指示による追補。原canonical bytesを書換えて過去に遡った承認にしない。同一family内金/青は排他、結果率の直接指定は禁止、元全計画と旧FAIL/UNKNOWN/HOLDを保持。

作業分担の裁定：変更が独立するファイル群を限定してCore/基礎分離/新UIを並行実装し、rootが共有契約と最終統合を所有する。初期案の読取reviewのみより実装の待ち時間を減らすため。各agentの所有ファイルを分離し、生成物はrootのみ更新する。
