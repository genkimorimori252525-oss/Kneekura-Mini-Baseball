import hashlib,json,shutil
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v58');proof=Path('docs/verification/releases/v58')
names={'game.html':'ばせぼーるlv58_TBD_vs_LAD_投手追尾待機短縮版.html','camera-workbench.html':'カメラワーク調整室_v58.html'}
pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
core=Path('dist/native-match-core-browser.js').read_bytes()
assert sha(core)==pins['entrySha256']
for p,h in pins['inputs'].items():assert sha(Path(p).read_bytes())==h,p
artifacts={}
for target,name in names.items():
 data=(out/name).read_bytes();meta_bytes=Path(str(out/name)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
 assert sha(data)==meta['sha256'] and meta['presentationVersion']==58
 assert meta['sourceCoreSha256']==sha(core) and meta['sourceInputCount']==113
 assert meta['ordinaryCadenceMs']==55 and meta['pitchBallCadenceMs']==22
 assert meta['ballDisplayDefaults']=={'perspective':1,'overhead':1}
 assert meta['preset']=={'enabled':True,'aimLiftMeters':.30,'swingMaxDownRadians':.20,'hitFollowDelayMs':300,'aimReleaseMs':70,'pitchTrackingGain':.26,'pitchTrackingDeadbandRadians':.02}
 for helper,h in meta['helpers'].items():assert sha(Path('tools/browser-bridge',helper).read_bytes())==h,helper
 for key,p in [('workbenchDriverSha256','camera-workbench-v57.js'),('workbenchTemplateSha256','camera-workbench-v57.html'),('builderSha256','build-v58.mjs')]:assert sha(Path('tools/browser-bridge',p).read_bytes())==meta[key],p
 assert sha(Path(meta['basePresentationPath']).read_bytes())==meta['basePresentationSha256']
 artifacts[target]=(data,meta_bytes)
game=artifacts['game.html'][0].decode('utf-8');lab=artifacts['camera-workbench.html'][0].decode('utf-8')
assert core.decode('utf-8') in game
restored=game.replace(Path('tools/browser-bridge/live-pitcher-reaction-view-v58.js').read_bytes().decode('utf-8'),Path('tools/browser-bridge/live-pitcher-reaction-view.js').read_bytes().decode('utf-8'))
for a,b in [('presentationVersion:58','presentationVersion:57'),('version:58,authority:','version:57,authority:'),('投手追尾待機短縮版 58</title>','スイング時の頭固定版 57</title>'),('投手追尾待機短縮版 58','スイング時の頭固定版 57')]:
 assert restored.count(a)==1;restored=restored.replace(a,b)
assert restored==Path('docs/demos/releases/v57/game.html').read_bytes().decode('utf-8'), 'no unrelated match changes'
encoded=lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1])==game
for kind in ['pitcher']:
 report=json.loads((out/f'verification-v58-{kind}'/f'{kind}-check.json').read_bytes())
 assert report['pass'] is True
 assert report['normalSha256']==sha(artifacts['game.html'][0])
 assert report['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
for edition in ['v54','v55','v55.1','v56','v57']:
 for p,h in json.loads(Path(f'docs/demos/releases/{edition}/SHA256.json').read_bytes()).items():assert sha(Path(f'docs/demos/releases/{edition}',p).read_bytes())==h,p
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for p,(data,meta_bytes) in artifacts.items():
 (dest/p).write_bytes(data);(dest/(p+'.build.json')).write_bytes(meta_bytes)
(dest/'game.html.bundle-inputs.json').write_bytes(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['pitcher']:shutil.copytree(out/f'verification-v58-{kind}',proof/kind,dirs_exist_ok=True)
report={'pass':True,'normalSha256':index['game.html'],'workbenchSha256':index['camera-workbench.html'],'oneExactEmbeddedGame':True,
 'sourceCoreSha256':sha(core),'sourceInputCount':len(pins['inputs']),'pitchBallCadenceMs':22,'ordinaryCadenceMs':55,
 'ballDisplayDefaults':{'perspective':1,'overhead':1},'olderReleasesUnchanged':True,'corePhysicsRulesAiChanged':False,
 'wholeOriginalPlanComplete':False,'newNineInningTest':False,'headLockAtMeasuredMotorOnset':True,'preset':meta['preset'],'pitcherReaction':meta['pitcherReaction']}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
