# Pixel Player System — Design / Implementation Plan

更新日: 2026-10-01  
状態: **USER APPROVED DESIGN / IMPLEMENTATION PLAN — 実装前**  
対象branch: `jolly/core-foundation-plan-2026-09-17`  
対象: Mini Baseball Presentation  
非対象: Match Core の物理・判定・AI・正史結果の変更

関連Canonical / approved design:
- `docs/game-design/00-current-design-handoff.md`
- `docs/game-design/07-drone-art-presentation.md`
- `docs/superpowers/specs/2026-09-17-batter-pov-drone-art-design.md`
- `docs/superpowers/specs/2026-09-17-batter-pov-runtime-and-bunt-design.md`
- `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md`
- `docs/superpowers/specs/2026-09-17-contact-physics-vertical-slice-design.md`
- `docs/superpowers/plans/2026-09-23-pitch-timing-cadence-quick-delivery.md`

---

# 1. Goal

Mini Baseball の選手表示を、写真をドット絵風へ加工した素材ではなく、**最初からゲーム用の真正な Pixel Art として設計された選手表現**へ移行する。

Pixel Player System は新しい試合シミュレーションではない。

正史は既存どおり:

```text
Shared Match Core
  ↓
CanonicalWorldSnapshot / TimedMatchEvent / canonical motion facts
  ↓
Mini Presentation Adapter
  ↓
Camera projection
  ↓
Pixel Player System
  ↓
screen
```

とする。

最重要原則:

> **世界・物理・時間は連続した正史。選手の見た目だけを離散的な2D Pixel Artで表現する。**

写真・画像生成モデル・3Dレンダー画像を最終スプライトへ直接変換することを標準経路にしない。

写真は、必要ならフォーム・体格・構え・装備・外見上の特徴をAIが観察するための**参考資料**として使用できる。

---

# 2. Adversarial / Compatibility Audit Result

2026-10-01 に、既存の Match / Drone-Art / Batter POV / contact physics 設計と照合した。

結論:

**Pixel Player System の基本方針は既存Canonicalと整合する。採用可能。**

ただし、初期案をそのまま固定すると品質低下につながる可能性がある箇所を以下のように補強する。

## 2.1 採用を維持する事項

- Pixel Player は Presentation-only。
- `CanonicalWorldSnapshot` の位置・速度・結果を書き換えない。
- 4px細密グリッド思想を継承する。
- 標準 Presentation cadence は 55ms。
- CSS transition / tween / ease / 見た目専用位置補間は禁止。
- Camera が正史3D座標を投影し、Sprite はその投影結果へ配置される。
- 右打者 / 左打者を理由に world 全体を鏡映しない。
- 同じ正史playは renderer の有無・種類に関係なく同じ結果になる。
- 物理バットは正史として存在し続ける。
- 見た目のバットは選手Pixel Artへ含める。
- AIが部分編集しやすい構造化アセットをSource of Truthとする。
- 最初に1人を全対象camera / actionで成立させ、その後量産する。

## 2.2 監査で補強した事項

### A. 8方向を全アニメーションへ機械的に強制しない

8方向は、自由なcamera-relative表示に耐えるための**標準coverage目標**とする。

ただし:

- 全action × 全方向 × 全LODを最初から手作業で埋めることを要求しない。
- 固定POVで実際に見えない方向まで先に量産しない。
- camera coverage matrix を使い、必要な方向から実装する。
- 将来camera自由度が増えた場合に8方向へ拡張できるcontractを最初から持つ。

これにより、品質を下げる「枚数を埋めるための低品質量産」を避ける。

### B. Perspective scale は連続的にスプライトを潰さない

選手の画面上の位置は正史3D位置から透視投影する。

一方、Pixel Art本体の表示サイズは、連続scale tweenではなく**camera depth / apparent size由来の離散Scale Tier / LOD**へ量子化する。

目的:

- ドット輪郭を守る。
- 遠距離で潰れた汚いSpriteを表示しない。
- 既存Drone-Artの離散表示と統一する。
- 遠近感は維持する。

### C. 不可視物理バットと絵のバットの接触整合を契約化する

物理バットは連続的に動く正史の衝突形状であり、画面には描画しない。

Pixel Art内のバットは離散フレームで描く。

