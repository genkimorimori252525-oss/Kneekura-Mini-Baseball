# 実測バットを打撃判断へ接続する契約

承認済みOpenBiomechanics優先方針の実装。MMDは使用しない。

## 保存と判断

- `measured_bat_axis_repertoire_v1`だけが`sampledProfiles`を持つ。各コースprofileに1件ずつ、原観測点・原時計・左右打席・原接触phase・再生速度・バット寸法とbindingを明示する。
- CoreとNativeモデルownerが同じ追加validatorを使用する。旧レパートリの保存形式・3点軌道は維持する。DB schema/migrationは変更しない。
- 従来コースplannerから使うのは知覚投球に基づく狙い位置・軸方向・予定時刻。速度や3点間の補間で実測軌道を置き換えない。
- impact phaseのバット軸を狙う軸へproper rotationで合わせ、芯を狙い位置へtranslationする。同じ剛体変換を全キーに適用し、拡大縮小・左右鏡映・個別key補正はしない。
- 実投球は計画後の物理判定にだけ入力する。狙いの位置調整は身体到達可能性の証明ではない。
- 原impact時刻をworld clockへ正確に表現できなければ拒否する。反応・身体準備が遅ければ軌道全体が遅れる。速度上限を原キーの全連続補間区間に対して検査する。
- 実測commitmentは`sampledTrajectoryV1`を持ち、旧`trajectory`はnull。二重の実行経路を拒否する。元raw点・binding・impact phaseは計算のaccepted effective repertoireに残る。

## 消費

`createBattingCommitmentSwingWindow`をCore物理forecast、event採用時の再計算、Native SamePA物理owner、終了時のmotor保存に共通使用する。終了時刻とoriginal command/hashも実行した実測軌道に従う。

## 検証できたこと

- 12本の原左右打席・原キー数/時刻・狙い位置、遅延、technical timing、明示再生速度、能力上限、改変/無効parameter拒否。
- 合成投球を知覚して計画した実測スイングの接触・有限exit spin・正規BatBallContact・その時刻でのevent採用。実投球を横へずらした場合は同じcommitmentで空振りする。
- 新規Native初期世界の実Person/身体ownerに実測モデルを保存。旧二球TAKE fixtureなし。作者callbackなしで別接続・別processから再読。全32tablesのschema/行と入力DB bytes不変。
- 関連11files147tests PASS、全`src`型検査PASS。各receiptはEVIDENCE_INDEX参照。初回型検査FAILはtestのreadonly型/名前誤りで、原receiptを保持。

## 未完成と証明の範囲

モデル登録はNativeの打撃commitment実採用ではない。新規世界の最初の投球からworkload/reservation/dispatch/知覚/判断を通す採用は未検証。現行SamePA physical familyのordinal>=3条件を緩めず、初球の正規経路へ接続する必要がある。

身体到達・関節トルク・反動は連成していない。軸回り回転は未計測、キー間は明示した補間モデル。12本の合成接触テストは実選手の安打/ファウル分布ではない。選手本人のSI能力と実リーグ比較母集団も未校正。

通常v31と実測メーカーHTMLは今回変更していない。新規世界での9人の再観測後の判断保持、捕球中の制御更新、手への移し替え/送球/走者/裁定、混合9回・100試合監査・実スマホは未達成。

閉証拠: `outputs/verification-measured-native-model-v1`。別process readerは`tools/verification/native-game/measured-model-readback.ts`。入力SHA付きbundleを`work/native-measured-model-readback-v1`に保全。
