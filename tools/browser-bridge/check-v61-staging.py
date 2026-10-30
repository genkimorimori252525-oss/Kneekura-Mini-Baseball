import hashlib
import json
from pathlib import Path
import re
import subprocess

allow = set(json.loads(Path('../../outputs/v61-stage-allowlist.json').read_text(encoding='utf-8')))
allow.update('docs/verification/releases/v61/'+name for name in ['staging-check.json','staging-whitespace.txt'])
report_path = 'docs/verification/releases/v61/staging-check.json'

def git(*args):
    return subprocess.check_output(['git', *args])

before = set(git('diff', '--cached', '--name-only', '-z').decode('utf-8').split('\0')) - {''}
assert before <= allow, 'unrelated staged files exist'
assert 'AGENTS.md' not in allow
subprocess.run(['git', '-c', 'core.autocrlf=false', 'add', '--', *sorted(p for p in allow if Path(p).is_file())], check=True)
rows = git('diff', '--cached', '--name-only', '-z').decode('utf-8').split('\0')
paths = sorted(p for p in rows if p)
assert set(paths) <= allow and 'AGENTS.md' not in paths
index = {}
for item in git('ls-files', '--stage', '-z').decode('utf-8').split('\0'):
    if item:
        header, path = item.split('\t', 1)
        index[path] = header.split()[1]
patterns = [rb'AKIA[0-9A-Z]{16}', rb'gh[pso]_[A-Za-z0-9_]{30,}', rb'sk-(?:proj-)?[A-Za-z0-9_-]{30,}', rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
for path in paths:
    data = Path(path).read_bytes()
    assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == index[path], 'staged bytes differ: ' + path
    assert len(data) < 100_000_000, 'oversized GitHub file: ' + path
    assert not any(re.search(p, data) for p in patterns), 'possible credential pattern in ' + path
# Preserve verbatim whitespace diagnostic outputs as raw logs, including spaces.
text_paths = [p for p in paths if not (p.endswith('.log') or p.startswith('docs/verification/releases/v61/continuity-audit') and p.endswith('.txt') or p.startswith('docs/verification/releases/v61/staging-') and p.endswith('whitespace.txt'))]
r = subprocess.run(['git', '-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'diff', '--cached', '--ignore-cr-at-eol', '--check', '--', *text_paths], capture_output=True)
Path('docs/verification/releases/v61/staging-whitespace.txt').write_bytes(r.stdout + r.stderr)
report = {'pass': r.returncode == 0, 'stagedFiles': len(paths), 'byteExactAllStagedBlobs': True, 'credentialPatternMatches': 0,
          'whitespaceExit': r.returncode, 'whitespaceFiles': len(text_paths), 'rawReceiptLogsExcludedFromWhitespace': len(paths)-len(text_paths),
          'userAgentsFileExcluded': True, 'sourceAfterTestNormalization': False}
Path(report_path).write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report))
assert r.returncode == 0, r.stdout.decode('utf-8', errors='replace')[:4000]
subprocess.run(['git', '-c', 'core.autocrlf=false', 'add', '--', report_path, 'docs/verification/releases/v61/staging-whitespace.txt'], check=True)

final_rows = git('ls-files', '--stage', '-z').decode('utf-8').split('\0')
final_index = {row.split('\t',1)[1]:row.split('\t',1)[0].split()[1] for row in final_rows if row}
for path in git('diff','--cached','--name-only','-z').decode('utf-8').split('\0'):
    if not path: continue
    data=Path(path).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==final_index[path], path
