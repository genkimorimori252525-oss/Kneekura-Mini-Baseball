from pathlib import Path

root=Path('tools/browser-bridge')
s=(root/'camera-workbench-v62.js').read_bytes().decode('utf-8')
def once(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
once('settings.v62','settings.v63')
once('pitchTrackingDeadbandRadians:Object.hasOwn(s,\'pitchTrackingDeadbandRadians\')?validated.pitchTrackingDeadbandRadians:0',
 "pitchTrackingDeadbandRadians:Object.hasOwn(s,'pitchTrackingDeadbandRadians')?validated.pitchTrackingDeadbandRadians:0,swingUsesAbsoluteVision:Object.hasOwn(s,'swingUsesAbsoluteVision')?validated.swingUsesAbsoluteVision:true,swingHeadCoupling:Object.hasOwn(s,'swingHeadCoupling')?validated.swingHeadCoupling:0")
once("['pitchTrackingGain','投球の追従率（選球眼45の基準）'","['swingHeadCoupling','バットに伴う頭の動き（0で連動なし）','×',0,.08,.001],\n   ['pitchTrackingGain','基準の投球追従率'")
once("追わずに許す範囲（選球眼45の基準）","基準の追わずに許す範囲")
once("const grid=document.createElement('div');grid.className='controls';", "const visionLabel=document.createElement('label'),visionToggle=document.createElement('input');visionToggle.type='checkbox';visionToggle.id='swingUsesAbsoluteVision-'+side;\n  visionToggle.onchange=()=>run(()=>setSettings(side,{swingUsesAbsoluteVision:visionToggle.checked}));visionLabel.append(visionToggle,' スイング前の追従にも選球眼を反映（OFFでv59基準）');box.append(visionLabel);\n  const grid=document.createElement('div');grid.className='controls';")
once("$('enabled-'+side).checked=settings.enabled;", "$('enabled-'+side).checked=settings.enabled;$('swingUsesAbsoluteVision-'+side).checked=settings.swingUsesAbsoluteVision;$('swingUsesAbsoluteVision-'+side).disabled=!settings.enabled;")
once("settings.enabled?'調整設定':'従来設定'", "settings.enabled?(!settings.swingUsesAbsoluteVision&&settings.swingHeadCoupling===0?'v59スイング基準':'調整設定'):'従来設定'")
once("setSettings('A',{...factory.defaults,enabled:false,pitchTrackingGain:1,pitchTrackingDeadbandRadians:0})", "setSettings('A',{...factory.defaults,swingUsesAbsoluteVision:false,swingHeadCoupling:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18})")
once("A:factory.create({enabled:false,pitchTrackingGain:1,pitchTrackingDeadbandRadians:0})", "A:factory.create({swingUsesAbsoluteVision:false,swingHeadCoupling:0,impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18})")
once('Aは従来設定、Bは改善初期値です。','Aはv59スイング基準、Bは身体連動を加えた初期値です。')
(root/'camera-workbench-v63.js').write_bytes(s.encode('utf-8'))
h=(root/'camera-workbench-v62.html').read_bytes().decode('utf-8').replace('v62','v63').replace('__V62','__V63')
h=h.replace('初期値はv59と同じです。','スイング前の視線はv59を基準にし、身体連動を加えています。')
h=h.replace('投球追従の設定値は絶対選球眼45の基準です。実際の選手に応じて追従率は最大0.70、許容角は最小0.00へ変わり、下の映像に実効値を表示します。選球眼はリーグ比較で変わりません。',
 '初期値では、振る球の視線はv59基準です。チェックでスイング前にも選球眼を反映できます。見逃す判断の後は選球眼45が基準で、最大0.70／許容角0.00まで変わります。下の映像に実効値を表示します。')
h=h.replace('予定インパクト付近で視線を安定させ、完全停止せず身体と打点に沿う小さな動きを許します。','予定インパクト付近では、実際のバットの回転に沿って頭もわずかに動きます。バットそのものを注視せず、打点を見ながら小さな身体連動を許します。')
h=h.replace('安定中の目標と向きの変化は最大約1.4°、角速度は最大約10°/秒に抑え、ランダムな揺れは加えません。','初期値の許容角は約2.3°、最大角速度は約20°/秒です。「バットに伴う頭の動き」で強さを変え、0で連動を止めます。ランダムな揺れは加えません。身体連動は実測バットを入力とする仮の表示モデルです。')
h=h.replace('live-camera-tuning-batter-view-v61.js','live-camera-tuning-batter-view-v63.js')
h=h.replace('Aを従来設定へ','Aをv59スイング基準へ').replace('A <span id="label-A">従来設定','A <span id="label-A">v59スイング基準')
h=h.replace('v63は投球物理・守備AIが変わったため旧版の再現セッションは読み込みません。調整JSONは読み込めます。','v62とv63は同じCoreなので再現セッションを読めます。以前の調整JSONは以前の視線設定へ補完して読み込み、「Bを改善初期値へ」で新しい初期値に戻せます。')
(root/'camera-workbench-v63.html').write_bytes(h.encode('utf-8'))
print('v63 workbench prepared; old JSON retains previous optional behaviour')
