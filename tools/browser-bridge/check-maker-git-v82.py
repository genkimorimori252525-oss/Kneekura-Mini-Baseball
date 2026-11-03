"""Verify exact staged source bytes without staging unrelated user work."""
import hashlib
import json
import subprocess
from pathlib import Path

sha = lambda value: hashlib.sha256(value).hexdigest()
contract = json.loads(Path('docs/demos/releases/v82/source-contract.json').read_bytes())
for path, expected in contract['makerSources'].items():
    result = subprocess.run(['git', 'show', ':' + path], capture_output=True, check=True)
    assert sha(result.stdout) == expected, path
paths = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z']).decode('utf-8').split('\0')
assert not any(path in ['AGENTS.md', 'AGENTS.md.bak'] or path.startswith(('.agents/', 'dist/'))
               or 'lockfile' in path or path.endswith('lock.json') for path in paths)
result = subprocess.run(['git', '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
    'diff', '--cached', '--check', '--', '.', ':!docs/ai-continuity/verification-receipts/*.log',
    ':!docs/verification/releases/v82/*.log', ':!docs/demos/releases/v82/maker.html'], capture_output=True)
assert result.returncode == 0, result.stdout.decode('utf-8', errors='replace')
report = {'pass': True, 'makerSha256': contract['makerSha256'], 'sourcePins': len(contract['makerSources']),
          'stagedFilesAtCheck': len([path for path in paths if path]),
          'scope': 'All maker source contract hashes match exact staged Git blobs; unrelated user files excluded; CRLF-aware whitespace check.'}
Path('docs/verification/releases/v82/git-preflight.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