そのため、通常フレームで完全一致を強制しないが、**BatBallContact の exact event frame では視覚上の接触が破綻しないことを必須**とする。

各打撃Sprite frame は少なくとも:

- visual grip anchor
- visual bat tip anchor
- visual contact corridor / bat silhouette bounds

をmetadataとして持てる。

Frame Selector はcanonical bat pose / contact eventを読み、exact contact frameでは正史接触点に最も整合する authored frame を選ぶ。

Presentation が物理バットを動かして絵へ合わせることは禁止する。

---

# 3. Architectural Boundary

## 3.1 Match Core is authoritative

Pixel Player System は以下を決定しない。

- 選手のworld position
- velocity
- 投球release timing
- BatBallContact
- バットの正史pose / velocity
- 捕球
- 送球
- 走塁
- tag / force
- out / safe
- 打球軌道
- 守備判断
- 打撃結果

```text
Canonical Truth
  ↓ read only
Pixel Player Presentation
```

逆方向依存は禁止。

## 3.2 Presentation Context

現在の `CanonicalWorldSnapshot` は playerId と正史位置を持つ。

外見やSprite identityをCoreへ混ぜない。

候補contract:

```ts
type PixelPlayerPresentationProfile = Readonly<{
  playerId: string;
  bodyProfileId: string;
  uniformProfileId: string;
  handedness?: 'R' | 'L';
  throws?: 'R' | 'L';
  appearanceVariantId?: string;
  authoredAssetId: string;
}>;
```

これはPresentation側でplayerIdへjoinする。

身長・体格など既存Player Source Stateに存在する情報はread-onlyで参照できるが、Pixel Player用の表示値をMatch能力へ戻してはならない。

---

# 4. Asset Philosophy

## 4.1 Final assets are true pixel art

禁止する標準制作経路:

```text
photo
 -> image-generation / photo filter
 -> pixelate
 -> runtime sprite
```

採用する経路:

```text
reference material
 -> AI / artist observes structure
 -> authored Pixel Sprite Source
 -> deterministic build / validation
 -> runtime sprite atlas
```

Pixel Artの形・輪郭・姿勢はゲーム内サイズで読めるよう意図的に設計する。

## 4.2 AI-editable Source of Truth

最終PNGだけをSource of Truthにしない。

各Spriteは、AIが部分的に理解・変更できるtext-based / structured sourceを持つ。

実装形式はprototypeで最終決定してよいが、contractとして以下を満たす。

- palette reference
- logical canvas size
- layer identity
- body-part / equipment semantic names
- frame identity
- direction identity
- anchor metadata
- pixel / primitive data
- deterministic compile result

例:

```text
player/
  player.profile.json
  batting/
    idle.pixel.*
    swing-1.pixel.*
    swing-2.pixel.*
    contact.pixel.*
  pitching/
    frame-1.pixel.*
    frame-2.pixel.*
    frame-3.pixel.*
    frame-4.pixel.*
  fielding/
  running/
  compiled/
    atlas.png
    atlas.json
```

`*.pixel.*` のexact encodingは実装時の小規模prototypeで比較して決める。

JSON / TypeScript / compact row-map 等のいずれでもよい。

重要なのは「AIが右肘だけ変更」「足位置だけ1セル変更」のような差分編集を安全に行えること。

## 4.3 Generated raster is derivative

runtime用PNG / atlasはbuild artifact。

sourceを変更せずcompiled imageだけ手修正することを禁止する。

---

# 5. Pixel Geometry / Resolution

## 5.1 4px presentation grid is preserved

既存:

- logical width: 150
- logical height: 108
- pixel scale: 4
- physical reference viewport: 600 × 432相当
- existing design reference: 600 × 430

の思想を維持する。

Spriteのbase raster寸法は、4px-gridとの整合を優先する。

初期authoring candidate:

- full-detail reference: およそ 48 × 64 physical pixels
- logical footprint: およそ 12 × 16 fine-grid cells

ただし **48 × 64を絶対規格にはしない**。

長身・投球フォーム・バットの張り出しは透明領域を含む larger canvas を許可する。

重要なのは人物anchorとlogical footprintが安定すること。

## 5.2 No anti-aliasing

