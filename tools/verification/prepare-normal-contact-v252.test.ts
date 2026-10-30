import {stringifyDebugRecord,parseDebugRecord} from './live-debug-record.mjs';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';import {runInNewContext,Script} from 'node:vm';
import * as core from '../../src/integration/browser/LocalContactDescriptorReportV240';
import {transformNormalContactGameV252} from './prepare-normal-contact-v252.mjs';
const source=readFileSync('tools/browser-bridge/live-match-contact-v252.js','utf8'),sandbox:{KneekuraLiveMatchContactV252?:any}={};runInNewContext(source,sandbox);const api=sandbox.KneekuraLiveMatchContactV252!;
const binding={sessionId:'session',configId:'configuration',buildId:'build'};
const record=(player:string,playId:number,angle:number|null,classification='live_ball')=>{const a=(angle??0)*Math.PI/180;return {batterPlayerId:player,beforeMatch:{playId},play:{classification,contact:angle===null?null:{},contactMoment:angle===null?null:{ball:{tick:123}},outgoingBallMoment:angle===null?null:{ball:{velocity:{x:0,y:Math.sin(a),z:Math.cos(a)}}}}}};
describe('normal accepted contact ledger',()=>{
 it('counts every accepted contact by batter, including foul and bunt; no contact is excluded',()=>{const ledger=api.createLedger(core,binding);expect(ledger.accept(record('a',1,null),0,1)).toBe('NO_CONTACT');expect(ledger.accept(record('a',2,10,'foul'),1,2)).toBe('ADDED');expect(ledger.accept(record('b',3,20,'bunt'),2,3)).toBe('ADDED');const reports=ledger.reports();expect(reports.map((r:any)=>r.binding.playerId)).toEqual(['a','b']);expect(reports.map((r:any)=>core.projectLocalLineDriveAngleReferenceV249(r).totalContacts)).toEqual([1,1]);expect(reports[0].contacts[0].pitchOrdinal).toBe(2);expect(reports[1].contacts[0].pitchOrdinal).toBe(3);});
 it('keeps prior records on duplicates, conflict, foreign identity and ordinal gaps',()=>{const ledger=api.createLedger(core,binding),one=record('a',1,15);expect(ledger.accept(one,0,1)).toBe('ADDED');expect(ledger.accept(one,0,1)).toBe('DUPLICATE');expect(()=>ledger.accept(record('a',1,20),0,1)).toThrow(/conflict/i);expect(()=>ledger.accept(record('b',1,15),0,1)).toThrow(/conflict/i);expect(()=>ledger.accept(record('a',3,15),2,3)).toThrow(/ordinal/i);expect(ledger.reports()[0].contacts).toHaveLength(1);});
 it('starts a clean separate session',()=>{const a=api.createLedger(core,binding);a.accept(record('a',1,15),0,1);const b=api.createLedger(core,{...binding,sessionId:'next'});expect(b.reports()).toEqual([]);});
});
it('injects only after accepted history and restores the original source exactly',()=>{const html=readFileSync('work/match-auto-v250-ui-candidate-01/game.html','utf8');const out=transformNormalContactGameV252(html,{uiSource:source});expect(out.html.indexOf('season.acceptPitch(result);records.push')).toBeLessThan(out.html.indexOf('KneekuraLiveMatchContactV252.acceptAfterHistory'));expect(out.html).toContain('before.pitchCount,thisHost.inspect().pitchCount');expect(out.html).toContain('<script id="normal-match-contact-helper-v252">');expect(out.html).not.toContain('<script id="normal-match-contact-v252">');expect(out.reverse()).toBe(html);for(const script of out.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/type\s*=\s*["']application\/json/i.test(script[1]))new Script(script[2]);}});
it('keeps accepted records on collector errors and reports the error in the local panel',()=>{
 const status={textContent:''},results={children:[] as any[],replaceChildren(){this.children=[]},append(x:any){this.children.push(x)}};
 const panel={id:'',innerHTML:'',querySelector:(selector:string)=>selector==='[data-contact-status]'?status:results};
 const container={after:()=>{}};let n=0;
 const ctx:any={document:{createElement:(tag:string)=>tag==='section'?panel:{textContent:''},querySelector:()=>container},crypto:{randomUUID:()=>String(++n)}};runInNewContext(source,ctx);
 const ui=ctx.KneekuraLiveMatchContactV252,accepted=[record('a',1,15)];ui.reset(core);ui.acceptAfterHistory(core,accepted[0],0,1);expect(results.children).toHaveLength(2);expect(results.children[1].textContent).toContain('投球 1');
 ui.acceptAfterHistory(core,record('a',1,25),0,1);expect(status.textContent).toMatch(/conflict/i);expect(accepted).toHaveLength(1);expect(results.children).toHaveLength(2);
 ui.reset(core);expect(status.textContent).toBe('');expect(results.children[0].textContent).toContain('0件');
});
it('places collection behind the actual host, game and accepted history guards',()=>{
 const html=readFileSync('work/match-auto-v250-ui-candidate-01/game.html','utf8'),out=transformNormalContactGameV252(html,{uiSource:source}).html;
 const issue=out.slice(out.indexOf(' async function issue(){'),out.indexOf(' function animate(){',out.indexOf(' async function issue(){')));
 const guard=issue.indexOf('if(thisGame!==gameToken||host!==thisHost||!result)return null;'),accepted=issue.indexOf('records.push('),collect=issue.indexOf('KneekuraLiveMatchContactV252.acceptAfterHistory');
 expect(guard).toBeGreaterThan(-1);expect(guard).toBeLessThan(accepted);expect(accepted).toBeLessThan(collect);expect(issue.match(/KneekuraLiveMatchContactV252\.acceptAfterHistory/g)).toHaveLength(1);
});
it('shows the official roster name as text while retaining player IDs and falls back for unknown names',()=>{
 const status={textContent:''},results={children:[] as any[],replaceChildren(){this.children=[]},append(x:any){this.children.push(x)}};
 const panel={id:'',innerHTML:'',querySelector:(selector:string)=>selector==='[data-contact-status]'?status:results};const container={after:()=>{}};let n=0;
 const ctx:any={document:{createElement:(tag:string)=>tag==='section'?panel:{textContent:''},querySelector:()=>container},crypto:{randomUUID:()=>String(++n)}};runInNewContext(source,ctx);
 const ui=ctx.KneekuraLiveMatchContactV252;ui.reset(core,{a:{name:'選手 <一>'}});ui.acceptAfterHistory(core,record('a',1,15),0,1);ui.acceptAfterHistory(core,record('b',2,15),1,2);
 expect(results.children[0].textContent).toContain('選手 <一>');expect(results.children[0].textContent).not.toContain('a ／');expect(results.children[2].textContent).toContain('b ／');
 const html=readFileSync('work/match-auto-v250-ui-candidate-01/game.html','utf8'),out=transformNormalContactGameV252(html,{uiSource:source}).html;expect(out).toContain('KneekuraLiveMatchContactV252.reset(core,playerById)');
});
it('injects archive sources and lossless codec without altering the original game outside that seam',()=>{
 const html=readFileSync('work/match-auto-v250-ui-candidate-01/game.html','utf8'),archiveSource=readFileSync('tools/browser-bridge/live-match-contact-archive-v253.js','utf8'),archiveUiSource=readFileSync('tools/browser-bridge/live-match-contact-archive-v253-ui.js','utf8'),codecSource='globalThis.KneekuraContactArchiveCodecV253={stringify:'+stringifyDebugRecord.toString()+',parse:'+parseDebugRecord.toString()+'};',out=transformNormalContactGameV252(html,{uiSource:source,archiveSource,archiveUiSource,codecSource});
 expect(out.reverse()).toBe(html);expect(out.html).toContain('<script id="normal-contact-archive-v253">');for(const m of out.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/type\s*=\s*["']application\/json/i.test(m[1]))new Script(m[2]);
 expect(()=>transformNormalContactGameV252(html,{uiSource:source,archiveSource})).toThrow();
});
