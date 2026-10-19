"""Verify published Git blobs for large HTML and public raw source/indices."""
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
repository = 'genkimorimori252525-oss/Kneekura-Mini-Baseball'
remote = subprocess.check_output(['git', 'ls-remote', 'origin', 'refs/heads/' + branch], text=True).split()[0]
pr = json.loads(subprocess.check_output(['gh', 'pr', 'view', '380', '--json', 'url,state,isDraft,headRefName,headRefOid'], text=True))
assert remote == commit == pr['headRefOid'] and pr['headRefName'] == branch and pr['state'] == 'OPEN' and pr['isDraft']
tree = json.loads(subprocess.check_output(['gh', 'api', 'repos/' + repository + '/git/trees/' + commit + '?recursive=1']))
assert not tree.get('truncated'), 'published Git tree is incomplete'
nodes = {node['path']: node for node in tree['tree'] if node['type'] == 'blob'}
html_blobs = []
for name in ['game.html', 'camera-workbench.html', 'maker.html']:
    path = 'docs/demos/releases/v77/' + name
    data = Path(path).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert nodes[path]['sha'] == blob and nodes[path]['size'] == len(data), path
    html_blobs.append({'path': path, 'gitBlobSha1': blob, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
paths = ['docs/demos/releases/v77/' + name for name in ['SHA256.json', 'README.md', 'game.html.build.json', 'maker.html.build.json']]
paths += ['docs/reports/2026-10-20-v77-independent-traits-and-pitcher-lab.md', 'docs/handoffs/LATEST.md',
          'tools/browser-bridge/live-pitcher-body-head-view-v77.js', 'tools/browser-bridge/build-v77.mjs',
          'docs/verification/releases/v77/release-check.json']


def check(path):
    url = 'https://raw.githubusercontent.com/' + repository + '/' + commit + '/' + urllib.parse.quote(path, safe='/')
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    assert data == Path(path).read_bytes(), path
    return {'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    files = list(pool.map(check, paths))
report = {'pass': True, 'sourceCommit': commit, 'remoteHead': remote, 'pullRequest': pr,
          'publishedHtmlBlobs': html_blobs, 'largeHtmlVerification': 'GITHUB_GIT_TREE_BLOB_AND_SIZE_MATCH_LOCAL_BYTES',
          'rawFiles': files, 'mainMerged': False}
Path('docs/verification/releases/v77/publication.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'pass': True, 'commit': commit, 'htmlBlobs': len(html_blobs), 'rawFiles': len(files), 'draft': True}))
