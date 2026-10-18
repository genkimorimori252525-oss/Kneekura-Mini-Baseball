import hashlib,json,shutil
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
out=Path('../../outputs');dest=Path('docs/demos/releases/v62');proof=Path('docs/verification/releases/v62')
names={'game.html':'ばせぼーるlv62_TBD_vs_LAD_投手視点とリリース版.html','camera-workbench.html':'カメラワーク調整室_v62.html','maker.html':'にーくら野球メーカー_投球リリース編集版_v62.html'}
core=Path('dist/native-match-core-browser.js').read_bytes();pins=json.loads(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
assert sha(core)==pins['entrySha256']
for p,h in pins['inputs'].items():assert sha(Path(p).read_bytes())==h,p
artifacts={}
for target,name in names.items():
 data=(out/name).read_bytes();meta_bytes=Path(str(out/name)+'.build.json').read_bytes();meta=json.loads(meta_bytes)
 assert sha(data)==meta['sha256']
 if target!='maker.html':
  assert meta['presentationVersion']==62 and meta['sourceCoreSha256']==sha(core) and meta['sourceInputCount']==len(pins['inputs'])
  assert meta['ordinaryCadenceMs']==55 and meta['pitchBallCadenceMs']==22
  assert meta['compatibleSessionCoreSha256']==[]
  assert meta['pitcherBodyHead']['moundSurface']=={'x':0,'y':.254,'z':18.44}
  assert meta['ballDisplayDefaults']=={'perspective':1,'overhead':1} and meta['nameDisplayDefaults']=={'scale':1}
  for helper,h in meta['helpers'].items():assert sha(Path('tools/browser-bridge',helper).read_bytes())==h,helper
  for key,p in [('workbenchDriverSha256','tools/browser-bridge/camera-workbench-v62.js'),('workbenchTemplateSha256','tools/browser-bridge/camera-workbench-v62.html'),('builderSha256','tools/browser-bridge/build-v62.mjs'),('pitcherTransformSha256','tools/browser-bridge/pitcher-presentation-v62.mjs'),('rosterSha256','docs/demos/live-game-roster-v62.json'),('catalogSha256','docs/demos/live-game-roster-catalog-v62.json'),('publicReferenceSha256','docs/demos/live-public-ability-reference-v1.json')]:assert sha(Path(p).read_bytes())==meta[key],p
  assert sha(Path(meta['basePresentationPath']).read_bytes())==meta['basePresentationSha256']
 else:
  maker_core=Path('dist/batting-workbench-core.js').read_bytes();maker_pins=Path(str(out/name)+'.bundle-inputs.json').read_bytes();manifest=json.loads(maker_pins)
  assert sha(maker_core)==meta['coreSha256']==manifest['entrySha256'] and maker_core in data
  assert sha(maker_pins)==meta['bundleInputManifestSha256']
  for p,h in manifest['inputs'].items():assert sha(Path(p).read_bytes())==h,p
  for key,p in [('uiSha256','docs/demos/baseball-maker-ui.mjs'),('templateSha256','docs/demos/baseball-maker.html'),('liveRosterSha256',meta['liveRosterPath']),('liveRosterCatalogSha256',meta['liveRosterCatalogPath']),('publicReferenceSha256','docs/demos/live-public-ability-reference-v1.json')]:assert sha(Path(p).read_bytes())==meta[key],p
  assert meta['gamePlayers']==20 and meta['publicAbilities'] and meta['executableTraits']
 artifacts[target]=(data,meta_bytes)
game=artifacts['game.html'][0].decode('utf-8');lab=artifacts['camera-workbench.html'][0].decode('utf-8')
assert core.decode('utf-8') in game
encoded=lab.split('const CAMERA_LAB_GAME_HTML=',1)[1].split('\n',1)[0].rstrip();assert encoded.endswith(';') and json.loads(encoded[:-1])==game
for kind in ['presentation','cadence']:
 report=json.loads((out/f'verification-v62-{kind}'/f'{kind}-check.json').read_bytes());assert report['pass'] is True
 assert report['normalSha256']==sha(artifacts['game.html'][0]) and report['workbenchSha256']==sha(artifacts['camera-workbench.html'][0])
 if kind=='presentation':assert report['makerSha256']==sha(artifacts['maker.html'][0])
gameproof=json.loads((out/'verification-v62-game/game-check.json').read_bytes())
assert gameproof['pass'] and gameproof['normalSha256']==sha(artifacts['game.html'][0])
assert gameproof['views'][0]['completed']['finished'] and gameproof['views'][0]['completed']['match']['inning']>=9
makerproof=json.loads((out/'verification-v62-maker-release/maker-release-check.json').read_bytes());assert makerproof['pass']
gazeaudit=json.loads((out/'verification-v62-gaze-audit/gaze-audit.json').read_bytes());assert gazeaudit['pass']
for edition in ['v54','v55','v55.1','v56','v57','v58','v59','v60','v61']:
 for p,h in json.loads(Path(f'docs/demos/releases/{edition}/SHA256.json').read_bytes()).items():assert sha(Path(f'docs/demos/releases/{edition}',p).read_bytes())==h,p
dest.mkdir(parents=True,exist_ok=True);proof.mkdir(parents=True,exist_ok=True)
for p,(data,meta_bytes) in artifacts.items():(dest/p).write_bytes(data);(dest/(p+'.build.json')).write_bytes(meta_bytes)
(dest/'game.html.bundle-inputs.json').write_bytes(Path('dist/native-match-core-browser.js.inputs.json').read_bytes())
(dest/'maker.html.bundle-inputs.json').write_bytes(maker_pins)
index={p.name:sha(p.read_bytes()) for p in dest.iterdir() if p.is_file() and p.name not in ['README.md','SHA256.json']}
(dest/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for kind in ['presentation','cadence','game','maker-release','gaze-audit']:
 shutil.copytree(out/f'verification-v62-{kind}',proof/kind,dirs_exist_ok=True,ignore=shutil.ignore_patterns('probe-*'))
report={'pass':True,'normalSha256':index['game.html'],'workbenchSha256':index['camera-workbench.html'],'makerSha256':index['maker.html'],
 'oneExactEmbeddedGame':True,'sourceCoreSha256':sha(core),'sourceInputCount':len(pins['inputs']),'makerSourceInputCount':len(manifest['inputs']),
 'pitchBallCadenceMs':22,'ordinaryCadenceMs':55,'olderReleasesUnchanged':True,'coreBundleChanged':True,'physicalReleaseChanged':True,'defensivePolicyChanged':True,
 'rulesChanged':False,'newNormalHtmlNineInningTest':True,'wholeOriginalPlanComplete':False,'authoredHeadMotionNotMeasured':True}
(proof/'release-check.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
