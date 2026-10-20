import concurrent.futures,hashlib,json,subprocess,sys,urllib.parse,urllib.request
from pathlib import Path

commit=sys.argv[1];output=Path(sys.argv[2] if len(sys.argv)>2 else 'docs/verification/releases/v69/publication.json')
branch='jolly/tbd-lad-native-browser-core-2026-10-14'
remote=subprocess.check_output(['git','ls-remote','origin','refs/heads/'+branch],text=True).split()[0]
pr=json.loads(subprocess.check_output(['gh','pr','view','380','--json','url,state,isDraft,headRefName,headRefOid'],text=True))
assert remote==commit and pr['headRefOid']==commit and pr['headRefName']==branch and pr['state']=='OPEN' and pr['isDraft']
paths=['docs/demos/releases/v69/'+p for p in ['maker.html','SHA256.json','maker.html.build.json','maker.html.bundle-inputs.json','README.md']]
paths+=['docs/reports/2026-10-19-v69-ball-comparison-and-zoom.md','docs/handoffs/LATEST.md','docs/demos/baseball-maker-ui.mjs','docs/demos/baseball-maker-ball-comparison-v69.js','docs/demos/baseball-maker-ball-comparison-v69.css','src/integration/browser/MeasuredTrajectoryComparisonWorkbenchV69.ts','docs/verification/releases/v69/release-check.json']
sha=lambda b:hashlib.sha256(b).hexdigest()
def check(path):
 url='https://raw.githubusercontent.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/'+commit+'/'+urllib.parse.quote(path,safe='/')
 with urllib.request.urlopen(url,timeout=60) as r:data=r.read()
 local=Path(path).read_bytes();assert data==local,path
 return {'path':path,'sha256':sha(local),'bytes':len(local)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(check,paths))
report={'pass':True,'sourceCommit':commit,'remoteHead':remote,'pullRequest':pr,'rawFiles':files,'mainMerged':False}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'pass':True,'commit':commit,'rawFiles':len(files),'draft':True}))
