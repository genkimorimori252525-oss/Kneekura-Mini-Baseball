import assert from 'node:assert/strict';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyPinnedLiveCore} from './live-debug-core.mjs';
import {replaceDebugPageCore} from './live-debug-case.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const once=(s,a,b,label)=>{const i=s.indexOf(a);assert(i>=0,label+' missing');assert.equal(s.indexOf(a,i+a.length),-1,label+' not unique');return s.slice(0,i)+b+s.slice(i+a.length)};
export function transformMatchGameV250(html,{embedded,uiSource}) {
 assert(typeof html==='string'&&typeof embedded==='boolean'&&typeof uiSource==='string'&&!/<\/script/i.test(uiSource),'invalid game input');
 const control='<label>方向のおまかせ<select id="match-auto-direction-v250"><option value="legacy" selected>従来</option><option value="observed">観測に応じて両軍へ適用</option></select></label><span id="match-auto-direction-status-v250" role="status">変更は次の試合から適用されます。</span>';
 let s=once(html,'<div class="manager-actions"><label>試合の長さ','<div class="manager-actions">'+control+'<label>試合の長さ','settings');
 s=once(s,'<script id="v33-offline-core-match">','<script id="match-auto-direction-helper-v250">\n'+uiSource+'\n</script>\n<script id="v33-offline-core-match">','helper script');
 s=once(s,'observedMatch,activeConfiguration,lastFailure=null','observedMatch,activeConfiguration,activeAutoDirectionV250={},lastFailure=null','active state');
 s=once(s,"const nextConfiguration={seedText,seed:hashSeed(seedText),innings:Number($('inning-limit').value)||9},","const nextAutoDirectionV250=$('match-auto-direction-v250').value,\n   nextAutoDirectionPolicyV250=window.KneekuraMatchAutoDirectionV250.forNextGame(core,nextAutoDirectionV250,"+String(embedded)+"),\n   nextConfiguration={seedText,seed:hashSeed(seedText),innings:Number($('inning-limit').value)||9},",'configuration');
 const normal='teams,players:nextSeason.players,park,measuredClips:measured.clips})',existing='teams,players:nextSeason.players,park,measuredClips:measured.clips,batterObservationV151:core.AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:core.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:core.AUTHORED_MATCH_RANDOMNESS_V152,batterObservedRegionExperienceV222:core.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222})';
 const original=embedded?existing:normal;
 s=once(s,original,original.slice(0,-2)+',...nextAutoDirectionPolicyV250})','worker configuration');
 assert(s.includes('configuration:workerConfigurationV116,initialHost:core.createLiveBaseballMatchV1(workerConfigurationV116)'),'host and worker configuration differs');
 s=once(s,"$('match-seed').value=seedText;activeConfiguration=nextConfiguration;", "$('match-seed').value=seedText;activeConfiguration=nextConfiguration;activeAutoDirectionV250=nextAutoDirectionPolicyV250;\n  $('match-auto-direction-status-v250').dataset.active=nextAutoDirectionV250==='observed'?'観測に応じて両軍へ適用':'従来';$('match-auto-direction-status-v250').textContent='現試合: '+$('match-auto-direction-status-v250').dataset.active;",'active commit');
 s=once(s,"$('new-game').onclick=()=>{try{createGame(true);}catch(error){fail(error);}};", "$('new-game').onclick=()=>{try{createGame(true);}catch(error){fail(error);}};\n $('match-auto-direction-v250').onchange=()=>{$('match-auto-direction-status-v250').textContent='現試合: '+$('match-auto-direction-status-v250').dataset.active+'（変更は次の試合から）';};",'pending');
 s=once(s,'configuration:{innings:activeConfiguration.innings,teams,players,physicalRoster:activeRoster','configuration:{...window.KneekuraMatchAutoDirectionV250.summary(activeAutoDirectionV250),innings:activeConfiguration.innings,teams,players,physicalRoster:activeRoster','summary');
 return s;
}
export function transformMakerGamesV250(html,{uiSource}) {
 const owners=new Set(['globalThis.KneekuraMakerMatchHtmlV70','globalThis.KneekuraMakerPitcherMatchHtmlV77']),seen=new Set(),edits=[];
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  const body=match[1];if(![...owners].some(x=>body.includes(x)))continue;
  const start=match.index+match[0].indexOf('>')+1,source=ts.createSourceFile('maker-inline.js',body,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(source.parseDiagnostics.length,0,'invalid maker script');
  function visit(node){if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&owners.has(node.left.getText(source))){const owner=node.left.getText(source);assert(!seen.has(owner),'duplicate embedded game');assert(ts.isStringLiteral(node.right),'embedded game must be string literal');seen.add(owner);const game=transformMatchGameV250(node.right.text,{embedded:true,uiSource});edits.push({start:start+node.right.getStart(source),end:start+node.right.getEnd(),text:JSON.stringify(game).replace(/</g,'\\u003c')});}ts.forEachChild(node,visit)}visit(source);
 }
 assert.equal(seen.size,owners.size,'both embedded games required');edits.sort((a,b)=>b.start-a.start);let out=html;for(const e of edits)out=out.slice(0,e.start)+e.text+out.slice(e.end);return {html:out,embeddedGameCount:seen.size};
}
async function main(args){
 const o={};for(let i=0;i<args.length;i+=2){assert(/^--(game|maker|native|out)$/.test(args[i])&&args[i+1],'expected named arguments');const k=args[i].slice(2);assert(!Object.hasOwn(o,k),'duplicate option');o[k]=args[i+1]};assert(['game','maker','native','out'].every(k=>o[k]),'game maker native out required');
 const root=process.cwd(),out=resolve(root,o.out),rel=relative(root,out);assert(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
 const ui='tools/browser-bridge/live-match-auto-direction-v250.js',paths=[o.game,o.maker,o.native,ui,'tools/verification/prepare-match-auto-v250.mjs'];const pins={};for(const p of paths){const b=await readFile(p);pins[p]={bytes:b.length,sha256:sha(b)}}
 const {manifest,code}=await verifyPinnedLiveCore({root,manifestPath:o.native});assert.equal(manifest.target,'native');const [game,maker,uiSource]=await Promise.all([readFile(o.game,'utf8'),readFile(o.maker,'utf8'),readFile(ui,'utf8')]);
 const gameOut=transformMatchGameV250(replaceDebugPageCore(game,code).html,{embedded:false,uiSource}),makerOut=transformMakerGamesV250(maker,{uiSource});
 // Reject a Maker whose two embedded games contain a different native Core.
 let pinnedEmbeddedCount=0;for(const match of maker.matchAll(/globalThis\.(?:KneekuraMakerMatchHtmlV70|KneekuraMakerPitcherMatchHtmlV77)=("(?:\\.|[^"\\])*")/g)){const embedded=JSON.parse(match[1]);assert.equal(replaceDebugPageCore(embedded,code).previousCore,code.replace(/\n$/, ''),'embedded native Core differs');pinnedEmbeddedCount++}assert.equal(pinnedEmbeddedCount,2,'both embedded native cores must be pinned');
 for(const [p,v] of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,v.bytes);assert.equal(sha(b),v.sha256,'input changed: '+p)}await verifyPinnedLiveCore({root,manifestPath:o.native});
 await mkdir(out);await writeFile(resolve(out,'game.html'),gameOut,{flag:'wx'});await writeFile(resolve(out,'maker.html'),makerOut.html,{flag:'wx'});await writeFile(resolve(out,'manifest.json'),JSON.stringify({version:'match_auto_direction_ui_candidate_v250',pins,native:manifest.entry,gameSha256:sha(gameOut),makerSha256:sha(makerOut.html),embeddedGameCount:makerOut.embeddedGameCount},null,2)+'\n',{flag:'wx'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main(process.argv.slice(2));
