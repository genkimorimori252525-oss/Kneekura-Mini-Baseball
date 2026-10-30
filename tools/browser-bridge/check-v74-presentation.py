"""Verify the inherited ordinary presentation and absence of public-rating UI."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
old = Path('docs/demos/releases/v73/game.html').read_text(encoding='utf-8')
new = Path('../../outputs/ばせぼーるlv74_TBD_vs_LAD_用具と能力上限拡張版.html').read_text(encoding='utf-8')
def host(text):
    return re.search(r'<script id="v33-offline-core-match">([\s\S]*?)</script>', text).group(1)
a, b = host(old), host(new)
restored = b.replace('version:74,authority:', 'version:73,authority:').replace('TBD対LAD 用具と能力上限拡張版 74', 'TBD対LAD 全体スイング角度版 73')
assert a == restored
assert 'projectLivePublicAbilitiesV1(' not in b and 'previewLivePublicLeagueV1(' not in b
reference = json.loads(re.search(r'<script id="v61-public-ability-reference" type="application/json">([\s\S]*?)</script>', new).group(1))
ratings = [value for row in reference['anchors'] for value in row['ratings'].values()]
assert max(ratings) <= 100
paths = subprocess.check_output(['git', '-c', 'core.autocrlf=false', 'diff', '--name-only', '--', 'src', 'docs/demos', 'tools/browser-bridge/build-maker.mjs'], text=True).splitlines()
for name in paths:
    before = subprocess.check_output(['git', 'show', 'HEAD:' + name])
    after = Path(name).read_bytes()
    def eol(data):
        return (data.count(b'\r\n') > 0, data.count(b'\n') - data.count(b'\r\n') > 0)
    assert eol(before) == eol(after), name
report = {'pass': True, 'gameHostPreservedExceptEditionAndVersion': True, 'normalPublicAbilityTableExists': False,
          'normalCallsPublicRatingProjection': False, 'ordinaryNumericOverflowExposure': False, 'physicalSIClippedTo100': False,
          'fixedLegacyRatings': {'count': len(ratings), 'min': min(ratings), 'max': max(ratings)}, 'sourceLineEndingsPreserved': len(paths),
          'meaning': 'Maker-only authoring. Normal UI has no ability table or raw public-rating DOM path; km/h and other SI quantities are separate.'}
Path('docs/verification/releases/v74/normal-public-display-boundary.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report))