- bilinear filtering禁止
- anti-aliased resize禁止
- subpixel blur禁止
- nearest-neighborのみ
- Pixel edgesはinteger aligned

---

# 6. Camera / Projection / LOD

## 6.1 Camera remains the owner of perspective

```text
world position
  ↓
camera projection
  ↓
projected screen anchor + depth + apparent scale
  ↓
Pixel Player scale tier / LOD
  ↓
sprite placement
```

Spriteが画面固定座標を持たない。

## 6.2 Discrete Scale Tier

continuous apparentScaleをそのままbitmapへ掛けない。

候補:

```text
LOD 0: dot / ultra-small identity mark
LOD 1: compact humanoid silhouette
LOD 2: normal Pixel Player
LOD 3: close-view detailed Pixel Player
```

thresholdはcamera/readability testで校正する。

Scale/LOD変更はdepth由来で決定論的に選ぶ。

選手の能力・人気・重要度を理由に大きくしない。

## 6.3 Overhead compatibility

Field / Overhead では全員をfull-detailにして情報密度を破壊しない。

遠距離では既存の「点＋名前」思想へ自然に退化できる。

つまりPixel Player Systemは、遠距離でも無理に顔やフォームを見せるシステムではない。

> **近いと選手、遠いと記号。どちらも同じplayerId / canonical positionを描いている。**

## 6.4 Depth ordering

Sprite draw orderは登録守備位置や固定layer順で決めない。

camera-space depth / ground relationを使って決定論的に並べる。

---

# 7. Direction System

方向はcamera-relative bucketとして扱う。

標準target:

```text
FRONT
FRONT_LEFT
LEFT
BACK_LEFT
BACK
BACK_RIGHT
RIGHT
FRONT_RIGHT
```

ただし初回vertical sliceではcamera coverageに必要なsubsetから作る。

方向選択は:

```text
canonical facing / action orientation
 + camera view vector
 -> direction bucket
```

とする。

## Handedness safety

右打者を左打者へ変えるために画面全体をmirrorしない。

Sprite単体のmirrorも、以下を壊す場合は禁止:

- glove hand
- bat hand
- uniform number / text
- asymmetric equipment
- team logo
- stance semantics

安全なbase-body layerのみmirror可能にし、handedness-sensitive layerは明示variantを持たせる。

---

# 8. Animation Contract

## 8.1 Animation is observer of canonical time

Sprite frameがCore timingを決めない。

```text
canonical motion facts / presentation pose
  ↓
frame selector
  ↓
authored pixel frame
```

55msは標準presentation cadence。

exact event frameは既存ルールどおりcadence間へ挿入可能。

## 8.2 Normal batting

初期の通常打撃は、ユーザーが既に採用した**4コマ表現**を基準とする。

例:

```text
1. stance / load
2. swing start
3. contact region
4. follow-through
```

exact phase namingは既存BatterPresentationState / future canonical swing factsとの接続時に確定する。

重要:

- 見た目は4コマ。
- 正史バットは連続。
- 4コマの間を見た目専用tweenで補間しない。
- contact exact eventではcontact-compatible frameを選ぶ。

## 8.3 Pitching

投球も既採用の4コマ表示を基準とする。

Coreのmotion markersはより細かくてもよい。

複数canonical phaseを4 visual framesへmapする。

既存Pitch Timing planの恒久条件を維持:

- frame 1はQUICK / cadence補正で伸縮させない。
- timing差を吸収するのは主にframes 2–4。
- release時刻はCoreのcanonical release。
- Sprite frameからrelease時刻を逆算しない。

## 8.4 Bunt

既存:

- `bunt_show`
- `bunt_hold`
- `bunt_contact`
- `bunt_pullback`

を維持。

バント専用の物理式を作らない。

Pixel Artだけ専用pose setを持てる。

---

# 9. Invisible Canonical Bat / Visible Pixel Bat

このシステムの重要契約。

```text
Canonical bat
- 3D
- continuous
- collision authority
- invisible

Pixel bat
- authored inside batter sprite
- discrete
- visual only
```

禁止:

- Sprite内のバット先端から接触判定する
- 見た目のバットへCore poseをsnapする
- contactしやすくするためにcanonical batをSpriteへ寄せる

採用:

