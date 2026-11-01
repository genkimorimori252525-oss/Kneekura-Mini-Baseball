import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile('../../outputs/ばせぼーるlv110_TBD_vs_LAD_連携準備とグラブトス版.html', 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m => m[1].includes('var KneekuraNativeMatchCore ='))[1];
const realm = vm.createContext({}); vm.runInContext(source, realm);
const result = JSON.parse(vm.runInContext(`JSON.stringify((()=>{const api=KneekuraNativeMatchCore,p={releaseSpeedMps:42.5,spinRadPerSecond:{x:-230,y:15,z:10}},r=api.resolvePitcherRepertoireV77(p,'R').find(x=>x.pitchType==='curve').spinRadPerSecond,l=api.resolvePitcherRepertoireV77(p,'L').find(x=>x.pitchType==='curve').spinRadPerSecond;return{right:r,left:l,rightYNegativeZero:Object.is(r.y,-0),leftYNegativeZero:Object.is(l.y,-0),mirrored:r.x===l.x&&r.y===-l.y&&r.z===-l.z};})())`, realm));
assert(result.mirrored); console.log(JSON.stringify({ frozenV110: true, ...result }));
