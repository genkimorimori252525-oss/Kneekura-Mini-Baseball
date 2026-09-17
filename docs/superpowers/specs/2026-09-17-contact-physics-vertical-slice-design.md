# Contact Physics Vertical Slice Design

更新日: 2026-09-17
状態: 設計承認済み（A案: 最小因果物理）

## 目的

固定打球fixtureではなく、投球状態とバット状態から実際に `BatBallContact` と打球初期状態を生成し、その正史軌道を既存 Mini Presentation Adapter へ渡せる最小縦切りを実装する。

この縦切りは完成版の野球物理ではない。目的は、通常打撃とバントが同じ接触器を使いながら、異なる bat pose / bat velocity により異なる打球を自然に生成できることを確認することである。

## 境界

```text
PitchWorldState(at contact)
+
BatterSwingState(at contact)
        ↓
Deterministic Bat-Ball Contact
        ↓
BattedBallInitialState
        ↓
Minimal 3D Ball Flight
        ↓
CanonicalWorldSnapshot[] + TimedMatchEvent[]
        ↓
Mini Presentation Adapter
```

Core は Presentation を import しない。Presentation は Core が生成した正史状態を読むだけとする。

## Bat-ball contact

バットは `grip` と `tip` を結ぶ有限線分に半径を持たせた capsule として近似する。ボールは半径を持つ球とする。

接触判定は、ボール中心からバット線分上の最近接点までの距離が `batRadius + ballRadius` 以下かで決める。

接触時の局所バット速度は以下から求める。

```text
batLinearVelocity
+
angularVelocity × (contactPoint - grip)
```

接触後のボール速度は、局所バット速度に対する相対速度を法線成分と接線成分へ分解し、同一の反発係数・摩擦係数を適用して求める。

通常打撃とバントで接触式を分岐しない。

- 通常打撃: 大きい bat velocity / swing pose
- バント: 小さい bat velocity / 横向きに近い pose

の違いだけで結果を変える。

`ground_ball` / `fly_ball` / `bunt_grounder` のような結果ラベルを入力にしない。

## Minimal ball flight

最初の縦切りでは以下だけを正史に含める。

- 重力
- 位置・速度の時間発展
- 地面との単純反発
- 地面接触時の水平速度減衰

この段階では抗力、Magnus、風、フェンス衝突は入れない。それらは後続校正フェーズで追加する。

地面衝突は `ballRadius` を地面高さとして扱い、下向き速度を反転して `groundRestitution` を掛け、水平成分へ `groundFriction` を掛ける。

## Determinism

- 時間入力は integer tick を使う。
- 数値計算に乱数を使わない。
- 同一入力は同一 `BattedBallInitialState` / snapshot 列 / event 列を返す。
- Presentation 用の補間や見た目補正を Core へ入れない。

## Vertical slice output

`simulateContactVerticalSlice` は最低限以下を返す。

```ts
type ContactVerticalSliceResult = {
  contact: BatBallContactResult;
  initialBall: BattedBallInitialState;
  snapshots: readonly CanonicalWorldSnapshot[];
  events: readonly TimedMatchEvent[];
};
```

contact tick の snapshot を必ず含める。

`events` には `BatBallContact` を exact tick で1件生成し、payload に最低限 `point` と `liveBattedBall: true` を入れる。

守備・走者は呼び出し側から渡された初期状態をそのまま各 snapshot に保持する。今回の縦切りでは守備AIや走塁AIを進めない。

## Bunt

バント専用の衝突式は作らない。

バントの違いは `BatterSwingState` の以下で表現する。

- `pose.grip`
- `pose.tip`
- `linearVelocity`
- `angularVelocity`

Presentation 側では既存の `bunt_show / bunt_hold / bunt_contact / bunt_pullback` を使う。

これにより、バットをきれいな共通シルエットで描いたまま横向きに近い姿勢を表現し、物理結果は実際の接触状態から発生させる。

## Acceptance Criteria

- バットとボールが離れている場合は接触しない。
- 接触時には最近接点と法線から post-contact velocity を決定する。
- 同じ接触式で通常打撃とバントを処理する。
- テストfixtureでは通常打撃の方がバントより高い打球速度を生成する。
- バントでも `BatBallContact` と live batted ball event を生成できる。
- post-contact snapshot は正史 ball position / velocity / spin を持つ。
- contact tick snapshot が存在する。
- 同一入力を2回実行して完全一致する。
- Core は Presentation モジュールへ依存しない。
- `npm run verify` が成功する。
