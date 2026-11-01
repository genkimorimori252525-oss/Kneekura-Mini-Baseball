# Native打球分布の出力境界

2026-11-01 JST。本人は全打者の実接触傾向・ラインドライブ分類・表示を、回転の物理制御や技能名札と区別して完成するよう依頼し、依頼範囲内の判断で継続するよう委任した。未収集や未検証を0件や公式認定に置き換えない。

以下のV262–V266の実装・fixtureは現worktreeの作業中sourceであり、この記録のpushだけでsourceを配送したことにはならない。V262単一subjectとV263指定roster batchは同一query-only snapshotで既存owner・鮮度・重複を検査し、V264は人物linkと接触sourceを別々に再認証する。合成Native DBの2接触は照合済みだが、本人DB・全producer・全履歴・画面は未完。新versionの出力を別途作り、既存V191/V229のデータ形式を変えない。

V265の通常JSONは、値が壊れる場合に失敗する部分版。正当な打上角に `-0` があり得るため、これを無効なNative接触と扱ったり全出力対応と称したりしない。次の新versionは既存lossless codecの考え方を参考に、`-0` 等を失わず厳格に往復できる表現・untrusted parserを定義する。JSONを受け取っただけでNativeの真正性を付与しない。未登録／不明／nullの区別、各選手・接触source・対象roster・時点・producer範囲を維持し、回転の物理や技能に戻さない。

本人DBのopen／コピー／ファイル出力CLIはSQLite WAL/SHMの副作用と安定性が未証明のため保留し、合成DBと明示されたread-only snapshotで検証する。旧source・保存・ユーザーデータを保持し、新versionの採用を取り消せば復旧できる。段階別テストと独立reviewを記録し、全Goalや配送は未完のまま維持する。

## 借用DBからの出力とsidecar保護

V270は既存transactionの未commit変更を読み得る点を、入場時にactive／判定不能transactionを拒否することで修正した。ただし任意のoutput pathはSQLiteの未存在 `-wal`／`-shm`／`-journal` と衝突し得る。合成環境のDatabaseSyncではVFSの真正な識別方法を確認できず、path文字列だけで安全と扱わない。V270を本人DB／CLI／UIへ接続しない。

Astra reviewは、次の別versionではDB handleを借用しactive transactionを拒否、V264の同一読取snapshotが正常終了した後にV266の上限・未認証表示を保持した完成UTF-8 bytesを返す方式を推奨した。内部でpath、temp、stdout、DB open／close／writeは行わない。これにより出力先とSQLite sidecarの衝突をこのAPI内から構造的に除く。実保存先は別の所有者／UIが選び、出力先の安全性、WAL／SHM、本人DBやhost bridgeは別途検証する。callerのcommit／rollbackは代行せず、入力・DB保持と失敗を合成fixtureで確認する。
