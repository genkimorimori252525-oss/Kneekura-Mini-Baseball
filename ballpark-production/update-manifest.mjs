import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const source=JSON.parse(await readFile(resolve(home,'SOURCE-MANIFEST.json'),'utf8'));
for(const f of source.files){const b=await readFile(resolve(root,f.path));f.sha256=sha(b);f.bytes=b.length;f.sanitized=f.originalSha256!==f.sha256;}
await writeFile(resolve(home,'SOURCE-MANIFEST.json'),JSON.stringify(source,null,2)+'\n');
async function walk(dir){const paths=[];for(const e of await readdir(resolve(root,dir),{withFileTypes:true})){if(['node_modules','.build','dist','validation'].includes(e.name)||e.name==='PACKAGE-MANIFEST.json')continue;const p=dir+'/'+e.name;if(e.isDirectory())paths.push(...await walk(p));else paths.push(p);}return paths;}
const paths=[...await walk('ballpark-production'),...await walk('tools/ballpark-studio'),...await walk('docs/ballpark-studio'),'.gitattributes','README.md','AGENTS.md','docs/AI-INDEX.md','docs/PLAN-REGISTER.md'];
const files=[];for(const path of paths.sort()){const b=await readFile(resolve(root,path));files.push({path,bytes:b.length,sha256:sha(b)});}
await writeFile(resolve(home,'PACKAGE-MANIFEST.json'),JSON.stringify({version:1,date:'2026-10-25',files},null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0)}));