- visual frameをcanonical stateへ寄せて選ぶ
- exact contact frameでは投影されたcanonical contact pointとの視覚整合を検証する

初期acceptance候補:

- contact frameで、投影canonical contact pointがPixel bat silhouette / contact corridorから1 logical cellを大きく超えて外れない
- threshold exact値はprototypeで校正可能
- thresholdを満たせない場合、物理を変更せずasset/frame mappingを修正する

---

# 10. Identity / Shared Parts / Unique Players

量産は「全員完全手描き」と「全員同一素体」の二択にしない。

```text
shared body family
+ proportions
+ stance
+ hair / head silhouette
+ uniform
+ equipment
+ handedness variants
+ player-specific overrides
```

を基本とする。

候補body families:

- slim
- standard
- athletic
- heavy
- tall

これらはPresentation分類であり能力値ではない。

Star / important Playerは専用overridesを多く持てるが、能力Buffには接続しない。

一般Playerはshared componentsから構成可能。

---

# 11. Runtime Rule: No AI Generation During Match

AIによるPixel Art制作はauthoring / development工程で行う。

runtime中に:

- LLMへ問い合わせる
- image generationを呼ぶ
- player spriteを生成する
- frameを推測生成する

ことは禁止する。

runtimeは事前buildされたdeterministic assetだけを使う。

理由:

- replay determinism
- latency
- cost
- visual identity stability
- offline availability
- testability

---

# 12. Proposed Modules

初期候補:

```text
src/presentation/mini/pixel-player/
  PixelPlayerModel.ts
  PixelPlayerAsset.ts
  PixelPlayerDirection.ts
  PixelPlayerLod.ts
  PixelPlayerFrameSelector.ts
  PixelPlayerProjection.ts
  PixelPlayerValidation.ts
  index.ts
```

assets候補:

```text
assets/pixel-players/
  common/
  fixtures/
  players/
```

このrepoにassets directoryがまだ存在しないため、正確な配置はTask 1で最小prototypeを作った後に固定してよい。

Core packageへPixel Player asset typeを置かない。

---

# 13. Implementation Order

## Task 1 — Asset contract prototype

目的:

AIが直接編集可能で、deterministicにruntime rasterへcompileできる最小source formatを決める。

対象:

- 1人
- 1方向
- idle 1frame
- palette
- foot/root anchor
- body bounds

比較候補:

- JSON pixel rows
- TypeScript structured pixel source
- compact text row-map

選定基準:

1. AIの部分編集が容易
2. Git diffが読める
3. validationしやすい
4. runtimeへdeterministic compileできる
5. 人間がdebugできる

**このTaskで画像生成AIを使わない。**

## Task 2 — Pixel Player model / validation

実装候補:

- `PixelPlayerAssetId`
- `PixelDirectionBucket`
- `PixelPlayerAction`
- `PixelFrameId`
- anchors
- logical bounds
- handedness safety flags
- validation

テスト:

- duplicate frame id rejection
- missing root anchor rejection
- invalid palette index rejection
- semantically unsafe mirror rejection

## Task 3 — Projection / discrete scale / LOD

既存camera projectionを壊さずconsumerとして接続する。

入力:

- projected anchor
- depth
- apparentScale

出力:

- screen cell
- LOD
- discrete scale tier
- depth sort key

テスト:

- same canonical position + same camera -> same pixel placement
- closer player never selects a lower-detail tier than clearly farther equivalent fixture, except explicit threshold equality
- no fractional blur scale
- renderer change does not alter canonical state

## Task 4 — First complete test player

1人だけを以下まで完成させる。

- required camera directions
- normal batting 4 frames
- running minimum
- fielding idle
- team uniform
- R/L required variant

この時点では選手量産しない。

## Task 5 — Canonical bat synchronization

- current `BatterPresentationState.bat` / future canonical swing factsをread
- visual frame metadataへbat anchorsを追加
- exact `BatBallContact` fixtureでvisual alignment test
- physical bat remains invisible

Acceptance:

- physics result invariant with Pixel Player renderer enabled/disabled
- exact contact frame visually overlaps projected contact region
- no Sprite-driven contact correction exists

## Task 6 — Pitching 4-frame observer

canonical pitch motion timelineへ接続する。

