# v54 — 通常試合の得能と個人の采配

- [通常試合HTML](game.html) / [選手・実測バットメーカー](maker.html)
- [初期20選手JSON](live-game-roster-v3.json) / [内部能力定義](live-game-roster-catalog-v4.json) / [得能の対応表](live-trait-availability-v54.json)
- [変更・根拠・検証・限界](../../../reports/2026-10-19-v54-executable-traits.md)
- [実際の通常9回](../../../verification/releases/v54/game/normal-game-records.json) / [メーカー検証](../../../verification/releases/v54/maker/trait-maker-check.json)
- [テスト・buildしたSourceとcompiled code](tested-core-inputs.zip) / [SHA256一覧](SHA256.json)

両HTMLは単体でオフライン実行できます。メーカーは「選手作成」の得能欄で編集し、「試合用能力JSON」を保存してください。試合側の「選手メーカーの能力を読み込む」で指定し、「新しい試合」で反映します。

## 接続した7系統

| 得能 | 通常試合で働く部分 |
|---|---|
| 悪球打ち | 窮屈なコースで狙ったスイングを保つ内部技術。選球と積極性は独立 |
| 送球 | 同じ方向誤差から赤・中立・青・金の段階を表示し、実送球へ一度だけ反映 |
| 積極打法／慎重打法 | 見積もったコースに対して振る判断のしきい値 |
| 積極走塁 | 進塁を試みる安全余裕。走力を増やさない |
| 積極守備 | 捕球へ向かう候補間の追跡負担。到達速度を増やさない |
| 速球中心／変化球中心 | AUTO配球で使う4球種の選択比率 |
| 強振多用／ミート多用 | 打撃を「選手に任せる」ときの既存スイング選択 |

打撃指示の初期値は「選手に任せる」です。好みがなければ従来のバランスと同じ動作になります。明示した強振・ミート・バランス・待球・バントと球種は、対応する好みより優先します。走塁采配はv53の判断余裕への指示を維持します。

公開10項目・内部44項目を維持。送球の公開値・詳細値・得能段階は一つのSourceを共有し、色から追加の倍率を加えません。緑特は元設定を保持して切り替えるため効果が累積せず、設定なしで元に戻ります。関連する数値を詳細で直接編集した場合は直接値を優先し、その緑特を未査定へ戻します。旧v1/v2/v3 JSONは読込だけで能力を変更しません。

## 未対応表示

正本の候補表114行を、別名を整理して119項目へ対応付けました。実働7、未対応86、試合能力の対象外25、仕様確認待ち1です。未対応112項目は折り畳み一覧から名前・別名で検索でき、理由を表示します。効果のないスイッチは設けず、不正なfamilyを実行用JSONへ追加しても拒否します。119項目すべてがNative Trait Registryへ登録されたという意味ではありません。

## 新規検証

- 41ファイル・368テストPASS、全体TypeScript型検査PASS。
- 現在の113 Native入力・79 maker入力を照合。通常HTMLで320球・9回表3アウトまで完走、例外／旧結果fallbackなし。
- v53走塁の着地前進塁26判断・live終端未帰塁0、130守備プレー／17,169frameの野手重なり0を維持。
- PC1200／390px、7系統22状態のUI・色、緑特20cycleの非累積、送球再投影、20人・公開10・内部44、JSON保存／再読込／試合importがPASS。
- メーカーで保存したPOWER／BREAKINGと実際のpower動作・配球選択への到達、悪球打ちOFF／ONの実行値を両幅で検証。pageerror／外部通信0。
- v52カメラhelperは同一bytes。v49/v52の表示へ現在のCoreを埋め、同じAUTO命令に揃えて12実球のCore／bat、左右、他視点、停止／再生を比較。

Game SHA256: `80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f`

Maker SHA256: `f1443bb1c7699ce88249fd4f6f293ec6cd2fd705767b9e1ff04db24e0c62bbd9`

Native Core SHA256: `4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279`

## 再生成と限界

```powershell
node tools/browser-bridge/check-v54-ai.mjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tools/browser-bridge/build-v54-artifacts.mjs
node tools/browser-bridge/check-v54-release.mjs
```

送球の段階・積極性の差・配球比率はローカル作成用の暫定尺度です。実測査定やNative習得履歴の認証ではありません。試合成績の現実分布への校正も未完です。今回の人間回答に従い、独立した元機能がない故障・回復・心理・育成・盗塁等を新設せず、未対応としました。元の全計画はIN_PROGRESSで、Native認証連続world・残り公式H/Eやルール・lead/slide・身体・新100試合・実機等は残っています。390pxはブラウザ検証です。原FAIL/UNKNOWN・外部Charter承認HOLDを保持し、既存branch/Draft380へ保存、mainへはマージしません。
