import hashlib,json,shutil
from pathlib import Path
sha=lambda data:hashlib.sha256(data).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v55.1');proof=Path('docs/verification/releases/v55.1')
lab=out/'カメラワーク調整室_v55_1.html';data=lab.read_bytes();meta_bytes=Path(str(lab)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
assert sha(data)==meta['sha256'] and meta['workbenchRevision']==1
assert data==(out/'カメラワーク調整室_v55.html').read_bytes()
assert sha((out/'ばせぼーるlv55_TBD_vs_LAD_打球追尾調整版.html').read_bytes())=='02644793d8c6e41b66d5330fe37cc0ce8d2fa7756ad6bc139b045fbef38d3b17'
assert meta['workbenchDriverSha256']==sha(Path('tools/browser-bridge/camera-workbench-v55.js').read_bytes())
assert meta['workbenchTemplateSha256']==sha(Path('tools/browser-bridge/camera-workbench-v55.html').read_bytes())
pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
assert meta['sourceCoreSha256']==pins['entrySha256']==sha(Path('dist/native-match-core-browser.js').read_bytes())
for path,digest in pins['inputs'].items():assert sha(Path(path).read_bytes())==digest,path
for path,digest in json.loads(Path('docs/demos/releases/v55/SHA256.json').read_bytes()).items():assert sha(Path('docs/demos/releases/v55',path).read_bytes())==digest,path
red=json.loads((out/'verification-v55-layers-red/layers-check.json').read_text(encoding='utf-8'));green=json.loads((out/'verification-v55-layers-green/layers-check.json').read_text(encoding='utf-8'))
assert red['pass'] is False and red['sha256']=='ad40f7832a1621b09cd5efa3804d6cbfa6ef2534c73242ec6e6a9e0a41e05016'
assert green['pass'] is True and green['sha256']==sha(data)
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for name,content in [('camera-workbench.html',data),('camera-workbench.html.build.json',meta_bytes)]:
 with (dest/name).open('xb') as f:f.write(content)
index={name:sha((dest/name).read_bytes()) for name in ['camera-workbench.html','camera-workbench.html.build.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['red','green']:shutil.copytree(out/('verification-v55-layers-'+kind),proof/kind)
initial=out/'verification-v55-layers-green-initial-run1'
if initial.exists():shutil.copytree(initial,proof/'green-initial-run1')
report={'pass':True,'workbenchSha256':sha(data),'normalHtmlUnchanged':True,'oldV55ReleaseUnchanged':True,'coreSourceInputs':len(pins['inputs']),'sourceCoreSha256':pins['entrySha256'],'sameSchemaAndCamera':True}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
