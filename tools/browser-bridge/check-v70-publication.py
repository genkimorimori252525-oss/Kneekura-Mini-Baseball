import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

commit = sys.argv[1]
branch = 'jolly/tbd-lad-native-browser-core-2026-10-14'
remote = subprocess.check_output(['git', 'ls-remote', 'origin', 'refs/heads/' + branch], text=True).split()[0]
pr = json.loads(subprocess.check_output(['gh', 'pr', 'view', '380', '--json', 'url,state,isDraft,headRefName,headRefOid'], text=True))
assert remote == commit == pr['headRefOid'] and pr['headRefName'] == branch and pr['state'] == 'OPEN' and pr['isDraft']
paths = ['docs/demos/releases/v70/' + p for p in ['maker.html', 'SHA256.json', 'maker.html.build.json', 'README.md']]
paths += ['docs/reports/2026-10-19-v70-batter-comparison.md', 'docs/handoffs/LATEST.md',
          'docs/demos/baseball-maker-batter-comparison-v70.js', 'tools/browser-bridge/maker-match-renderer-v70.js',
          'docs/verification/releases/v70/release-check.json']


def check(path):
    url = 'https://raw.githubusercontent.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/' + commit + '/' + urllib.parse.quote(path, safe='/')
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    local = Path(path).read_bytes()
    assert data == local, path
    return {'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    files = list(pool.map(check, paths))
report = {'pass': True, 'sourceCommit': commit, 'remoteHead': remote, 'pullRequest': pr, 'rawFiles': files, 'mainMerged': False}
Path('docs/verification/releases/v70/publication.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'commit': commit, 'rawFiles': len(files), 'draft': True}))
