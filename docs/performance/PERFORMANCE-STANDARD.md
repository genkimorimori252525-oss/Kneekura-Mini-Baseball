# Mini Baseball — 品質を維持する性能改善の標準

2026-10-20、人間が承認した5段階計画の恒久規約。原案は設計branchの[34fc254](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/34fc25416fce227388207890835056ae505a7be2)。旧lv76実験と、[最新版v81の証拠](2026-10-20-v81-lossless-results.md)を区別する。

## 品質と所有

エンジンで野球が進み、カメラがその状態を観測する。性能改善で、正史時計・物理・回転・接触・守備走塁の判断・裁定・seed・入力順序を変えない。PNG原本、4px格子、色・透過・深度、名前の重なり、球とバットの形・見え方、既存UI・保存・全673実測軌道を維持する。

減らす対象は重複計算、不要なDOM更新、再複製、再合成、確保である。画質低下、資料や検証の削除、独立した球だけの疑似高FPSを改善に含めない。現在球にSourceの連続観測を使う場合も、同じ表示時刻のカメラ・バット・選手を1回の全シーン描画へ送る。Coreの保存frameの時刻解像度は変えない。

## 継承する実装

次版はv81を基準にし、以下を削除・旧版へ戻さない。意図的に替える場合は同じ品質試験で置換を証明する。

- `broadcast-renderer-performance-v81.mjs`：カメラ係数共有、4px地面射線の再利用、数値depth key、厳密に同じ静止背景の再利用。
- `presentation-ui-performance-v81.mjs`：時刻の二分探索、actorごとの名前DOM再利用。同tickは最後のframeを選び、走者の前面表示と毎回の実寸測定を維持する。
- `MeasuredClipValidationCacheV81.ts`：全673件を維持した検証済み内部cloneの共有。[完全な所有・Proxy検証契約](2026-10-20-v81-measured-clip-cache.md)に従う。初回の追加コストと再利用効果を別計測する。
- `presentation-cadence-performance-v81.mjs`、v81メーカーadapter／調整室：通常55/3ms、自由投球22/3msを目標とする全シーン更新。RAFと処理時間が上限であり、60FPSの保証ではない。
- `build-v81.mjs`、`build-maker.mjs --lossless-performance`、`package-v81.py`：通常・調整室・メーカーの同一renderer、Source hash、全機能の接続を検証する。

再生成はrepo rootで `node tools/browser-bridge/build-lossless-release-v81.mjs`。受入試験後に `py -3.10 -X utf8 tools/browser-bridge/package-v81.py` で凍結する。新しい版のbuilderはこの入口を基準にする。

新しい描画時刻の追加と、同じ時刻での画素差を混同しない。既定の停止seekは旧版と同じframe表示。調整室の再生は`seekPresentationMs(value,{continuousPitchObservation:true})`で、その描画に限り同時刻の自由投球Sourceを観測する。観測後は必ず解除し、試合を進めない。

## キャッシュ失効と合成

背景cacheはeye/yaw/pitch/f/cx/cy、球場形状、camera/detail/glow、canvas寸法等の完全一致だけで使う。値を丸めない。2回連続で同一条件の時だけ1枚を保存し、移動カメラで毎回readbackしない。depth・mark・anchor・診断も復元し、動的actorから書くMap/配列は別所有にする。readback不可時は元の描画へ戻る。

field Canvas contextはrendererが専有する。外部の`clip`、非opaque alpha、filter等を差し込む拡張はcache契約に含まない。その拡張を追加するなら失効またはcache停止と画素試験を同時に追加する。`putImageData`はclip/transform/compositeを無視するためである。

フォント・resize・名前倍率は毎描画の実寸測定へ反映する。合成の最終順序はfield→bat→names→ball。Canvasのwidth再設定はclip等のresetという意味を持つため、単なる同値代入として削除しない。合成のskipには全依存の証明が必要であり、v81では公開copy処理を維持した。

## 採用ゲート

1. 実装前のHTMLとSource/素材hash、ブラウザ・DPR・viewport・指示・seedを保存。
2. 同時刻の全RGBA/alpha・ラベル・状態を比較。左右、投球、スイング、打球、送球、捕球、各視点、逆seek、設定変更、実寸変化を対象にする。
3. 同条件の全history JSON・球数・最終matchを照合し、9回完走、守備の全complete、保存・再読・重複拒否を確認。限定試打を完走の代用にしない。
4. 初回起動、再試合、描画、合成、確保/heap、RAFの実提出数を別計測。目標間隔を実測FPSと呼ばない。プロファイル・失敗・棄却案も残す。
5. 最終HTMLとSourceの開始/終了/pinを照合し、同じ3成果物で受入試験後に配布する。旧FAIL/HOLD/UNKNOWNを消さない。

再利用harnessは`check-performance-scenes-v81.mjs`、`check-maker-pixels-performance-v81.mjs`、`check-lab-performance-v81.mjs`、`check-full-history-performance-v81.mjs`、`check-live-cadence-performance-v81.mjs`。各々artifactと証拠directoryを引数に取る。比較元reportがあるharnessはそれを最後の引数へ渡す。

Worker/GPU、全画面RGBA転送削減、分割配信、全UIの更新抑制は、計測と同一品質の証明後に採用する候補。原計画の60FPS/p95 16.7ms、実Android/iOSのFPS・発熱・電力、オンラインは未達/未検証として扱う。物理係数の校正、100試合分布、Native認証、元の機能残件を性能改善の完了に含めない。
