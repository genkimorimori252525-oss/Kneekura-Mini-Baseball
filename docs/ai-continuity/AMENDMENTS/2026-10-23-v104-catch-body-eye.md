# v104 捕球と身体・視点の確認依頼

Task `MB-20261023-V104`。直接依頼：「頭上を越してるのにキャッチ」「体と視界カメラ、頭の位置」「手が届く場所へ選手が移動できるように」「確認して」。添付a290b59b、ambientはv102メーカー。

調査のみ実行。CodeGraphなし、Core reachとcameraを別explorerが読取監査、親がv102/v103実Chromeで3捕球ケースの座標/画像を計測。腰(.9)→描画足元0→目height*.92で二重加算なし。一方Core守備に身長未接続、腰中心全方向球で肩/身体の向きなし。近距離で視線が球を外し、自己グラブ非表示/捕球後球非表示の表示要因もある。3ケースでは実3D接触があり、v102/v103の捕球位置/時刻同一。添付と同一のケース/時刻は未確認で任意情報質問済み。

製品コード/HTML/原JSONは未変更。調査script・report・本記録・変更案だけ追加。計測receipt9aff36c3/0885b3e8は調査実行PASSで修正済みではない。

提案 `docs/design/2026-10-23-v104-catch-body-eye-proposal.md`：身長/身体/目の共通基準、同じ軽量到達域を予測/身体移動/グラブ/接触へ、観測済み捕球動作に基づく首、ログ・回帰・通常3HTML反映。大きい共通契約変更としてチャットAGENTSの範囲確認待ち。未回答を承認とみなさず、v103/旧FAIL/Charter未承認等を保持する。

追記：人間回答「ライトへの深い外野フライで、イチロー」。実名TBD RFニッチロー1-b0の同メニューを1a4c5fbfで再現。eye1.656/glove2.187/ball2.471、reach内1.287m、projectiony15.3px。無理な腕の証拠はなく近距離の首遅れが主要因なので、大きい人体モデル案は必須修正から外し未承認保留。主担当は依頼されたcamera不具合の小さい範囲として、現在相対位置/速度による近距離freeball速度追従だけを実施する。Source/移動/捕球/判定を変更せず、新v1043HTMLへ反映予定。これは人体モデル全改修承認の推定ではない。workerはgaze/helpertests、builderは固定v103gaze差替えのみ、verifierはChromechecker。親は証拠/配置を所有。

最終：19gaze ca456014/build322e45e4/PC1200・390×3と実RF55b146ba/新9files配置99a6689a PASS。旧Y15.30→新115.14、eye/ball/body/glove/facts/rules不変、maxpitchspeed2.7255<=3.2、maxacc18、83interval中1飽和。実SS送球正面維持、Core150/maker118/音声byte同一、元v103/原JSON保存。独立最終review重要指摘なし。詳細docs/verification/releases/v104/README.md。人体/自己glove表示/全選手一般化/旧FAIL/Charter未承認等は別課題として保持し、今回の必須修正残件はなし。
