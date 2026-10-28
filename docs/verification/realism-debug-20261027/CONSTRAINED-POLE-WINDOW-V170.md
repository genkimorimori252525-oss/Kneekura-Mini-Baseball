# V170 constrained wall-supportの有限window

Task `MB-20261027-REALISM-DEBUG-PLAN` Task5 / 全goal継続。

## 実装

従来、実ground-wall arcへ切り替わった後は、poleが遠方でも現在時刻の `constrained_pole_motion_not_supported_v148` で停止していた。`GroundWallRollingCurveV1.ts`の実closureへqueryを追加し、既存actor/control/ground候補でcapした有限windowに限り、全cell/poleのL∞距離下界が半径和・移動上界・丸め予算より大きい場合だけ進める。

新 `ConstrainedPoleWindowV170.ts` は速度/位置boundとdirected roundingを使い、coverageの穴・近接・接線・非有限値・不明は旧unresolvedへ戻す。位置予算は既存256EPS数値モデルにradius/center/ground移動尺度を加え、off-center相殺を覆う。これは当該Core数値モデルの局所保証で、任意JSの形式保証・実接触応答・Native認証ではない。偽free descriptorや別ball pathは生成しない。rebase時には古いclosureを破棄する。

## 検証

- 最初の実Live反例RED `ca350bac`。最終新helper6/実Live4/既存ground-wall4の14件 `52ef7ffb991b44e99b34108e0209b47b` PASS2.218秒。
- Rootの変更関連回帰: 旧free-pole16件 `cff692458c0f4f81a386aee584d22074` PASS2.062秒。旧Native/V147/DBは再実行していない。
- 同tick内の正window、元arc不変、control/rolling-stop/actor先行、近接/接線/overflow拒否、geometry-aware roundingを確認。独立読取レビューで実反例なし。
- actor fixtureはpoleなしbaselineのglove-ground不整合を観測し、明示synthetic colliderのgloveRadius=.01とbody配置を調整した。通常player/Nativeの身体値とは称さない。旧FAIL `d5f0c34e/59fd3710/1cc1b7e2`、fixture観測 `bf33ff28`、初回REDを保持。
- V170/V172新Source後の全型 `8ee4e8b155dc4a2bb97d8e60ef262fd0` PASS27.358秒。

新Core別build `8bf1f361` PASS: Native214 inputs、entry `d54af3e73c196d7a9a97511ab4bf91b4be37291fc1eed36838920f9666ec60b4`、Workbench191、entry `0b36a10a1d1df9ccf903d4b212ba5a9d967af9ebfee67bdcf788b95f1855da33`。`candidate-constrained-release-*-v170-01`、共有dist/旧候補は変更なし。

## 残件

公開Coreの通常守備練習入口から同windowへ到達し、同Chrome/実Workerで確認する準備が次工程。直接Ownerのsynthetic unitだけで通常選手/Browser受入を完了扱いにしない。実pole接触、held→release、Native moving/custody/legal、公式HR、全SPIN/9回/配送は未完。
