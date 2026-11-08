import hashlib,json,shutil
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v67');proof=Path('docs/verification/releases/v67')
names={'game.html':'ばせぼーるlv67_TBD_vs_LAD_俯瞰の空中球2倍版.html','camera-workbench.html':'カメラワーク調整室_v67.html'}
core=Path('dist/native-match-core-browser.js').read_bytes();pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
assert sha(core)==pins['entrySha256']=='865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00'
for p,h in pins['inputs'].items():assert sha(Path(p).read_bytes())==h,p
artifacts={}
for target,name in names.items():
 data=(out/name).read_bytes();meta_bytes=Path(str(out/name)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
 assert sha(data)==meta['sha256'] and meta['presentationVersion']==67
 assert meta['sourceCoreSha256']==sha(core) and meta['sourceInputCount']==len(pins['inputs']) and not meta['worldPhysicsRulesAiChanged']
 assert meta['ordinaryCadenceMs']==55 and meta['pitchBallCadenceMs']==22
 assert meta['ballDisplayDefaults']=={'perspective':1,'overhead':1,'overheadHeightEmphasis':2}
 assert meta['overheadHeightCue']['basis']=='GROUND_REFERENCED_LITERAL_AIR_DIAMETER_FACTOR' and meta['overheadHeightCue']['legacyAtOne']
 for helper,h in meta['helpers'].items():assert sha(Path('tools/browser-bridge',helper).read_bytes())==h,helper
 for key,p in [('workbenchDriverSha256','tools/browser-bridge/camera-workbench-v67.js'),('workbenchTemplateSha256','tools/browser-bridge/camera-workbench-v67.html'),('builderSha256','tools/browser-bridge/build-v67.mjs')]:assert sha(Path(p).read_bytes())==meta[key],p
 assert sha(Path(meta['basePresentationPath']).read_bytes())==meta['basePresentationSha256']
 artifacts[target]=(data,meta_bytes)
game=artifacts['game.html'][0].decode('utf-8');lab=artifacts['camera-workbench.html'][0].decode('utf-8')
assert core.decode('utf-8') in game
encoded=lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip();assert encoded.endswith(';') and json.loads(encoded[:-1])==game
for directory,filename in [('ball-height','ball-height-check.json'),('cadence','cadence-check.json')]:
 proof_source=proof/directory if (proof/directory/filename).is_file() else out/f'verification-v67-{directory}'
 report=json.loads((proof_source/filename).read_bytes());assert report['pass']
 assert report['normalSha256']==sha(artifacts['game.html'][0]) and report['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
for edition in ['v54','v55','v55.1','v56','v57','v58','v59','v60','v61','v62','v63','v64','v65','v66']:
 for p,h in json.loads(Path(f'docs/demos/releases/{edition}/SHA256.json').read_bytes()).items():assert sha(Path(f'docs/demos/releases/{edition}',p).read_bytes())==h,p
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for p,(data,meta_bytes) in artifacts.items():(dest/p).write_bytes(data);(dest/(p+'.build.json')).write_bytes(meta_bytes)
(dest/'game.html.bundle-inputs.json').write_bytes(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['ball-height','cadence']:
 if (out/f'verification-v67-{kind}').is_dir():shutil.copytree(out/f'verification-v67-{kind}',proof/kind,dirs_exist_ok=True,ignore=shutil.ignore_patterns('probe-*'))
report={'pass':True,'normalSha256':index['game.html'],'workbenchSha256':index['camera-workbench.html'],'oneExactEmbeddedGame':True,
 'sourceCoreSha256':sha(core),'sourceInputCount':len(pins['inputs']),'worldPhysicsRulesAiChanged':False,'olderReleasesUnchanged':True,
 'defaultHeightEmphasis':2,'groundSizeUnchanged':True,'factorOnePixelsExactV66':True,'heightOnlyOverhead':True,'heldBallsHidden':True,
 'newNormalHtmlNineInningTest':False,'wholeOriginalPlanComplete':False}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
