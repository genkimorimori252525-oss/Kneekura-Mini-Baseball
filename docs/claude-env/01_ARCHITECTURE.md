# Architecture — 使いすぎないClaude Code環境

## 目標

1. Opus 5.5の強みを残し、委任が有効な仕事だけ別モデルへ渡す。
2. 開発成果をテスト・静的レビュー・ユーザーフィードバックで検証する。
3. 事故の再発を防ぐため、修正可能な小さな規則と反証可能な記録を蓄積する。
4. 既存の開発体制やプロジェクトの指示を破壊せず共存する。

## 層構成

```text
User + existing repository policies
          |
       CLAUDE.md  <- AGENTS.md (既存を尊重)
          |
Opus 5.5 main coordinator / direct implementer
  |        |         |
  |        |         +-- Opus reviewer (read-only, evidence)
  |        +------------ Sonnet implementer (only bounded work)
  +--------------------- Haiku scout / Opus difficult specialist (optional)
          |
 Tests + local feedback + observed errors
          |
 Root cause / retrospective / proposed policy or test change
          |
 Human approval -> minimal config improvement
          |
 Optional approved GitHub issue draft -> dedup -> publication
```

## 運用のポイント

- `CLAUDE.md` は短い常駐指示に限定。手順はオンデマンドSkillsへ。
- `AGENTS.md` を既存の共通指示として読み込む。既存の内容を勝手に置換しない。
- `agents/`には「必要な能力」の定義だけ置く。役職を増やして大きな仮想会社を作らない。
- 書込みエージェントは原則同時1つ。並列化するなら、本当に独立したファイル領域・worktree・統合責任者が必要。
- 独立レビューは実行テストを代替しない。テスト結果がない場合は「未検証」。
- Skills/Rules/Hooks/MCPを増やす際は、測定できる失敗や不便を解消するものだけ増やす。
- Hooksには生ログや秘匿情報を残さない。ログ出力はGitに含めない。

## 選択しなかった構成

- 毎回必ず3〜5名のサブエージェントを起動する方式。
- 全員をMax/xhigh effortに固定する方式。
- 開始時に大量の外部MCPを読み込む方式。
- 計測なしで「トークンが○％節約」と主張する方式。
- 自己改善を口実に、無許可でCLAUDE.mdやSecurity Rulesを変更する方式。
- CCGを置き換える新しい独自統括システムを立ち上げる方式。

## 境界

スクリプトの自動ログは`Stop`とツール失敗だけ。ユーザーの好みは本人の発言があったときに手動記録する。GitHub Issueは別プロセス。下書きは公開ではない。管理対象のGitHubリポジトリが決まっていない場合にもローカル部分は稼働する。
