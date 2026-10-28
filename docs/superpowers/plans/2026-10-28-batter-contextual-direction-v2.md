# 打撃方向の主体的選択と途中修正 — 統合計画 v2

> 2026-10-28 JST  
> 状態: **USER-APPROVED DESIGN / IMPLEMENTATION PLAN / NOT IMPLEMENTED AS A WHOLE**  
> 形式: 既存 BAT・DIR・SWG の判断→運動接続に対する補強計画。独立Match Core、新打撃エンジン、新Traitを作らない。  
> 設計基点: jolly/core-foundation-plan-2026-09-17。実装調査入口: Draft PR #380、2026-10-28時点のV160/V161記録。GitHubだけでは未公開ローカル作業を確認できない。  
> 本書の承認はコード変更/無断mergeを意味しない。実装前に現行branch/worktree、Owner、既存証拠を再監査する。

## 0. 絶対的な設計判断

**打者は投球を予測・観測して自分の意思で方向と打ち方を選ぶ。ただし実打球方向・強さ・成否は、残り時間と身体能力に制約された実スイングおよび実バット・ボール接触からのみ生まれる。**

- 内角流し・外角引っ張りは明示的に合法。内角=引っ張り/外角=流しの自動規則や固定ペナルティを作らない。
- 方向の好み80%は、毎球80%で方向を抽選するという意味ではない。本人が方向を狙う際の長期的な傾向であり、主観的コース/球種/速度、カウント、守備、指示、身体の余裕から一球ごとに条件付きで選ぶ。
- PULL/CENTER/OPPOSITEは目標意思、REACTIVEは方向固定なしの主体的対応。REACTIVEをCENTERや方向のランダム抽選へ置換しない。exact 0の通常意図頻度は維持するが、結果の逆方向打球を禁止しない。
- 強振/ミート、積極/慎重、方向選択、振る/見送る、実際のバット速度、身体能力・技能は別軸。高パワーだから全力、高ミートだから低速という固定式は認めない。
- 意図変更はスイング開始前と開始後の両方で可能。ただし時刻・観測・身体可動域・速度・加減速・バット慣性に従い、遅れた修正は中途半端な接触や空振りとなり得る。
- 変更成功フラグや打球方向乱数からヒットを作らない。実バット面/軌道/時刻/速度×実球道→衝突→飛翔→守備/ルールへ接続する。
- 3方向は意思表示、旧メーカーの5方向は設定/観測統計、物理角は連続値。右打者/左打者ではPULLとOPPOSITEの世界方位が反転する。
- プルヒッター/流し打ち/広角打法は真の技能Sourceの投影であって、好みの割合や結果方向への魔法Buffではない。
- 打者はPrivate Belief、捕手・投手・守備は観測できた情報だけを使う。監督指示はManager 49のSoft/Hard受理を通し、長期好みは書き換えない。
- シード付き再現性、連続打席・保存、元のPNG/描画FPSから独立した唯一の正史Core、既存Native剛体接触、コース63/公開9/方向5の互換を維持する。

## 1. 各章の担当と参照

- **[原則・状態契約](2026-10-28-batter-contextual-direction-v2-principles.md)** — 今回の決定全件、個人の好みと方向意思、内外角、乱数/REACTIVE/技術と結果の分離。
- **[実装順序・互換・リスク](2026-10-28-batter-contextual-direction-v2-implementation.md)** — 一球の時系列、途中修正、現SourceへのOwner統合、メーカー・監督・守備・保存、段階ゲート。
- **[新規DCA受入・敵対監査](2026-10-28-batter-contextual-direction-v2-acceptance.md)** — 組合せ/手動指示/コース/途中修正/接触/右左/再現性を検証する追加40ゲート。
- [BAT計画](2026-10-16-batter-anticipation-intent-adaptive-swing.md): 打者Beliefと意思・時刻の唯一のOwner。
- [DIR計画](2026-10-16-batter-directional-intent-and-spray.md): 方向Intentと実Sprayを分離し、REACTIVEを区別。
- [SWG計画](2026-10-26-batter-swing-capacity-intent-context.md): 身体の実行上限と連続的な努力量・モーション。
- [Manager 49](../../game-design/49-manager-architecture-v1.md)、[Trait 09](../../game-design/09-player-trait-catalog.md)、[Causal Contact](../specs/2026-09-17-causal-contact-and-individual-defense-design.md)を維持。

**権限:** 本書はBAT/DIR/SWGを置き換えず、後日明示されたユーザー承認をその共通Motorへ具体化する。既存の同義型/Controller/RNGを二重新設しない。完了認定は実装・Native/Browser・試合・保存・性能の証拠があるものだけ。