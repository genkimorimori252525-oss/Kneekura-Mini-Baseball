# プロジェクトのコンテキスト上限調整

2026-10-28 JST。本人指示: 「コンテキスト上限をこのプロジェクトにかなう量に調整」「それから実装を再開」。全goalは継続し、停止/完了/新goalへの変更要求ではない。

現チャットの起動cwdにある `kneekura-mini-baseball-match-v14,描画担当/.codex/config.toml` へ、model_context_window=872000、model_auto_compact_token_limit=750000、scope=totalだけを設定した。このfolderは既存trustedで、trust/権限/モデル/共通設定を変更していない。実装Sourceのcanonical repoへ移動したという意味ではない。

ローカルの現在モデルgpt-6.1-sol catalogはdefault500000/max872000/effective95%。実効828400に対して圧縮まで750000、余裕78400。Desktop bundled catalogのdefault272000とは区別し、現キャッシュと稼働中meter（旧実効475000）を根拠にした。

66c6e19ea5864bd1b50056cc073fee2a PASS4234ms。新しいローカルCodexのconfig/readで3値すべてproject layer由来・disabledReasonなしを確認。strict-config parseもPASS。共通config SHA不変、model request0/thread creation0。詳細はcontext-config-v181-01/report.json。

現在実行中ターンのmeterはまだ旧475000。設定読込の成功をhot reloadの証明にせず、次ターン/再開時のmeterで別途確認する。再起動を要求して実装を止めず、Native接触→測定の既存次工程を継続する。復旧は新規project configのこの3値を取り除くことで元のモデル既定へ戻す。