- four authored visual frames
- phase-to-frame mapping
- frames 2–4 timing adaptation
- exact release event handling

Core timing filesをPixel Player都合で変更しない。

## Task 7 — Camera coverage matrix

少なくとも:

- Batter POV
- Pitcher POV / catcher-behind-pitcher presentation
- Field / Overhead

について、各cameraで誰がどのLOD / direction / actionを必要とするか表にする。

例:

```text
Batter POV:
  batter = body hidden / hands-bat optional under existing rule
  pitcher = visible Pixel Player
  fielders = distant LOD

Pitcher POV:
  batter = close Pixel Player
  catcher = camera relationに応じてcontrolled representation
  pitcher = camera framing次第

Overhead:
  all players = LOD0/1中心
```

既存Batter POVの「打者本人の全身を原則表示しない」を変更しない。

## Task 8 — Authoring pipeline

AI workerが以下を行えるCLI / deterministic scriptを用意する。

- new player from base profile
- clone safe shared layers
- edit named part
- compile atlas
- validate unchanged layers
- preview fixture export

重要:

「星だけ修正したのに他部品が変わった」型の事故を防ぐため、targeted edit validationを入れる。

## Task 9 — Integration / replay tests

最低限:

- right batter orientation correct
- left batter orientation correct
- world not mirrored
- perspective names/sprites do not obscure strike zone beyond defined fixture
- batter remains inside batter box visually where expected
- same canonical play replays with same selected frame IDs in same build
- render disabled gives identical Match result/events
- contact hard cut still occurs at exact canonical event
- no tween / ease / interpolation introduced

---

# 14. Acceptance Criteria

Pixel Player System v1 は以下を満たした時点で成立。

1. final player art is genuine authored Pixel Art, not pixelated photo output.
2. Match Core remains independent of Pixel Player code.
3. canonical positions are projected by camera before sprite placement.
4. player art uses discrete LOD / scale tiers and nearest-neighbor rendering.
5. standard 55ms cadence remains intact.
6. no visual position tween / CSS transition / ease is introduced.
7. Batter POV / Pitcher POV / Overhead can consume the same canonical world.
8. right/left handedness never mirrors the entire world.
9. first complete Player supports the required camera coverage without low-quality blanket asset generation.
10. batting visual uses a four-frame baseline while physical bat remains continuous and invisible.
11. exact contact frame is visually consistent with canonical BatBallContact without changing physics.
12. pitching visual uses a four-frame baseline and observes canonical pitch timing.
13. distant players may deterministically fall back to simpler LOD rather than unreadable tiny full sprites.
14. source assets are structured and AI-editable.
15. compiled raster is derivative, reproducible, and validated.
16. renderer on/off never changes physics, events, decisions, outs, runs, or Match result.
17. same canonical input + same asset version + same renderer version produces the same selected Pixel frames.
18. runtime does not call an LLM or image generator.

---

# 15. Non-Goals

v1でやらない:

- Match Coreの物理変更
- contact physicsの簡略化
- player abilityからSpriteを直接Buff表示すること
- 何百人もの選手の一括量産
- 写真の自動pixelation pipeline
- runtime AI image generation
- smooth skeletal animation
- 3D character modelへの置換
- free-camera用の全方向・全actionを先に埋めること
- cosmetic理由によるcanonical timing修正
- Pixel Sprite位置をCoreへfeedbackすること

---

# 16. Suggested Commit Sequence

1. `feat: define pixel player asset contracts`
2. `feat: add deterministic pixel asset compiler`
3. `feat: project pixel players with discrete lod tiers`
4. `feat: add first complete pixel player fixture`
5. `feat: sync visible bat frames to canonical contact`
6. `feat: map canonical pitch timing to four-frame pixel form`
7. `feat: cover mini baseball camera modes with pixel player lod`
8. `test: harden pixel player presentation boundaries`

各段階で `npm run verify` を通す。

---

# 17. Final Product Rule

Pixel Player System の存在理由は「写真を作れないAIでも選手を作れるようにする」だけではない。

最終原則は:

> **AIがPlayerを理解し、構造化されたPixel Artを直接制作・修正できること。**

そしてゲーム側では:

> **Physics is continuous. Canonical time is continuous. Camera creates perspective. Pixel Art is discrete.**

この境界を崩さない。
