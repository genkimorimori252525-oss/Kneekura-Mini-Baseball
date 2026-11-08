import hashlib,json,shutil
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v56');proof=Path('docs/verification/releases/v56')
names={'game.html':'ばせぼーるlv56_TBD_vs_LAD_投球描画と追従調整版.html','camera-workbench.html':'カメラワーク調整室_v56.html'}
pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
core=Path('dist/native-match-core-browser.js').read_bytes()
assert sha(core)==pins['entrySha256']
for p,h in pins['inputs'].items():assert sha(Path(p).read_bytes())==h,p
artifacts={}
for target,name in names.items():
 data=(out/name).read_bytes();meta_bytes=Path(str(out/name)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
 assert sha(data)==meta['sha256'] and meta['presentationVersion']==56
 assert meta['sourceCoreSha256']==sha(core) and meta['sourceInputCount']==113
 assert meta['ordinaryCadenceMs']==55 and meta['pitchBallCadenceMs']==22
 assert meta['ballDisplayDefaults']=={'perspective':1,'overhead':1}
 for helper,h in meta['helpers'].items():assert sha(Path('tools/browser-bridge',helper).read_bytes())==h,helper
 for key,p in [('workbenchDriverSha256','camera-workbench-v56.js'),('workbenchTemplateSha256','camera-workbench-v56.html'),('transformSha256','v56-live-presentation.mjs')]:assert sha(Path('tools/browser-bridge',p).read_bytes())==meta[key],p
 assert sha(Path(meta['basePresentationPath']).read_bytes())==meta['basePresentationSha256']
 artifacts[target]=(data,meta_bytes)
game=artifacts['game.html'][0].decode('utf-8');lab=artifacts['camera-workbench.html'][0].decode('utf-8')
assert core.decode('utf-8') in game
encoded=lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1])==game
for kind in ['display','cadence']:
 report=json.loads((out/f'verification-v56-{kind}'/f'{kind}-check.json').read_bytes())
 assert report['pass'] is True
 assert report['normalSha256']==sha(artifacts['game.html'][0])
 assert report['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
for edition in ['v54','v55','v55.1']:
 for p,h in json.loads(Path(f'docs/demos/releases/{edition}/SHA256.json').read_bytes()).items():assert sha(Path(f'docs/demos/releases/{edition}',p).read_bytes())==h,p
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for p,(data,meta_bytes) in artifacts.items():
 (dest/p).write_bytes(data);(dest/(p+'.build.json')).write_bytes(meta_bytes)
(dest/'game.html.bundle-inputs.json').write_bytes(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['display','cadence']:shutil.copytree(out/f'verification-v56-{kind}',proof/kind,dirs_exist_ok=True)
report={'pass':True,'normalSha256':index['game.html'],'workbenchSha256':index['camera-workbench.html'],'oneExactEmbeddedGame':True,
 'sourceCoreSha256':sha(core),'sourceInputCount':len(pins['inputs']),'pitchBallCadenceMs':22,'ordinaryCadenceMs':55,
 'ballDisplayDefaults':{'perspective':1,'overhead':1},'olderReleasesUnchanged':True,'corePhysicsRulesAiChanged':False,
 'wholeOriginalPlanComplete':False,'newNineInningTest':False}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
