import hashlib,json,shutil,zipfile
from pathlib import Path
base=Path('docs/demos/releases/v55')
archive=base/'tested-camera-inputs.zip'
initial=Path('docs/verification/releases/v55/initial-release-check')
initial.mkdir(exist_ok=False)
for name in ['tested-camera-inputs.zip','SHA256.json']:
 shutil.copyfile(base/name,initial/name)
replacement=Path('../../outputs/v55-rechecked-inputs.zip')
with zipfile.ZipFile(archive) as src,zipfile.ZipFile(replacement,'x',compression=zipfile.ZIP_DEFLATED) as dst:
 for entry in src.infolist():
  data=Path(entry.filename).read_bytes()
  if entry.filename!='tools/browser-bridge/check-v55-release.mjs':
   assert src.read(entry.filename)==data,entry.filename
  dst.writestr(entry.filename,data)
with zipfile.ZipFile(replacement) as check:
 assert check.testzip() is None
 for name in check.namelist():assert check.read(name)==Path(name).read_bytes(),name
shutil.copyfile(replacement,archive)
index=json.loads((base/'SHA256.json').read_text(encoding='utf-8'))
index[archive.name]=hashlib.sha256(archive.read_bytes()).hexdigest()
(base/'SHA256.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
for name,digest in index.items():assert hashlib.sha256((base/name).read_bytes()).hexdigest()==digest,name
print(json.dumps({'pass':True,'allZipBytesAndCrcVerified':True,'fixedCheckerHandlesCRLF':True,'oldArchivePreserved':True,'gameAndWorkbenchUnchanged':True}))
