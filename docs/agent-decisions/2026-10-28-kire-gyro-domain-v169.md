# V169実行前固定: 未調査の軸方向で3段階profileを調べる

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V168の実release接続と同Chrome48record受入後の次工程。V167の保存56条件/新定義候補0は保持し、同じcaseを再計算しない。

## 仮説と有界入力

追加56条件はgyro30度固定だった。回転軸はMagnusと材料姿勢の寄与を変える実release入力であり、別の軸方向における早期の相殺/終盤集中をまだこの低spin範囲で観測していない。係数や力の開始timerを変更せず、次の24条件だけを追加する。

- 既存の公開curve4/seed3、共通release P/V・Tref・重力基準。spinScale `[.04,.08]` × gyro `[0,60,85]`度 × materialPhase `[0,90,180,270]`度、24件。
- 新caseは旧V158の対応gyro/phase・spinScale .1の実descriptorを基に、spinノルムだけ.4/.8倍へ変える。同じ軸のworld-left位相合成を保持する。profileはV162通常5000tickと同じもの、refinement時は2500tick。速度/位置/球の物性/空力係数/seedは変更しない。
- 新しい同一条件の全体探索やphase細分は行わない。0候補でも結果として保存し、このprotocolから自動で範囲を広げない。

## 再利用と判定

保存56件は、親receipt/入力/record SHA、同一基準、実sampler/物理依存Sourceの一致を確認したものだけ再利用する。V168によるOwner変更を旧Source同一と偽らない。旧/新binaryの省略入力161Source厳密一致7bcb8edbと、差がLivePitchV1/追加helperだけで計測に用いるSource kernel/空力/姿勢/観測関数は不変であることを別記する。差をこの範囲へ限定できなければ再利用せずUNKNOWNとして扱う。

新24件はMain/実Worker/JSON全record同値。旧56＋新24の80件をV167の同じgateで評価する。分類・両基底の近量/方向、p10増加・p90-p10短縮・late20増加、旧隣接時間差screenを維持。p50/p90順位は要求しない。基準との比較は副作用観測であり、全段階が未指定より必ず改善するという未指示の条件は追加しない。

候補がある場合だけID和集合のdense640/半stepを確認する。既に同一入力のrefinement記録がある場合は再利用する。候補なしならrefinementも通常authoringも起動しない。3段階のSource入力が成立するまで技能認定/UI完成へ進めない。

## 所有・検証・復旧

新 `pitch-break-kire-gyro-domain-v169.ts` とtestはkire_levels_impl、新Chrome runner/outputはRoot。旧helper/Source/旧study/本人JSON/共有distは変更しない。factoryの空間/位相・PV・物性不変、24一意・旧56と非重複、step5000/2500を限定test。新しい実験前に親pin/現Core manifestを確認。すべて新folderへ保存し、旧FAILを保持する。基礎データの書換えはなく、新研究ファイル/出力を採用しなければ復旧できる。
