"""Freeze the UI-only V80 pitcher menu after browser verification."""
from pathlib import Path
import hashlib,json
sha=lambda b:hashlib.sha256(b).hexdigest()
source=Path('../../outputs/にーくら野球メーカー_v80_球種の方向別メニュー版.html');dest=Path('docs/demos/releases/v80');dest.mkdir(parents=True,exist_ok=True)
data=source.read_bytes();meta_bytes=Path(str(source)+'.build.json').read_bytes();meta=json.loads(meta_bytes);pins_bytes=Path(str(source)+'.bundle-inputs.json').read_bytes();pins=json.loads(pins_bytes)
old=json.loads(Path('docs/demos/releases/v79/maker.html.build.json').read_bytes())
assert meta['pitchMenu'] and sha(data)==meta['sha256'] and meta['coreSha256']==old['coreSha256']==pins['entrySha256']
for path,expected in pins['inputs'].items():assert sha(Path(path).read_bytes())==expected,path
for key,path in [('pitchMenuUiSha256','docs/demos/baseball-maker-pitch-menu-v80.js'),('pitchMenuCssSha256','docs/demos/baseball-maker-pitch-menu-v80.css')]:assert sha(Path(path).read_bytes())==meta[key],path
for key in ['uiSha256','pitcherUiSha256','pitcherCssSha256','courseUiSha256','referenceSha256','liveRosterSha256','embeddedMatchRendererSha256','embeddedPitcherRendererSha256']:assert meta[key]==old[key],key
for path in ['docs/verification/releases/v80/base-side-final/report.json','docs/verification/releases/v80/course-regression/report.json']:
 report=json.loads(Path(path).read_bytes());assert report['pass'] and report['sha256']==meta['sha256'],path
for name,expected in json.loads(Path('docs/demos/releases/v79/SHA256.json').read_bytes()).items():assert sha(Path('docs/demos/releases/v79',name).read_bytes())==expected,name
for name,content in [('maker.html',data),('maker.html.build.json',meta_bytes),('maker.html.bundle-inputs.json',pins_bytes)]:Path(dest,name).write_bytes(content)
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['SHA256.json','README.md']};Path(dest,'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8',newline='\n')
result={'pass':True,'makerSha256':meta['sha256'],'coreUnchanged':True,'inheritedUiAndRenderersUnchanged':True,'sourcePins':len(pins['inputs']),'priorV79FrozenFilesUnchanged':True,'scope':'UI_ONLY_PITCH_MENU_15_TYPES_24_PRESETS','publication':'LOCAL_ONLY'}
Path('docs/verification/releases/v80/release-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(result))
