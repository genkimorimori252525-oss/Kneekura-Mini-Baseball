import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const manifests=JSON.parse(await readFile(resolve(home,'PACKAGE-MANIFEST.json'),'utf8')),report={pass:false,files:0,links:0,privatePaths:0,credentialPatterns:0};
for(const f of manifests.files){const b=await readFile(resolve(root,f.path));assert.equal(sha(b),f.sha256,f.path);assert.equal(b.length,f.bytes,f.path);report.files++;
 if(/\.(md|json|mjs|js|html|css)$/.test(f.path)){const s=b.toString();assert(!/[A-Z]:[\\/]+Users[\\/]+genki[\\/]/i.test(s),'Personal path '+f.path);assert(!/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s),'Credential pattern '+f.path);if(f.path.endsWith('.json'))JSON.parse(s);}
 if(f.path.startsWith('ballpark-production/')&&f.path.endsWith('.md'))for(const m of b.toString().matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)){
  const link=m[1];if(/^(https?:|#)/.test(link))continue;const target=resolve(dirname(resolve(root,f.path)),decodeURIComponent(link.split('#')[0]));assert(!relative(root,target).startsWith('..'));await import('node:fs/promises').then(fs=>fs.access(target));report.links++;
 }
}
report.pass=true;await mkdir(resolve(home,'validation'),{recursive:true});await writeFile(resolve(home,'validation/package-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
