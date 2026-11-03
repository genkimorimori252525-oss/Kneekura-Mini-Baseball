from pathlib import Path

root=Path('tools/browser-bridge')
s=(root/'camera-workbench-v61.js').read_bytes().decode('utf-8')
def once(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
once('settings.v61','settings.v62')
once("['schema','sourceGameSha256','settings','ballDisplay','nameDisplay']","['schema','sourceGameSha256','settings','ballDisplay','nameDisplay','pitcherBodyHead']")
once("nameDisplay:win.KneekuraNameDisplayControls.normalizeSettings(value.nameDisplay??{})","nameDisplay:win.KneekuraNameDisplayControls.normalizeSettings(value.nameDisplay??{}),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.normalizeSettings(value.pitcherBodyHead??{})")
s=s.replace('nameDisplay:win.KneekuraNameDisplayControls.inspect()', 'nameDisplay:win.KneekuraNameDisplayControls.inspect(),pitcherBodyHead:win.KneekuraPitcherBodyHeadView.inspectSettings()')
once('applyNameDisplay(next.nameDisplay);','applyNameDisplay(next.nameDisplay);applyPitcherBodyHead(next.pitcherBodyHead);')
once(' function applyNameDisplay(settings)', ''' function applyPitcherBodyHead(settings){playback.setPitcherBodyHead(settings);$('lab-pitcher-head-enabled').checked=settings.enabled;$('lab-pitcher-head-scale').value=settings.scale;persist();}
 function setPitcherBodyHead(patch){guard();const next=win.KneekuraPitcherBodyHeadView.normalizeSettings({...win.KneekuraPitcherBodyHeadView.inspectSettings(),...patch});
  pause();applyPitcherBodyHead(next);renderPair(currentMs);return inspect();}
 function applyNameDisplay(settings)''')
once("projection:s.rendered.cameraProjection,freePitch:","pitcherBodyHeadView:s.presentation.pitcherBodyHeadView,defensiveOpportunity:s.currentFrame.defensiveOpportunity,projection:s.rendered.cameraProjection,freePitch:")
once("['schema','sourceGameSha256','sourceCoreSha256','settings','ballDisplay','nameDisplay','scenario','position','playback']","['schema','sourceGameSha256','sourceCoreSha256','settings','ballDisplay','nameDisplay','pitcherBodyHead','scenario','position','playback']")
once("再現sessionのschema／Coreが一致しません","再現sessionのschema／Coreが一致しません。v62は投球物理と守備AIが変わったため、旧版の同一試合としては再現できません")
once('pair=normalizePair(packet.settings);','pair=normalizePair(packet.settings),pitcherBodyHead=win.KneekuraPitcherBodyHeadView.normalizeSettings(packet.pitcherBodyHead??{});')
once('applyPair(pair);applyBallDisplay(ballDisplay);applyNameDisplay(nameDisplay);','applyPair(pair);applyBallDisplay(ballDisplay);applyNameDisplay(nameDisplay);applyPitcherBodyHead(pitcherBodyHead);')
once('applyNameDisplay(restoredPacket.nameDisplay);','applyNameDisplay(restoredPacket.nameDisplay);applyPitcherBodyHead(restoredPacket.pitcherBodyHead);')
once('measure,setBallDisplay,setNameDisplay,','measure,setBallDisplay,setNameDisplay,setPitcherBodyHead,')
once("  $('load-session').onchange=", "  $('lab-pitcher-head-enabled').onchange=()=>run(()=>setPitcherBodyHead({enabled:$('lab-pitcher-head-enabled').checked}));\n  $('lab-pitcher-head-scale').onchange=()=>run(()=>setPitcherBodyHead({scale:Number($('lab-pitcher-head-scale').value)}));\n  $('load-session').onchange=")
(root/'camera-workbench-v62.js').write_bytes(s.encode('utf-8'))
h=(root/'camera-workbench-v61.html').read_bytes().decode('utf-8').replace('v61','v62').replace('__V61','__V62')
marker='  <div class="row"><label>通常視点の球倍率'
assert h.count(marker)==1
h=h.replace(marker,'''  <div class="row"><label><span><input id="lab-pitcher-head-enabled" type="checkbox" checked>投手の身体・頭に伴うカメラ移動</span></label><label>動きの倍率<input id="lab-pitcher-head-scale" type="number" min="0" max="2" step="0.05" value="1"></label><small>マウンド上の投手の目から、既存投球動作に同期。実測骨格ではなく調整可能な仮モデルです。</small></div>
  <div class="row"><label>通常視点の球倍率''')
h=h.replace('調整JSONはA/Bのカメラ設定と球の表示倍率。','調整JSONはA/Bのカメラ設定、球・名前の表示倍率、投手の身体移動。')
h=h.replace('同じCoreで試合を再生成します。','同じCoreで試合を再生成します。v62は投球物理・守備AIが変わったため旧版の再現セッションは読み込みません。調整JSONは読み込めます。')
h=h.replace('live-camera-tuning-batter-view-v62.js','live-camera-tuning-batter-view-v61.js')
(root/'camera-workbench-v62.html').write_bytes(h.encode('utf-8'))
print('v62 workbench generated from unchanged v61 batter controls')
