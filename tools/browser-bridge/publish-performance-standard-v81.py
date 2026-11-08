"""Publish approved documentation only to the existing design branch.

Creates a tree with the current head as parent, then fast-forwards without force.
No checkout, working-tree replacement, source changes or historical evidence edits.
"""
import hashlib
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path

repository='genkimorimori252525-oss/Kneekura-Mini-Baseball'
branch='jolly/core-foundation-plan-2026-09-17'
implementation=sys.argv[1]
assert re.fullmatch(r'[a-f0-9]{40}',implementation)
def api(path,body=None):
    args=['gh','api','repos/'+repository+'/'+path]
    if body is not None:
        args+=['--method','POST','--input','-']
    completed=subprocess.run(args,input=None if body is None else json.dumps(body),text=True,encoding='utf-8',capture_output=True,check=True)
    return json.loads(completed.stdout)
def content(path,ref):
    import base64
    result=api('contents/'+path+'?ref='+ref)
    return base64.b64decode(result['content']).decode('utf-8')

head=api('git/ref/heads/'+branch)['object']['sha']
base=api('git/commits/'+head)
files={}
for path in ['docs/performance/PERFORMANCE-STANDARD.md','docs/performance/2026-10-20-v81-lossless-results.md','docs/performance/2026-10-20-v81-measured-clip-cache.md']:
    source=Path(path).read_text(encoding='utf-8')
    def link(match):
        target=match.group(2)
        if re.match(r'^(https?:|#|/)',target):
            return match.group(0)
        absolute=posixpath.normpath(posixpath.join(posixpath.dirname(path),target))
        return '['+match.group(1)+'](https://github.com/'+repository+'/blob/'+implementation+'/'+absolute+')'
    files[path]=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,source)+'\n実装・HTMLの固定commit: `'+implementation+'`。設計branchへの反映は文書のみ。\n'
entry='\n\n## v81 最新版への無劣化性能実装（2026-10-20）\n\n[恒久標準](performance/PERFORMANCE-STANDARD.md)・[採否と実測](performance/2026-10-20-v81-lossless-results.md)。実装/3HTMLは `'+implementation+'`（既存Draft PR #380、main未merge）。通常144/調整室60/メーカー64場面の画素一致、9回320＋別seed82球の全record一致。全673軌道を保持。全シーン同期更新を実装したが、初回起動コスト増・実機/60FPS全場面・Worker/GPU等は未達/未検証として残す。旧lv76証跡とは区別する。\n'
for path in ['docs/AI-INDEX.md','docs/PLAN-REGISTER.md']:
    original=content(path,head)
    assert '## v81 最新版への無劣化性能実装' not in original,'already published'
    files[path]=original+entry
plan='docs/superpowers/plans/2026-10-20-zero-degradation-mobile-desktop-performance.md'
original=content(plan,head)
assert '## v81 最新版への実装追記' not in original
files[plan]=original+'\n\n## v81 最新版への実装追記（2026-10-20）\n\n本計画を人間の承認により最新版へ実装した。[恒久標準](../../performance/PERFORMANCE-STANDARD.md)と[最新の採否・計測](../../performance/2026-10-20-v81-lossless-results.md)を参照。上記の当初計画・旧lv76の証跡は保持する。Worker/GPU等の未採用候補や実機未検証を実装済みへ変更しない。実装commit `'+implementation+'`。\n'
tree=[]
for path,text in files.items():
    blob=api('git/blobs',{'content':text,'encoding':'utf-8'})
    tree.append({'path':path,'mode':'100644','type':'blob','sha':blob['sha']})
created_tree=api('git/trees',{'base_tree':base['tree']['sha'],'tree':tree})
commit=api('git/commits',{'message':'docs: standardize verified v81 lossless performance boundaries','tree':created_tree['sha'],'parents':[head]})
# PATCH preserves optimistic fast-forward behavior; never force a concurrent head.
subprocess.run(['gh','api','--method','PATCH','repos/'+repository+'/git/refs/heads/'+branch,'--input','-'],input=json.dumps({'sha':commit['sha'],'force':False}),text=True,encoding='utf-8',capture_output=True,check=True)
assert api('git/ref/heads/'+branch)['object']['sha']==commit['sha']
checks={}
for path,text in files.items():
    observed=content(path,commit['sha']);assert observed==text,path
    checks[path]=hashlib.sha256(text.encode('utf-8')).hexdigest()
result={'pass':True,'branch':branch,'previousHead':head,'designCommit':commit['sha'],'implementationCommit':implementation,'documentsOnly':True,'remoteDocumentsSha256':checks}
Path('docs/verification/releases/v81/design-publication.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
