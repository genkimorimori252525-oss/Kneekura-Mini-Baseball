import hashlib
import json
import pathlib
import subprocess
import sys
import zipfile

root = pathlib.Path.cwd()
snapshot = sys.argv[1]
branch = 'jolly/tbd-lad-native-browser-core-2026-10-14'

def git(*args):
    return subprocess.check_output(['git', *args]).decode('utf-8').strip()

subprocess.run(['git', 'fetch', 'origin', branch], check=True, capture_output=True)
remote = git('rev-parse', 'refs/remotes/origin/' + branch)
assert remote == snapshot, (remote, snapshot)
assert git('rev-parse', snapshot + '^{tree}') == git('rev-parse', remote + '^{tree}')
assert git('rev-parse', snapshot + '^') == 'df61388b32c773c14c2ce146e76d69e98818eb41'
changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', snapshot).splitlines()
assert len(changed) == 2350, len(changed)

def blob(path):
    return subprocess.check_output(['git', 'show', snapshot + ':' + path])

release = 'docs/demos/releases/v41/'
checksums = json.loads(blob(release + 'SHA256.json'))
for name, expected in checksums.items():
    assert hashlib.sha256(blob(release + name)).hexdigest() == expected, name
for path in ['docs/handoffs/2026-10-17-LATEST.md', release + 'README.md',
             'docs/third-party/openbiomechanics/LICENSE-DATA.md']:
    assert blob(path)

with zipfile.ZipFile(root / release / 'tested-core-inputs.zip') as archive:
    assert archive.testzip() is None
    frozen = json.loads(archive.read('freeze.json'))
    assert frozen['sourceInputCount'] == 103 and len(frozen['inputs']) == 103
    for name, expected in frozen['inputs'].items():
        assert hashlib.sha256(archive.read('inputs/' + name)).hexdigest() == expected, name
    for name, expected in frozen['artifacts'].items():
        assert hashlib.sha256(archive.read(name)).hexdigest() == expected, name

receipt_ids = ['MB-20261017-GITHUB-SNAPSHOT-TESTS_f75ebeeabd544e4ea9bc042c0146affe',
               'MB-20261017-GITHUB-SNAPSHOT-TSC_ee216fe1f27349f1bda2c4526b82a473']
for identifier in receipt_ids:
    record = json.loads(blob('docs/ai-continuity/verification-receipts/' + identifier + '.json'))
    assert record['result'] == 'PASS' and record['exit_code'] == 0
    assert hashlib.sha256(blob(record['output_path'])).hexdigest() == record['output_sha256']

report = {'status': 'PASS', 'codeSnapshotCommit': snapshot, 'remoteBranch': branch,
          'remoteSnapshotTree': git('rev-parse', remote + '^{tree}'),
          'changedFiles': len(changed), 'releaseHashes': checksums,
          'rawCoreInputsVerified': 103, 'testAndTypecheckReceiptsVerified': receipt_ids,
          'htmlRawDownloadsPreviouslyMatched': True, 'mainMerged': False,
          'fullProjectGoalComplete': False}
target = root / 'docs/verification/releases/v41/publication.json'
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
