from pathlib import Path
import json
import subprocess

run = lambda args: subprocess.check_output(args)
head = run(['git', 'rev-parse', 'HEAD']).decode().strip()
branch = 'jolly/tbd-lad-native-browser-core-2026-10-14'
remote = run(['git', 'ls-remote', 'origin', 'refs/heads/' + branch]).decode().split()[0]
pr = json.loads(run(['gh', 'pr', 'view', '380', '--json', 'headRefOid,state,isDraft,url']))
assert head == remote == pr['headRefOid'] and pr['state'] == 'OPEN' and pr['isDraft']
tree = json.loads(run(['gh', 'api', 'repos/genkimorimori252525-oss/Kneekura-Mini-Baseball/git/trees/' + head + '?recursive=1']))
assert not tree.get('truncated')
blobs = {item['path']: item['sha'] for item in tree['tree'] if item['type'] == 'blob'}
contract = json.loads(Path('docs/demos/releases/v87/source-contract.json').read_bytes())
files = list(contract['inputs']) + ['docs/demos/releases/v87/' + name for name in
                                 json.loads(Path('docs/demos/releases/v87/SHA256.json').read_bytes())]
for path in files:
    assert blobs[path] == run(['git', 'rev-parse', head + ':' + path]).decode().strip(), path
report = {'pass': True, 'productCommit': head, 'remoteHead': remote, 'pullRequest': pr,
          'remoteSourceAndArtifactGitBlobsMatched': len(files), 'mainMerged': False}
Path('docs/verification/releases/v87/publication.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
