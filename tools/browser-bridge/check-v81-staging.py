import hashlib
import json
import subprocess
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
staged=subprocess.check_output(['git','diff','--cached','--name-only','-z']).decode('utf-8').split('\0')
staged=[p for p in staged if p]
assert 'AGENTS.md' not in staged and not any(p.startswith(('.agents/','.codex/')) for p in staged)
assert not any(Path(p).name in ['package-lock.json','package.json','tsconfig.json','.env'] for p in staged)
def index(path):
    return subprocess.check_output(['git','show',':'+path])
pins=json.loads(Path('docs/demos/releases/v81/source-inputs-union.json').read_bytes())
for path,expected in pins.items():
    assert sha(index(path))==sha(Path(path).read_bytes())==expected,path
for path in staged:
    assert index(path)==Path(path).read_bytes(),path
for filename,expected in json.loads(Path('docs/demos/releases/v81/SHA256.json').read_bytes()).items():
    assert sha(index('docs/demos/releases/v81/'+filename))==expected,filename
assert json.loads(Path('docs/verification/releases/v81/release-check.json').read_bytes())['pass']
assert json.loads(Path('docs/verification/releases/v81/reproduce-check.json').read_bytes())['pass']
result={'pass':True,'stagedPaths':len(staged),'sourceInputs':len(pins),'allStagedBytesEqualWorkingCopy':True,'allReleaseHashesMatchIndex':True,'userAgentsAndSettingsExcluded':True}
Path('docs/verification/releases/v81/staging-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
