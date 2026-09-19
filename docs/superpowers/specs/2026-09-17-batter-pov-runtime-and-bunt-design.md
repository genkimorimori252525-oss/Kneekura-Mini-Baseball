# Batter POV Runtime Adapter and Bunt Presentation Design

更新日: 2026-09-20
状態: 既存 Batter POV 設計の実装メモ

## 目的

固定 review fixture だけを再生する Batter POV プロトタイプを、Match Core の任意の正史サンプルを受け取れる Mini Baseball の Presentation Adapter へ移行する。

Presentation は打球種別を先に決めない。Core が出した ball / defender / runner / bat の正史状態と TimedMatchEvent を描くだけとする。

```text
CanonicalWorldSnapshot + BatterPresentationState + TimedMatchEvent[]
        ↓
Mini Presentation Adapter
        ↓
Batter POV Camera / Field Overhead Camera
        ↓
4px fine-grid renderer
```

## Runtime input boundary

ゲーム用入力は固定軌道ではなく、時刻付きサンプル列を受け取る。

- `CanonicalWorldSnapshot` は ball / defenders / runners の正史状態を持つ。
- `BatterPresentationState` は handedness、bat action、bat grip/tip pose を持つ。
- pitcher animation pose は Presentation metadata として付与可能。
- renderer は結果ラベルから軌道を作らない。
- sample を再生しても再抽選しない。

標準 Presentation cadence は 55ms (`55_000` microseconds)。重要イベントの exact sample は cadence の間へ入ってよい。

## Contact hard cut

`BatBallContact` かつ payload の `liveBattedBall === true` を切替条件とする。

接触 tick に正史 sample が存在することを必須とする。Presentation は接触位置を補間生成しない。

同じ sample を使い、同じ tick で以下の2フレームを生成する。

```text
BATTER_POV contact frame
FIELD_OVERHEAD first frame
```

以後は Field / Overhead を継続する。見逃し、空振り、live ball でない微小接触では Batter POV を維持する。

## Right / left batter

打者の利き側は Camera Adapter の入力にする。

- `R`: eye X は三塁側寄り
- `L`: eye X は一塁側寄り
- world 自体は左右反転しない
- bat pose はその打者の正史 pose を使う

右打者用の画面を丸ごと反転して塁や守備位置まで交換することは禁止する。

## Bunt presentation

バントは通常スイングの結果ラベルではなく bat action と bat pose で表現する。

`BatActionType` の初期集合:

- `idle`
- `normal_swing`
- `bunt_show`
- `bunt_hold`
- `bunt_contact`
- `bunt_pullback`

バントでもバット描画器は共通とし、きれいな太さ・輪郭を維持する。違いは入力 pose の `grip` / `tip` で作る。

- バント構えでは bat を横向きに近い専用 pose にする。
- 完全水平を強制しない。実際の pose が先端上げ/下げを表現できる。
- renderer が「バントだから90度回転」のような見た目専用補正を勝手に加えない。
- `bunt_contact` で live batted ball が発生した場合も通常打撃と同じ contact hard cut を使う。
- `bunt_pullback` は接触なしなら Batter POV を維持する。

これによりセーフティバント、スクイズ、バスターなどを後から Core / decision layer 側で表現できる。

## Manager-mode strike-zone guide

2026-09-20 のユーザー決定により、監督モードの `BATTER_POV` / `PITCHER_POV` ではストライクゾーンガイドを表示対象とする。

現時点では、フォーム再現をまだ製品要件として確定していないため、**Height-Ratio V1** を暫定の自動生成ポリシーとする。

```text
PlayerPhysicalProfile.heightMeters
        ↓
Height-Ratio V1
  upperY = height × 0.535
  lowerY = height × 0.270
  width  = home plate width
        ↓
StrikeZoneRegion
        ├─ physical pitch adjudication contract
        └─ read-only Presentation guide
              ↓
        Batter / Pitcher POV projection
```

- 横幅は本塁の物理幅 17インチ / 0.4318m。
- 打者身長が違えば、ゾーンの高さだけでなく上下位置も変わる。
- 固定された画面矩形をストライクゾーン真値として使わない。
- 53.5% / 27% は2026 MLB ABSを参考にした**暫定Product Policy**であり、NPB人間球審の規則定義そのものとは扱わない。
- 監督モードは `matchupPlayers.batter.playerId` と対応する `PlayerPhysicalProfile` があればHeight-Ratio V1を自動生成する。
- リプレイも同じ打者profileから同じゾーンを再生成できる。
- 将来フォームを正史化する場合は `batting_stance_landmarks` policyへ切替可能とし、肩上端 / ズボン上端 / 膝頭下端を使うlandmark resolverを保持する。
- どちらの生成方式でも下流は同じ `StrikeZoneRegion` を受け取り、投球判定・審判・描画の契約を変えない。
- 明示的な `strikeZoneGuide` は将来のフォーム対応 / 保存済みリプレイ等のcanonical override seamとして残す。
- ガイド表示は人間球審の `OnFieldCall` そのものではない。人間の実効ゾーンが心理・知覚で揺れても、表示ガイドのcanonical zoneは別に保持する。
- Presentationの線種・濃度・装飾は Work の領域であり、表示からCore判定へ逆流させない。

将来フォーム対応の推奨進化順:

```text
Height-Ratio V1
      ↓
height + stance offsets
      ↓
batting-stance body landmarks
```

## Rendering invariants

- 4px相当 fine-grid
- 55ms標準 cadence
- position tween / CSS transition / ease 禁止
- exact event frame 許可
- black / white / yellow を Batter POV の基調とする
- strike-zone guide はCoreの規則ジオメトリを読み取るPresentation guideであり、表示自体は物理や審判判定の権限を持たない
- renderer は守備位置を固定値で持たず `CanonicalWorldSnapshot.defenders` を読む
- renderer は打球パターン別アニメーションを持たない

## Acceptance criteria

- 任意の `CanonicalWorldSnapshot` 列から Presentation frame を生成できる。
- defender positions を固定配置へ置き換えない。
- 右/左打者で camera eye が左右対応する。
- bunt 専用 action を通常 swing と区別できる。
- bunt の bat は専用 grip/tip pose を共通 bat renderer へ渡せる。
- live `BatBallContact` では exact tick に Batter POV と Field Overhead の2フレームを生成する。
- exact contact sample が欠けている場合は補間せずエラーにする。
- non-live contact / miss / take は Batter POV を継続する。
- 監督モードの Batter/Pitcher POV は打者identity + PlayerPhysicalProfileからHeight-Ratio V1を自動解決できる。
- 異なる身長からゾーンの上下位置・高さが変化する。
- explicit strikeZoneGuide を与えた場合は同じStrikeZoneRegion seamで将来のform-aware policyを利用できる。
- 同じ `StrikeZoneRegion` を投球判定とPresentation投影で共有でき、投影前後で投球判定は不変である。