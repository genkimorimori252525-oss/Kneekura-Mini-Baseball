# Batter POV Drone-Art Presentation Design

更新日: 2026-09-17
状態: 設計承認済み・プロトタイプ実装前

## 1. 目的

監督モードの投球中表示として、Mini Baseball の既存 Drone-Art 表現を用いた **打者一人称視点 (Batter POV)** を追加する。

この表示は画像生成や動画素材ではなく、`CanonicalWorldSnapshot` / 正史時間軸を読む Presentation Adapter として実装する。

既存の Drone-Art 原則を変更しない。

- 基準 viewBox: `600 x 430`
- 表示グリッド: 4px相当
- 標準 Presentation cadence: 55ms / display step
- CSS transition / tween / ease / 見た目専用位置補間は禁止
- 重要イベントは通常 cadence の間へ exact event frame を挿入できる
- Presentation は Match Core の位置・速度・接触・結果を変更しない

---

## 2. Camera Architecture

Batter POV を専用物理として作らず、既存の正史3D座標を異なるカメラへ投影する。

```text
Canonical World
      ↓
Presentation Sample
      ↓
Camera Adapter
  ├─ Batter POV
  └─ Field / Overhead
      ↓
Fine-grid quantization
      ↓
Drone-Art Renderer
```

打者視点と球場視点は同一の Canonical World / TimedMatchEvent を観測する。

カメラ変更によってボール軌道、打撃結果、守備判断、走塁、規則結果を再計算しない。

---

## 3. Batter POV

### 3.1 視点位置

カメラは打者の目に近い位置へ置く。

- 右打者と左打者で左右位置を鏡映する
- 打者身長・構えに応じた目線高を後続実装で校正可能にする
- 投手、マウンド、ホームベース、投球ボールが一つの投影空間に存在する
- 打者本人の全身モデルは原則表示しない
- バットまたは手元を画面下端へ最小限の Drone-Art 表現として出すことは許可する

Batter POV は「ゲーム的に見やすい捕手後方カメラ」ではなく、打者が実際に投手方向を見ていることを優先する。

### 3.2 透視投影と離散表示

正史3D座標を Batter Camera へ透視投影し、その画面座標を4px細密グリッドへ量子化する。

```text
Canonical position (x,y,z)
      ↓
Perspective projection from batter eye
      ↓
Screen-space position + apparent size
      ↓
4px fine-grid quantization
      ↓
Drone-Art sample
```

ボールが打者へ近づくほど見かけの大きさは増えるが、連続Tweenで拡大しない。

各 Presentation Sample ごとに正史位置から投影・量子化した結果だけを表示する。

---

## 4. 再生テンポ

Batter POV も既存の Drone-Art と同じ標準テンポを使う。

```text
55ms / display step
```

これは Presentation cadence であり Simulation Clock ではない。

投球の速度感を理由に Batter POV だけ補間や異なる時間軸を導入しない。

必要な滑らかさは、正史状態の十分なサンプル密度と exact event frame で得る。

---

## 5. Contact-driven Camera Cut

### 5.1 切替トリガー

カメラ切替は打撃結果ラベルや推定ではなく、正史の `BatBallContact` で行う。

```text
Pitch begins
   ↓
BATTER_POV
   ↓
BatBallContact event
   ↓
HARD CUT
   ↓
FIELD_OVERHEAD
```

有効な打球が発生する接触では、その接触時刻を境界として球場カメラへ即座に切り替える。

### 5.2 Exact event frame

通常サンプルが以下でも、

```text
110ms
165ms
```

接触が137msなら、

```text
110ms  BATTER_POV
137ms  BATTER_POV contact frame
137ms  FIELD_OVERHEAD first frame
165ms  FIELD_OVERHEAD
```

のように event-aware frame を挿入してよい。

同一正史時刻で camera mode を切り替えるため、接触直後の打球開始位置を見失わない。

### 5.3 トランジション

カメラ間の視覚トランジションは入れない。

禁止:

- cross-fade
- zoom-out animation
- camera flight
- tweened camera movement

採用:

```text
Batter POV
   ↓
instant hard cut
   ↓
Field / Overhead
```

Drone-Art の離散表現とテンポを優先する。

---

## 6. 非接触プレー

カメラ切替を単純な「スイングしたか」では決めない。

初期規則:

- 見逃し: Batter POV 維持
- 空振り: Batter POV 維持
- 投球が捕手へ到達: Batter POV 維持して投球結果を表示可能
- バント接触で live batted ball 発生: Field / Overhead へ切替
- 通常打撃接触で live batted ball 発生: Field / Overhead へ切替

ファウルチップ、捕手捕球される微小接触、ファウル打球などの細分は、Core の event kind / RuleEngine 結果に基づいて後続仕様で固定する。Presentation が推測しない。

---

## 7. Strike Zone Guide

ストライクゾーンは正史物理の一部ではなく、監督モード向け Presentation Guide とする。

初期プロトタイプでは薄いガイドを表示可能にする。

- 投球の読解を邪魔しない低コントラスト
- RuleStrikeZone / Batter stance から導出可能な将来構造を想定
- ガイド表示ON/OFFで投球結果は変わらない
- Umpire Call の真実として扱わない

---

## 8. Prototype Scope

最初のプロトタイプでは野球Coreを再実装しない。

固定されたサンプル軌道を使い、以下だけを確認する。

1. 打者目線として投手とボールが読めるか
2. 55ms / 4px量子化でも球速感が成立するか
3. ボールの接近が離散的でも不自然すぎないか
4. 接触フレームが視認できるか
5. 接触瞬間の Hard Cut が気持ちよく読めるか
6. 切替直後に打球方向を見失わないか

プロトタイプの固定軌道は Product Physics の確定値ではなく、Presentation の視認性評価専用とする。

---

## 9. Acceptance Criteria

- 右打者視点で投手からホームへ向かう球を認識できる
- 4px量子化が既存 Drone-Art と視覚的に統一される
- 55ms cadenceを維持する
- position tween / CSS transition を使わない
- 接触時刻を通常cadenceへ丸めず event frame として表示できる
- `BatBallContact` で即時に球場真上視点へ切り替わる
- カメラ切替アニメーションを挟まない
- カメラを変更してもサンプルの正史打球結果は変化しない
- 表示を止めても同じサンプルイベント列を再生できる

## 10. 今回固定した事項

- Batter POV は A案: 打者本人の目に近い一人称視点
- 既存 Drone-Art の4px / 55ms / no interpolationを継承
- 正史3D位置を perspective projection して量子化する
- 右打者 / 左打者で視点位置を鏡映する
- live batted-ball contact をカメラ切替トリガーとする
- 接触 exact event frame を挿入する
- 接触時に Field / Overhead へ即時 Hard Cut する
- トランジション演出は入れない
- 最初のUIプロトタイプでは固定サンプル軌道を使い、Presentationの読みやすさだけを評価する
