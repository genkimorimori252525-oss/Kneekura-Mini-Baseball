import hashlib
import json
import subprocess
from pathlib import Path

target=Path('work/v81-reproduce').resolve()
subprocess.run(['node','tools/browser-bridge/build-lossless-release-v81.mjs',str(target)],check=True,stdout=subprocess.DEVNULL)
names={'game.html':'ばせぼーるlv81_TBD_vs_LAD_無劣化性能改善版.html','camera-workbench.html':'カメラワーク調整室_v81.html','maker.html':'にーくら野球メーカー_v81_無劣化性能改善版.html'}
hashes={}
for filename,name in names.items():
    rebuilt=(target/name).read_bytes()
    assert rebuilt==Path('docs/demos/releases/v81',filename).read_bytes(),filename
    hashes[filename]=hashlib.sha256(rebuilt).hexdigest()
result={'pass':True,'rebuildEntry':'tools/browser-bridge/build-lossless-release-v81.mjs','allThreeHtmlBytesEqual':True,'hashes':hashes}
Path('docs/verification/releases/v81/reproduce-check.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
