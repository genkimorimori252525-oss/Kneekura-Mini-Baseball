# v86 メーカー入力確定とエラー表示の修正

2026-10-21。v85を継承したメーカー限定修正。物理Core・通常試合renderer・選手JSON形式は変更していない。

## 原因と修正

| 原因 | 症状 | 修正 |
| --- | --- | --- |
| 投手の個別確定が別欄のpendingを先に拒否 | 高さ/投球時間を両方空欄にすると、正しい値へ戻しても互いを阻み続ける。エラー文も入れ子になる | 個別・球グループの確定はcanonical値を同じ全Core検証へ渡し、他の未確定値を保持。試投/全体保存/全体読込の保護は維持 |
| change前の数値をpendingとして持たない、checkboxのrefreshが無条件 | タブ/モード往復で数値や縫い目ON/OFFが保存値に戻る | input時にraw draftを保持し、checkboxもpendingを尊重して再表示 |
| status再描画までroster-changeを発行、投手はeventでpendingを消す | 別欄のエラーや選手選択で投手の未保存編集が消える | canonical変更/選手選択/明示JSON読込を区別。表示だけのstatusでは通知しない。投手の外部refreshでdraftを消さない |
| 同一JSON読込を実変更なしとして扱う | 古い球種削除のundoが残る | 明示読込は同一内容でもsourceReplaced通知。未確定入力があれば読込を拒否 |
| バット角度を保存済みの値へ戻すと同値return | 保存値は正しいのに未保存表示だけ残る | 選手別にraw draftを保持。同値復帰もdraft解除と表示更新。各欄の取消、全体保存時のpending保護を追加 |
| エラー表示が画面上部へ集中、球の保存エラーを常に球速へ所属 | 原因から離れ、回転のエラーでも球速のエラーに見える | 日本語メッセージを原因欄と操作グループ直下へ配置。fieldIdで入力箇所を特定しaria-invalid/aria-describedbyを接続 |
| 保管庫の取消/版選択でlocal errorを解除しない | 数値が戻っても赤表示だけ残る | 成功保存・取消・版選択で当該保管庫の表示を解除 |
| 次の番号で試投する処理の数値例外が未捕捉 | 再現番号が空欄だとpageerror | 同じ試投エラーハンドラーへ渡し、再現番号の近くで通知 |
| コース設定の独立グループも他のpendingを相互拒否 | 新規シーズンの下書き中にコース設定を確定できない | グループ単位のCore検証と確定。他グループのrawを保持 |

## 共有編集の境界

`baseballMaker.commitLiveRosterEditV86()` はメーカー内部の個別編集用。全選手のcanonical候補を既存validatorへ通し、他フォームの未確定入力を削除せず再表示する。`importLiveRoster()` は全体JSONの明示読込として扱い、pendingを保護し、削除undoを失効させる。Coreの許容範囲や検証を弱める変更ではない。

`kneekura:maker-roster-change` はcanonicalまたは選手選択が変わった場合と明示読込で通知する。選択通知も抑止するとバット画面が旧選手に残るため、選手IDを独立に追跡する。詳細はcanonicalChanged/selectionChanged/sourceReplaced。検証状態だけの再表示は別のvalidation-change通知とする。

`KneekuraMakerValidationV86` は表示専用。入力値・保存値・Coreを変更しない。メッセージが必要な時にDOMを追加し、RAF/interval/新しいMutationObserverは使わない。未確定入力の情報と拒否された値のエラーを色とariaで区別する。

## 変更ファイル

- `docs/demos/baseball-maker-ui-v86.mjs`: 個別確定、通知、公開能力/内部値/得能の近接表示
- `docs/demos/baseball-maker-pitcher-v86.js`: 投手draft・確定・保管庫・試投エラー
- `docs/demos/baseball-maker-swing-v86.js`: 選手別draft・同値復帰・個別取消
- `docs/demos/baseball-maker-course-v86.js`: コース/シーズンの独立確定・近接表示
- `docs/demos/baseball-maker-validation-v86.js/.css`: 共通の近接通知
- `tools/browser-bridge/build-maker.mjs`, `build-maker-release-v86.mjs`: opt-in生成とSource hash

[最終検証・原FAIL・再実行](../verification/releases/v86/README.md)。未知の入力組合せまで無欠陥と保証するものではない。元の未完・CharterHOLD/旧FAILUNKNOWN、縫い目未校正、Native/100試合/実機/v84実FPS未達は保持する。
