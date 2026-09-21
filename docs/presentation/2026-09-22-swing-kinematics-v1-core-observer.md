# Swing Kinematics v1 — Core Observer

更新日: 2026-09-22 JST  
状態: **診断用observer。描画デザインの基準は引き続き統合試験版16。**

## 開くもの

`docs/presentation/swing-kinematics-v1-core-observer.html`

このHTMLは新しいPresentationデザインではない。  
`kneekura-mini-baseball-match-v16.html` / 改訂16の描画契約を置き換えない。

目的は、Swing Kinematics v1 が生成した物理バット軌道を、描画へ接続する前に同じデータから二通りに監査すること。

1. Coreが保存した5ms間隔の3D `grip / tip / sweetSpot` を上面・側面で確認する。
2. 同じCoreサンプルを既存 `BatterPovCamera` で投影した座標を、Miniの150×108論理画面・4px表示・55ms cadenceで確認する。

## 重要な境界

HTMLは物理エンジンではない。

- コース別スイングを計算しない。
- contact depthを計算しない。
- attack angle / directionを計算しない。
- バット姿勢を補間しない。
- 55ms間を滑らかに埋めない。
- 打撃結果や接触判定を変更しない。

埋め込まれるcompact fixtureは `createCompactSwingKinematicsObserverFixtureV1()` の出力そのもの。テストでHTML内payloadとCore生成値の完全一致を確認する。

## 改訂16との関係

改訂16の確定事項を維持する。

- Miniは正史世界を観測する4px / 55msの粗い中継。
- 打者・捕手・俯瞰、およびAの光点では連続した観測バットを描ける。
- 投手目線B1だけは連続した物理バットをデータとして保持したまま描画を不可視にし、採用済みバット込み4コマ原画を表示する。
- 絵のバットに当たり判定を付けない。
- 原画から物理軌道を逆算しない。

したがって、この診断HTMLのMini画面はBatter POVの連続観測バットを使う。投手目線B1の4コマ表示そのものを再現するためのHTMLではない。

## fixture

`docs/presentation/fixtures/swing-kinematics-observer-compact-v1.b64`

内容は9つの代表コースについて、

- high-fidelity: 5ms Core samples
- Mini: 55ms cadence + start/contact/endの正確な物理境界
- world `grip / tip / sweetSpot`
- 既存Batter POVで投影済みの `grip / tip / sweetSpot`
- contact depth / attack angle / attack direction / sweet-spot speed / timing metadata

を持つ。

9コースは9種類の決め打ちスイングではない。連続したCourseAwareSwingKinematicsV1から監査用に9点をサンプルしたもの。