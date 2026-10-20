import hashlib
import json
import subprocess
from pathlib import Path

run = lambda *args: subprocess.check_output(args).strip()
head = run('git', 'rev-parse', 'HEAD').decode()
branch = run('git', 'branch', '--show-current').decode()
remote = run('git', 'ls-remote', 'origin', 'refs/heads/' + branch).decode().split()[0]
assert remote == head, (remote, head)
pr = json.loads(run('gh', 'pr', 'view', '380', '--json', 'headRefOid,isDraft,url'))
assert pr['headRefOid'] == head and pr['isDraft'] is True
contract = json.loads(Path('docs/demos/releases/v82/source-contract.json').read_bytes())
for path, expected in contract['makerSources'].items():
    assert hashlib.sha256(subprocess.check_output(['git', 'show', head + ':' + path])).hexdigest() == expected, path
for name, expected in json.loads(Path('docs/demos/releases/v82/SHA256.json').read_bytes()).items():
    assert hashlib.sha256(subprocess.check_output(['git', 'show', head + ':docs/demos/releases/v82/' + name])).hexdigest() == expected, name
report = {'pass': True, 'productCommit': head, 'remoteBranch': branch, 'pullRequest': pr,
          'makerSha256': contract['makerSha256'], 'exactCommittedSourcePins': len(contract['makerSources']),
          'scope': 'Remote branch and existing Draft PR point to the verified product commit; exact committed maker and source blobs match release hashes.'}
Path('docs/verification/releases/v82/publication.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
