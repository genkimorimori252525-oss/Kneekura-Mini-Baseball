"""Read-only source extraction. Corrected single-shot ZIPs take precedence."""
import base64, hashlib, json, pathlib, sys, zipfile, zlib
inventory=json.loads(pathlib.Path('docs/verification/releases/v100-investigation/audio-inventory.json').read_text(encoding='utf-8'))
folder=pathlib.Path(inventory['sourceFolder'])
chosen={'wood1':'SE_HIT_WOOD1','wood2':'SE_HIT_WOOD2','wood3':'SE_HIT_WOOD3','wood4':'SE_HIT_WOOD4',
 'bunt':'SE_HIT_BUNT_W1','catch':'SE_CATCH_N1','catchGround':'SE_CATCH_G1','mitt':'SE_MIT_1',
 'throw':'SE_THROW_1','swing':'SE_SWING_1','fence':'SE_FENCE_1','bound':'SE_BOUND_1','score':'SE_SCORE',
 'start':'SE_KANSEI_START','end':'SE_KANSEI_END','homerun':'SE_KANSEI_HOMERUN','hit1':'SE_KANSEI_HIT1','hit2':'SE_KANSEI_HIT2',
 'clap':'SE_KANSEI_CLAP1','hbp':'SE_KANSEI_ZAN1'}
bank={};manifest={}
for key,suffix in chosen.items():
 found=None
 for archive in inventory['archives']:
  rows=[r for r in archive['wavs'] if pathlib.PurePosixPath(r['name']).name.endswith('_'+suffix+'.wav') and '/GM' not in r['name']]
  if rows:
   row=rows[0]
   with zipfile.ZipFile(archive['path']) as z: data=z.read(row['name'])
   found=(data,row,archive['path']);break
 if found is None:
  rows=[r for r in inventory['folderWavs'] if pathlib.PureWindowsPath(r['name']).name.endswith('_'+suffix+'.wav') and r['name'].startswith('002_SAR_SE_SIAI')]
  if len(rows)!=1:raise ValueError((key,suffix,len(rows)))
  row=rows[0];data=(folder/pathlib.PureWindowsPath(row['name'])).read_bytes();found=(data,row,str(folder))
 data,row,source=found
 if hashlib.sha256(data).hexdigest()!=row['sha256']:raise ValueError('source changed '+key)
 if 'smpl' in row['riffChunks']:raise ValueError('loop metadata '+key)
 compressed=zlib.compress(data,9)
 assert zlib.decompress(compressed)==data
 bank[key]={'encoding':'deflate','base64':base64.b64encode(compressed).decode('ascii')}
 manifest[key]={'source':source,'file':row['name'],'sha256':row['sha256'],'pcmSha256':row['pcmSha256'],'bytes':len(data),'durationSeconds':row['durationSeconds']}
out=pathlib.Path(sys.argv[1]);out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(bank,separators=(',',':')),encoding='utf-8')
out.with_suffix('.manifest.json').write_text(json.dumps({'version':100,'assets':manifest,'packSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'listeningVerified':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'path':str(out),'assets':len(bank),'bytes':out.stat().st_size}))
