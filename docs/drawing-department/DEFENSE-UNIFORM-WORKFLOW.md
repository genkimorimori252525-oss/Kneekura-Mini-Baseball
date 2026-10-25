# 守備ユニフォームと帽子・ヘルメットの制作手順

更新: 2026-10-25。状態: **USER-DIRECTED METHOD / LOCAL TEMPLATE / CORE NOT CONNECTED**。

本人が評価したのは、各原画のつばに合わせて頭部の見え方を決める方法。全コマの新しい衣装を個別採用済みとは扱わない。本書は現在のPNG派生描画を継続する手順であり、保留中のPixel Player JSON原本計画の再開ではない。

## AIが毎回守ること

1. 採用台帳から正確な原画コマを選び、ID・画像SHA-256・切出しrectを固定する。却下／差替え済みの画像を復活させない。
2. 帽子、打撃ヘルメット、黒い捕手マスクを区別する。捕手マスクへLAや打撃ヘルメットを重ねない。
3. **原画のつばの根元Aと先端Bを登録し、yaw/pitchと帽体輪郭を照合して方向を確定する。** 2点だけから3D方向を一意に測定したとは言わない。
4. 同じ投影でLAの位置・傾き・圧縮・見え隠れを決める。背面・真横へ正面のLAを貼らない。帽子の小型設定`markScale:0.65`を今回の基準とし、読ませるために正面へ向け直さない。
5. 確定値はそのID/SHA/rectへ結び付ける。ブラウザー保存をJSONへ出し、検証付きCLIで登録へ取り込む。別コマや差替え画像へ無条件で流用しない。
6. 元PNGを保持する。チームのデザインと、モーションごとの部位マスク・表面座標を分離する。肌、グラブ、黒い捕手防具を保護する。靴・名前・番号は選手設定。
7. 胸・背・左右脇・左右袖・パンツ前後の共有8面へデザインを置き、表面投影と遮蔽の後に丸ドットとして描画する。球場制作と同じ素材→mipmap→距離場相当の局所精細化を共有する。完成画像に読める文字をHUDのように貼らない。
8. 技術PASS、AIの目視、本人の採用、本番統合を分けて記録する。衣装適用で腕の可動域や捕球判定の技術保留は解除されない。

## ローカル実装の入口

project rootから `output/b2-defense-motion-probe/uniform-design/` を参照する。このGitHub文書だけではローカル実装や生成PNGがGitHubに収録済みとは証明されない。

| ファイル | 用途 |
| --- | --- |
| `uniforms.json` | ホーム白・アウェー青、白パンツ、配色・8面・選手差分 |
| `wardrobe-profiles/*.json` | 採用57素材の部位・表面・頭部登録。チームを変えても再利用 |
| `headgear-orientation.cjs` / `headgear-alignment.js` | つば照合、コマ限定の方向保存とJSON出力 |
| `wardrobe-render.cjs` | `createRenderer(config)` → `load(entry)` → `draw(prepared,kit,player)` |
| `wardrobe-build.cjs` | 57素材×2kitのPNG・縮小版・catalog・比較シート |
| `wardrobe.html` | 全件一覧、原画比較、名前・番号・靴、個別PNG、帽子方向調整 |
| `wardrobe-cli.cjs` | list / inspect / render / render-all / import-alignments |
| `wardrobe-qa.cjs` | 元画像、衣装・保護部位、出力、ブラウザー操作の検証 |

```text
node output/b2-defense-motion-probe/uniform-design/build.cjs
node output/b2-defense-motion-probe/uniform-design/wardrobe-build.cjs
node output/b2-defense-motion-probe/uniform-design/wardrobe-cli.cjs inspect --id b2-field-ground-v1:1
node output/b2-defense-motion-probe/uniform-design/wardrobe-cli.cjs import-alignments --input confirmed.json
node output/b2-defense-motion-probe/uniform-design/wardrobe-build.cjs
node output/b2-defense-motion-probe/uniform-design/wardrobe-cli.cjs render-all --uniform another-uniform.json --out output/another-uniform
node --expose-gc output/b2-defense-motion-probe/uniform-design/wardrobe-qa.cjs
```

ブラウザーの`window.wardrobeLab`には`list`、`inspect`、`selectSource`、`setPlayer`、`setKit`、`source`、`setOrientation`、`confirmOrientation`、`exportAlignments`、`snapshot`がある。AIは素材IDと実画像を照合して操作する。確定はブラウザー内だけに保存されるため、永続登録にはJSON取り込みと再buildが必要。

別ユニは共通デザイン設定と必要な胸文字素材を差し替え、同じ部位登録を使って生成する。名前・番号・靴の差分とチーム差分を混ぜない。別デザインの本格比較は本人が後で試す予定。

## 現在の範囲と検証境界

採用57素材（捕手20、通常守備23、牽制・ダイビング14）のホーム／アウェー114画像を生成。全身姿勢は採用原画に従う。暴投素材も新しい派生衣装だけを適用し、既存の原画使用ルートは保持する。打撃ヘルメットは既存の採用スライディング見本で別途照合する。

3塁牽制2/3の切出しに含まれる隣コマ断片は、`wardrobe-extraction-fixes.json`の限定矩形だけ派生PNGから除外する。元PNGや従来の切出し／retarget技術保留を変更しない。

原画SHA・採用、114出力SHA／共通描画器一致、alpha、肌・グラブ・黒防具、靴設定の局所性、57件のブラウザー選択、向き保存と再読込、PNG保存、元画像2素材／描画cache24MiBを確認する。透明RGBや半透明境界のPNG丸めを、生のRGBA全一致と混同しない。

実検証の結果は[描画担当の既存記録Issue #381](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/issues/381)へ集約する。Core・物理・公式結果・本番ゲームへの接続は未実施。この文書を追加しただけで統合完了にしない。

関連: [PNG継続](../presentation/2026-10-01-png-player-continuation.md)、[World-First/Broadcast](../architecture/WORLD-FIRST-BROADCAST.md)。

## 2026-10-26 訂正：修正済み捕手の描画経路を衣装一覧で共有

本人が`catcher-ball-v1 / ball-left`の腕が胸へ埋まる表示を再指摘。以前修正した腕／ミット分離描画と別に、一覧が旧全身PNGへ衣装だけを適用していた。目視確認でも見落とした。

現在は`catcher-layered/draw.cjs`に既存の修正済み描画を共有し、該当素材の`wardrobe-profiles/catcher.json`に`rendering.mode=catcher-layered`を指定。衣装一覧・拡大表示・PNG保存・Node／CLI一括書き出しを同じ経路につなぐ。AIはこの指定を無視して旧原画への配色だけに戻さない。元PNGは修正前の比較資料として保持し、変更しない。派生PNGは既存分離描画の800×720になり、この1コマに原画alpha一致を主張しない。他56素材の保護検査は維持する。

最終20群PASS `B2-CATCHER-WARDROBE-ROUTING-FINAL_6da42157326a490dbe449a25fd8da90d`。両kitの前腕で胸線漏れ0、ブラウザーの既存修正版と一覧のPNGが両kit／白靴で完全一致し、保存PNGも一致。原画・採用台帳・Core・暴投の原画経路は保持。新しい本人採用と本番統合は未確認。
