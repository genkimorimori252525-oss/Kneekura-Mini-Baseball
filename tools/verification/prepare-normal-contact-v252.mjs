import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPinnedLiveCore} from './live-debug-core.mjs';
import {replaceDebugPageCore} from './live-debug-case.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function transformNormalContactGameV252(html,{uiSource}){
 assert(typeof html==='string'&&typeof uiSource==='string'&&!/<\/script/i.test(uiSource),'invalid contact UI input');const changes=[];
 function once(before,after,label){const i=html.indexOf(before);assert(i>=0,label+' missing');assert.equal(html.indexOf(before,i+before.length),-1,label+' not unique');html=html.slice(0,i)+after+html.slice(i+before.length);changes.push({before,after})}
 once('<script id="v33-offline-core-match">','<script id="normal-match-contact-helper-v252">\n'+uiSource+'\n</script>\n<script id="v33-offline-core-match">','contact helper');
 once('season.acceptPitch(result);records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});','season.acceptPitch(result);records.push({...result,beforeLine,beforeFrame,batterRunStartedAtTick});\n  window.KneekuraLiveMatchContactV252.acceptAfterHistory(core,result,before.pitchCount,thisHost.inspect().pitchCount);','accepted result');
 once('host?.dispose?.();issuePendingV116=null;host=nextHost;season.beginGame(nextSeason);draw();','host?.dispose?.();issuePendingV116=null;host=nextHost;season.beginGame(nextSeason);window.KneekuraLiveMatchContactV252.reset(core,playerById);draw();','new match');
 const result=html;return {html:result,reverse:()=>{let value=result;for(const c of [...changes].reverse()){const i=value.indexOf(c.after);assert(i>=0&&value.indexOf(c.after,i+c.after.length)<0,'reverse seam differs');value=value.slice(0,i)+c.before+value.slice(i+c.after.length)}return value}};
}
async function main(args){const o={};for(let i=0;i<args.length;i+=2){assert(/^--(game|native|out)$/.test(args[i])&&args[i+1],'named arguments required');const k=args[i].slice(2);assert(!Object.hasOwn(o,k),'duplicate option');o[k]=args[i+1]}assert(['game','native','out'].every(k=>o[k]),'game native out required');const root=process.cwd(),out=resolve(root,o.out),rel=relative(root,out);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
 const ui='tools/browser-bridge/live-match-contact-v252.js',paths=[o.game,o.native,ui,'tools/verification/prepare-normal-contact-v252.mjs','tools/verification/live-debug-core.mjs','tools/verification/live-debug-case.mjs'];const pins={};for(const p of paths){const b=await readFile(p);pins[p]={bytes:b.length,sha256:sha(b)}}
 const {manifest,code}=await verifyPinnedLiveCore({root,manifestPath:o.native});assert.equal(manifest.target,'native');const [game,uiSource]=await Promise.all([readFile(o.game,'utf8'),readFile(ui,'utf8')]);const injected=replaceDebugPageCore(game,code).html,built=transformNormalContactGameV252(injected,{uiSource});assert.equal(built.reverse(),injected,'non-contact game content changed');
 for(const [p,pin]of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256,'input changed: '+p)}await verifyPinnedLiveCore({root,manifestPath:o.native});
 await mkdir(out);await writeFile(resolve(out,'game.html'),built.html,{flag:'wx'});await writeFile(resolve(out,'manifest.json'),JSON.stringify({version:'normal_match_contact_candidate_v252',pins,native:manifest.entry,gameSha256:sha(built.html),authority:'LOCAL_SESSION_ONLY_NO_CAREER'},null,2)+'\n',{flag:'wx'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main(process.argv.slice(2));
