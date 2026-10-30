from pathlib import Path

root=Path('tools/browser-bridge')
s=(root/'camera-workbench-v63.js').read_bytes().decode('utf-8')
assert s.count('settings.v63')==1
s=s.replace('settings.v63','settings.v64')
needle="for(const key of ['perspective','overhead'])"
assert s.count(needle)==2
s=s.replace(needle,"for(const key of ['perspective','overhead','overheadHeightEmphasis'])")
(root/'camera-workbench-v64.js').write_bytes(s.encode('utf-8'))
h=(root/'camera-workbench-v63.html').read_bytes().decode('utf-8').replace('v63','v64').replace('__V63','__V64')
needle='<button id="lab-ball-scale-reset">球倍率を1に戻す</button>'
assert h.count(needle)==1
h=h.replace(needle,'<label>俯瞰：高さによる拡大<input id="lab-ball-scale-overheadHeightEmphasis" type="number" min="1" max="8" step="0.1" value="1"></label><button id="lab-ball-scale-reset">球の表示を初期値へ</button><small>初期値1で従来表示。地面の大きさを保ち、20m以上の高い球が指定倍率になります。1.5を試せます。</small>')
h=h.replace('live-camera-tuning-batter-view-v64.js','live-camera-tuning-batter-view-v63.js')
(root/'camera-workbench-v64.html').write_bytes(h.encode('utf-8'))
print('v64 ball display control prepared; camera tuning remains v63')
