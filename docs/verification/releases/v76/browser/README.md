# v76 ボール描画の実ブラウザ検証

最終 [c01b5bff receipt](../../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_c01b5bff188f4d30a1939d17eab30bf8.json) は PASS（74.265秒）。[browser-check.json](browser-check.json) に3HTMLのSHA、各描画径・RGBA SHA、実6球のSource SHAと設定互換の観測値を保存した。

通常試合・調整室内の通常renderer・メーカー内の通常rendererを、1200幅と390幅で検証した。同じ固定投影・同じ自由球でhelperの関数sourceと描画RGBAが一致した。実UIの空中倍率1/2/8を切り替えても、球中心の高さ0 / 0.0366 / 0.0732 / 0.1098 / 0.3 / 0.5366mでは描画径とRGBAが完全一致した。高い球（中心1.5366 / 2 / 20m）は倍率2/8で旧v75の描画径・RGBAと一致し、倍率1より大きく描画された。

凍結v75では中心0.0732mの球が倍率1で1.25px、倍率2で1.8752226114164858pxとなる旧不具合を再現した。v76は同じ球が倍率1/2/8とも1.25pxである。物理半径やSource座標を変更した検証ではない。

他4視点の球描画、保持中の非表示、俯瞰の全体倍率2の独立性、調整室の停止中描画、設定・sessionの往復、旧JSONで空中倍率省略時の1への復元、無効値の原子的な拒否も確認した。通常実6球はv75とSource全履歴・同時刻のカメラ・背景・バットRGBAが一致した。Core bundleはv75と同じ。ページ例外・外部通信・横はみ出しは0件。9回完走・統計分布・スマートフォン実機はこのcheckerでは再検証していない。

初回 [4c976c8d](../../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_4c976c8d985a4af3aae4e6c4cd74320f.json) はcheckerの変数shadowingによる読込前FAIL。中間 [58e1e779](../../../../ai-continuity/verification-receipts/MB-20261020-V76-BALL-BROWSER_58e1e77935ee4259af80efcdfc436ad2.json) は、停止中の球を再構成するQAが `sourceObservation:true` を落とし、可視点floorの異なる入力を比較したFAIL。いずれも製品変更はせずcheckerだけを修正した。原FAIL report/logを保持し、中間のreport一式は [before-final-help/](before-final-help/) に保全した。最終runはmetadata/help修正後の固定3HTMLを使用し、開始時・終了時のSource pinsとHTML SHAを照合した。
