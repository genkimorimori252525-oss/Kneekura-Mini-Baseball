from pathlib import Path
import json

base=Path('docs/verification/releases/v120')
receipts=[]
for p in Path('docs/ai-continuity/verification-receipts').glob('MB-20261025-COOPERATIVE-DEFENSE-V120_*.json'):
    r=json.loads(p.read_text(encoding='utf-8'))
    receipts.append((p,r))

def evidence(*parts, expected='PASS'):
    matches=[(p,r) for p,r in receipts if all(part in r['command'] for part in parts)]
    assert matches, parts
    p,r=max(matches,key=lambda row:row[1]['observed_at'])
    assert r['result']==expected, (p,r['result'],expected)
    return {'path':p.as_posix(),'expected':expected}

reports={name:str(base/path) for name,path in {
 'browser':'browser-final/report.json','authoring':'authoring-final-2/report.json',
 'context':'contexts-final/report.json','contextExtra':'contexts-extra-final/report.json',
 'background':'background-final/report.json','athletic':'athletic-final/report.json',
 'nine':'nine-final/report.json','buffer':'live-buffer-final/report.json','exactAir':'exact-air-final/report.json',
 'performance':'../..//cooperative-defense-v120/performance/verdict-candidate-final-3.json'}.items()}
performance=json.loads(Path(reports['performance']).read_text(encoding='utf-8'))
perf_expected='PASS' if performance['pass'] else 'FAIL'
rows=[evidence('tools/browser-bridge/build-field-release-v120.mjs','../../outputs/_candidate_v120_20261025_04'),
 evidence('node_modules/vitest/vitest.mjs','src/core/sim/ball/BaseballOwnedStageV120.test.ts','src/core/sim/fielding/LiveFielderAvoidanceV1.test.ts'),
 evidence('node_modules/typescript/bin/tsc','--noEmit')]
for name in ['browser','authoring','context','contextExtra','background','athletic','nine','buffer','exactAir']:
    rows.append(evidence(str(Path(reports[name]).parent).replace('\\','/')))
rows += [evidence('docs/verification/releases/v120/ordinary-profile-5'),
 evidence('tools/browser-bridge/benchmark-cooperative-v120.mjs','candidate-final-3',expected=perf_expected),
 evidence('tools/browser-bridge/summarize-cooperative-performance-v120.mjs','candidate-final-3',expected=perf_expected)]
config={'candidate':'../../outputs/_candidate_v120_20261025_04','reports':reports,'receipts':rows}
(base/'candidate-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Saved candidate verification recipe with original PASS/FAIL results retained')
