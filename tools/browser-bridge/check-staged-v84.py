from pathlib import Path
import hashlib
import json
import subprocess

sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *args: subprocess.check_output(['git', *args])
staged = git('diff', '--cached', '--name-only', '-z').decode().strip('\0').split('\0')
assert staged and not any(p == 'AGENTS.md' or p.startswith('.agents/') or p.endswith(('.lock', 'package-lock.json'))
                          or '/secrets/' in p or p.split('/')[-1].startswith('.env') for p in staged)
contract = json.loads(git('show', ':docs/demos/releases/v84/source-contract.json'))
for path, expected in contract['inputs'].items():
    assert sha(git('show', ':' + path)) == expected, 'Staged Source differs: ' + path
frozen = json.loads(git('show', ':docs/demos/releases/v84/SHA256.json'))
for name, expected in frozen.items():
    assert sha(git('show', ':docs/demos/releases/v84/' + name)) == expected, name
for path in ['src/core/sim/fielding/DefenderMotion.ts', 'src/core/sim/running/RunnerMotion.ts',
             'src/core/sim/fielding/SourceDefensiveControlV1.ts']:
    assert path not in staged
result = subprocess.run(['git', '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
    'diff', '--cached', '--check', '--', '.', ':(exclude)docs/ai-continuity/verification-receipts/*.log',
    ':(exclude)docs/demos/releases/v84/*.html'], capture_output=True)
assert result.returncode == 0, result.stdout.decode(errors='replace')
report = {'pass': True, 'stagedFiles': len(staged), 'sourceGitBlobsMatched': len(contract['inputs']),
          'frozenGitBlobsMatched': len(frozen), 'userFilesSettingsSecretsLockfilesExcluded': True,
          'legacyNativeMotorUnchanged': True, 'whitespaceChecked': True,
          'byteSensitiveExclusions': ['Original command logs', 'Canonical embedded HTML']}
Path('docs/verification/releases/v84/staging.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
