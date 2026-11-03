# GitHub Issues — 自動記録ではなく、確認できる記録

## 前提

- GitHub CLI `gh` を導入し、本人が `gh auth login` を済ませる。`gh auth status` で認証を確認する。トークン自体は出力・保存しない。
- どのリポジトリへ記録するかは**明示的な `owner/repo`** で指定。今のGit remoteを見て勝手に決めない。
- `.claude/feedback/`はGit対象外。Issueの下書きをコミットしない。

## 通常のフロー（推奨）

1. 失敗を見つけたら、再現・期待結果・実際の結果・テスト根拠を区別。
2. `ISSUE_INPUT_EXAMPLE.json`を参考に、実際の情報を `.claude/feedback/issue-input.json` に書く。**テンプレートの例をそのままバグとして送らない。**
3. 次のコマンドでローカルIssue下書きを作成。

```powershell
python scripts/claude_env.py issue draft --from-json .claude/feedback/issue-input.json
```

4. 出力された `bug-xxxxxxxxxxxxxx.md` を人間とClaudeが確認（氏名、メール、住所、APIキー、パス、企業情報、個人情報などに注意）。
5. 該当Issueが本当にGitHubへ投稿すべき製品の問題なのかを判断し、**ユーザーが明示的に許可**した場合のみ:

```powershell
python scripts/claude_env.py issue publish --repo OWNER/REPO --file .claude/feedback/issues/bug-xxxxxxxxxxxxxx.md --confirm USER_APPROVED
```

公開リポジトリなら、その公開が特に承認された場合に限り `--allow-public` を追加する。

**重要:** `--confirm USER_APPROVED` はCLI上の同意フラグで、人間の本人性を認証する仕組みではない。Claudeへの指示に「直前のユーザー承認なしでは使うな」を課す。Claude Codeの標準権限制御も有効にする。

## 事前オプトインで限定した自動登録（private only）

本人が明示して自動運用を許可する場合のみ、`config/claude-env.local.example.json`をコピーして `config/claude-env.local.json` を自分で作り、次の例のように設定する。

```json
{
  "auto_publish_private_issues": true,
  "allowed_private_repositories": ["OWNER/PRIVATE-REPO"]
}
```

その後、`--auto` で指定repoに公開できる。ただし、`verified: true` の下書き、指定済みprivate repo、秘密らしい文字列がない場合だけを許可する。公開repoや再現未確認なら失敗する。**Claudeは本人の明示承認なしに設定を有効にしてはいけない。**

```powershell
python scripts/claude_env.py issue publish --repo OWNER/PRIVATE-REPO --file .claude/feedback/issues/bug-xxxxxxxxxxxxxx.md --auto
```

## 重複と秘密情報

- `gh issue list --state all --search ...`で既存Issueを検索し、タイトルとフィンガープリントを照合。検索上限やタイトルの差異により、完全重複防止ではない。
- `gh repo view ... --json isPrivate`で公開範囲を必ず取得。取得できないときは公開しない。
- 既知のGitHubトークン、APIキー、秘密鍵の形式を検知した場合はローカル下書き/投稿を拒否する。ただし**全種類の秘密を検知できるわけではない**。人間が必ず本文を確認する。
- 外部プラグインのGitHub API直接操作は、このCLIチェックを迂回し得る。承認ポリシーはツールに関係なく適用する。

## GitHubを障害ログ置き場にしない

ツール一度の失敗、ネットワーク一時エラー、テストが書かれていないだけの状態は通常Issue登録しない。繰り返す回帰・再現済み不具合・明確な仕様欠陥に絞る。修正と検証の証拠をリンクし、解決済みなら同じIssueに記録する。

同じタイトルのローカル下書きを再現確認後に修正した場合は、内容を確認して `issue draft --from-json <JSON> --replace-local` を使う。GitHub上の既存Issueは自動更新されない。
