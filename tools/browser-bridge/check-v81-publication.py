import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

repository='genkimorimori252525-oss/Kneekura-Mini-Baseball'
commit=sys.argv[1]
def api(endpoint):
    return json.loads(subprocess.check_output(['gh','api','repos/'+repository+'/'+endpoint]))
remote=api('git/ref/heads/jolly/tbd-lad-native-browser-core-2026-10-14')['object']['sha']
pr=api('pulls/380')
assert remote==pr['head']['sha']==commit and pr['state']=='open' and pr['draft']
tree=api('git/trees/'+commit+'?recursive=1');assert not tree['truncated']
entries={entry['path']:entry for entry in tree['tree']}
source=json.loads(Path('docs/demos/releases/v81/source-inputs-union.json').read_bytes())
for path,sha in source.items():
    data=Path(path).read_bytes();assert hashlib.sha256(data).hexdigest()==sha
    git_sha=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    assert entries[path]['sha']==git_sha,path
artifacts={}
for filename in ['game.html','camera-workbench.html','maker.html','game.html.build.json','camera-workbench.html.build.json','maker.html.build.json','game.html.bundle-inputs.json','maker.html.bundle-inputs.json','SHA256.json']:
    path='docs/demos/releases/v81/'+filename;data=Path(path).read_bytes()
    expected=hashlib.sha256(data).hexdigest();entry=entries[path]
    assert entry['sha']==hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() and entry['size']==len(data),path
    request=urllib.request.Request('https://raw.githubusercontent.com/'+repository+'/'+commit+'/'+path,headers={'User-Agent':'MiniBaseball-v81-publication-verifier'})
    observed=hashlib.sha256();size=0
    with urllib.request.urlopen(request,timeout=90) as response:
        while chunk:=response.read(1024*1024):
            observed.update(chunk);size+=len(chunk)
    assert observed.hexdigest()==expected and size==len(data),path
    artifacts[filename]={'sha256':expected,'bytes':size,'gitBlob':entry['sha']}
result={'pass':True,'implementationCommit':commit,'remoteAndDraftPrHeadMatch':True,'sourceInputGitBlobsMatched':len(source),'rawFilesMatched':artifacts,'mainMerged':False}
Path('docs/verification/releases/v81/publication-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
