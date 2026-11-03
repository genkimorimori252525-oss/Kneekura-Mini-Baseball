import hashlib,json,shutil
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v60');proof=Path('docs/verification/releases/v60')
names={'game.html':'ばせぼーるlv60_TBD_vs_LAD_視線と名前調整版.html','camera-workbench.html':'カメラワーク調整室_v60.html'}
pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
core=Path('dist/native-match-core-browser.js').read_bytes()
assert sha(core)==pins['entrySha256']
for p,h in pins['inputs'].items():assert sha(Path(p).read_bytes())==h,p
artifacts={}
for target,name in names.items():
 data=(out/name).read_bytes();meta_bytes=Path(str(out/name)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
 assert sha(data)==meta['sha256'] and meta['presentationVersion']==60
 assert meta['sourceCoreSha256']==sha(core) and meta['sourceInputCount']==113
 assert meta['ordinaryCadenceMs']==55 and meta['pitchBallCadenceMs']==22
 assert meta['ballDisplayDefaults']=={'perspective':1,'overhead':1}
 assert meta['nameDisplayDefaults']=={'scale':1}
 assert meta['preset']=={'enabled':True,'aimLiftMeters':.30,'swingMaxDownRadians':.20,'hitFollowDelayMs':300,'aimReleaseMs':70,'pitchTrackingGain':.26,'pitchTrackingDeadbandRadians':.02,'impactStabilizeOffsetMs':0,'impactMaxMotionRadians':.025,'impactMaxSpeedRadPerSecond':.18}
 for helper,h in meta['helpers'].items():assert sha(Path('tools/browser-bridge',helper).read_bytes())==h,helper
 for key,p in [('workbenchDriverSha256','camera-workbench-v60.js'),('workbenchTemplateSha256','camera-workbench-v60.html'),('builderSha256','build-v60.mjs'),('nameTransformSha256','name-presentation-v60.mjs')]:assert sha(Path('tools/browser-bridge',p).read_bytes())==meta[key],p
 assert sha(Path(meta['basePresentationPath']).read_bytes())==meta['basePresentationSha256']
 artifacts[target]=(data,meta_bytes)
game=artifacts['game.html'][0].decode('utf-8');lab=artifacts['camera-workbench.html'][0].decode('utf-8')
assert core.decode('utf-8') in game
encoded=lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip()
assert encoded.endswith(';') and json.loads(encoded[:-1])==game
for kind in ['presentation','cadence']:
 report=json.loads((out/f'verification-v60-{kind}'/f'{kind}-check.json').read_bytes())
 assert report['pass'] is True
 assert report['normalSha256']==sha(artifacts['game.html'][0])
 assert report['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
runner=json.loads((out/'verification-v60-presentation'/'runner-labels-check.json').read_bytes())
assert runner['pass'] is True and runner['normalSha256']==sha(artifacts['game.html'][0]) and runner['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
for edition in ['v54','v55','v55.1','v56','v57','v58','v59']:
 for p,h in json.loads(Path(f'docs/demos/releases/{edition}/SHA256.json').read_bytes()).items():assert sha(Path(f'docs/demos/releases/{edition}',p).read_bytes())==h,p
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for p,(data,meta_bytes) in artifacts.items():
 (dest/p).write_bytes(data);(dest/(p+'.build.json')).write_bytes(meta_bytes)
(dest/'game.html.bundle-inputs.json').write_bytes(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['presentation','cadence']:shutil.copytree(out/f'verification-v60-{kind}',proof/kind,dirs_exist_ok=True,ignore=shutil.ignore_patterns('probe-*'))
report={'pass':True,'normalSha256':index['game.html'],'workbenchSha256':index['camera-workbench.html'],'oneExactEmbeddedGame':True,
 'sourceCoreSha256':sha(core),'sourceInputCount':len(pins['inputs']),'pitchBallCadenceMs':22,'ordinaryCadenceMs':55,
 'ballDisplayDefaults':{'perspective':1,'overhead':1},'olderReleasesUnchanged':True,'corePhysicsRulesAiChanged':False,
 'wholeOriginalPlanComplete':False,'newNineInningTest':False,'predictedContactGazeThenImpactStabilization':True,'adjustableImpactTimingAndMotion':True,'nameDisplayDefaults':{'scale':1},'allCameraNamesOverlap':True,'ballAboveNameTextAndBox':True,'preset':meta['preset'],'pitcherReaction':meta['pitcherReaction']}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
