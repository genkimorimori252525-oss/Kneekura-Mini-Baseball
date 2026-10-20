import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

commit = sys.argv[1]
branch = 'jolly/tbd-lad-native-browser-core-2026-10-14'
repo = 'genkimorimori252525-oss/Kneekura-Mini-Baseball'
def command(*args):
    return subprocess.check_output(args).decode('utf-8').strip()

remote = command('git', 'ls-remote', 'origin', 'refs/heads/'+branch).split()[0]
assert remote == commit, (remote, commit)
pr = json.loads(command('gh', 'pr', 'view', '380', '--json', 'headRefOid,isDraft,state,url,title'))
assert pr['headRefOid'] == commit and pr['isDraft'] and pr['state'] == 'OPEN'
paths = ['docs/history/INCIDENTS.md','docs/handoffs/LATEST.md','src/core/sim/fielding/LiveFieldPlayV1.ts','src/core/sim/fielding/LiveFieldRoleAssignmentV1.ts',
 'docs/reports/2026-10-18-v49-positional-defense.md','docs/demos/releases/v49/game.html','docs/demos/releases/v49/SHA256.json']

def verify(path):
    url='https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+path
    with urllib.request.urlopen(url,timeout=45) as response:
        data=response.read()
    expected=Path(path).read_bytes()
    assert data == expected, path
    return path, {'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    downloads=dict(pool.map(verify, paths))
report={'pass':True,'sourceCommit':commit,'verifiedRemoteHead':remote,'branch':branch,'pullRequest':pr,'rawFiles':downloads,
 'scope':'actual current raw bytes and remote branch/Draft PR; no main merge'}
Path('docs/verification/releases/v49/publication.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pass':True,'commit':commit,'rawFiles':len(downloads),'draft':pr['isDraft']}))
