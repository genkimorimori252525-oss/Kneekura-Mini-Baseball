import{readFileSync as read,writeFileSync as write}from'node:fs';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=p=>JSON.parse(read(p,'utf8')),
 current=json('docs/verification/spin-trial-v124/integrity.json'),prior=json('docs/verification/traits-spin-continuation-v123/integrity.json'),
 older=json('docs/verification/swing-remainder-v122/integrity.json');
const artifacts=[...current.artifacts,...current.delivery,...prior.artifacts,...prior.delivery,...older.artifacts];
for(const a of artifacts){const bytes=read(a.path);assert.equal(sha(bytes),a.sha256,a.path);assert.equal(bytes.length,a.bytes);}
const pins=json(current.artifacts.find(a=>a.path.includes('ばせぼーる')).path+'.bundle-inputs.json');
assert.equal(Object.keys(pins.inputs).length,195);
for(const[path,hash]of Object.entries(pins.inputs))assert.equal(sha(read(path)),hash,'browser runtime input changed '+path);
const report={boundary:'ARTIFACT_AND_BROWSER_RUNTIME_INPUT_PRESERVATION_NOT_ALL_CURRENT_SOURCES',pass:true,
 currentVersion:124,sourceCoreSha256:current.sourceCoreSha256,unchangedBrowserInputs:195,protectedArtifacts:artifacts.length,
 nativeSqliteAndUnexportedSignatureOutsideBrowserBundle:true,goalComplete:false};
write('docs/verification/spin-trial-v124/preservation-v125.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
