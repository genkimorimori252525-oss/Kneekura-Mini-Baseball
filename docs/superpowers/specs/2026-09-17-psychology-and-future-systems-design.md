# Psychology and Future Systems Design

更新日: 2026-09-17
状態: 設計承認済み・実装延期

## Goal

試合Coreの因果性・決定論を壊さず、選手心理、性格、感情マーク、審判/ABS、リプレイ/ハイライト、長期キャリア、ドラフト、大会、音響、オンライン表示などの将来機能を追加できる境界を定義する。

## Canonical Documents

詳細仕様は以下を正とする。

- `docs/game-design/05-psychology-emotion.md`: 心理・性格・感情マーク
- `docs/game-design/06-future-systems.md`: 審判/ABS、PlayCapsule、長期運営、ドラフト、大会、音響、オンライン等

既存の `01-manager-experience.md` や `02-rules-ratings-defense.md` にある「心理状態をUIへ直接表示しない」という一般原則に対して、`ActiveEmotion` の感情マークだけを明示的な例外とする。内部感情値、発火閾値、補正量、推定確率は引き続き非公開とする。

## Core Design Decisions

1. 通常は感情マークなし・感情による能力影響なし。
2. 内部感情が発火閾値を越えて `ActiveEmotion` になった時だけ感情マークを表示し、同じ時点から初めて能力発揮・意思決定へ影響する。
3. 感情マークは演出ではなく監督向けの正しい試合情報である。
4. 表示する感情マークは原則一人一個。内部で複数感情が存在しても、実際の行動への寄与が最大のものを表示する。
5. 試合重要度は手動タグではなく、大会段階、順位、残り試合、優勝/敗退条件、直接対決などから自動算出する。
6. 試合重要度そのものは能力を変えず、感情発火のしやすさだけへ影響する。
7. 感情は独立した大量の能力値にせず、既存能力、経験、少数の性格/精神特性、長期状態、出来事のAppraisalから派生させる。
8. 感情発火後も「総合能力 -10」の一括補正より、判断時刻、積極性、慎重さ、反応、送球開始、リード距離など意味のある中間量へ接続する。
9. リプレイ、ハイライト、音、コメント、写真、タイトル装飾は正史データの観測者であり、試合結果を再計算しない。
10. 審判、コーチ、スカウト、監督、選手の判断では「世界の真実」と「本人が推定しているもの」を分離する。

## Deferred Subsystems

現在のP0〜P9実装ロードマップへ一括投入しない。将来、独立サブプロジェクトとして設計・実装する。

- Psychology / Emotion / Appraisal
- Umpire / ABS / Challenge
- PlayCapsule / HighlightIndex
- ConditionState / CoachEstimate
- CareerMotivation / Relationships
- Incident / Brawl
- Competition / Career / Scouting / Draft
- Audio Renderer
- Online Comment Presentation
- Player Asset / Achievement Presentation

## Non-goals for Current Implementation

- P0共有Coreへ感情ロジックを追加しない。
- 現行P1〜P9の順序を心理機能のために変更しない。
- 感情マーク用のUIや画像を現時点で実装しない。
- ABS、乱闘、ドラフト、大会、移籍欲求等を一括実装しない。
- 発火閾値や補正量の具体的な数値を設計段階で固定しない。

## Future Acceptance Principles

実装する段階では、少なくとも次を証明する。

- マークなしでは感情由来の能力/判断差がゼロである。
- マーク発火時点と能力影響開始時点が一致する。
- 同じ正史入力とシードで感情イベントも再現可能である。
- 高重要度試合でも全員が自動的に感情化せず、冷静な選手差が残る。
- 冷静な選手でも極端な大舞台や強い出来事では発火可能である。
- 監督が感情マークを戦術判断の信頼できる入力として使える。
- リプレイ/ハイライトは現行アルゴリズムで結果を再抽選しない。
- 推定能力の高い人物は真実を変更するのではなく、真実をより正確に推定する。

## Review Result

Placeholder/TODOは残さない。心理の表示例外、能力影響ゲート、自動重要度、将来システムのCore外分離を明示し、既存の正史・決定論・表示分離原則と矛盾しない構成とする。
