import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=resolve(process.argv[2]),evidence=resolve(process.argv[3]),root=resolve('../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 checked=JSON.parse(await readFile(resolve(evidence,'verification.json'))),linkage=JSON.parse(await readFile(resolve(evidence,'linkage/linkage.json')));
assert.equal(checked.pass,true);assert.equal(linkage.pass,true);const rows=[];
for(const row of linkage.rows){const from=resolve(source,row.name),to=resolve(root,basename(row.name));assert.equal(sha(await readFile(from)),row.sha256);
 for(const suffix of ['', '.build.json',...(row.name.startsWith('ばせぼーる')?['.bundle-inputs.json','.audio-manifest.json']:[])]){
  const input=from+suffix,target=to+suffix,bytes=await readFile(input);let existing=null;try{existing=await readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(existing)assert.equal(sha(existing),sha(bytes),'will not overwrite a different artifact: '+target);else await copyFile(input,target,constants.COPYFILE_EXCL);
  assert.equal(sha(await readFile(target)),sha(bytes));rows.push({source:input,destination:target,sha256:sha(bytes),bytes:bytes.length,reusedIdentical:!!existing});
 }
}
await writeFile('docs/verification/releases/v100/publish.json',JSON.stringify({pass:true,source,evidence,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,files:rows.length,outputs:rows.filter(r=>r.destination.endsWith('.html'))}));
