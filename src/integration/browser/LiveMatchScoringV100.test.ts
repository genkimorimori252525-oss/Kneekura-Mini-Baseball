import {expect,it} from 'vitest';
import {classifyLocalScoringV100,type LocalScoringEvidenceV100} from './LiveMatchScoringV100';
const base=():LocalScoringEvidenceV100=>({playId:1,batterRunnerId:'b',endedAtTick:1000,ended:true,classification:'live_ball',outsBefore:0,bunt:false,
 initialBases:{b:0},touches:[{runnerId:'b',base:1,tick:300}],outs:[],scoredRunnerIds:[],firstChoice:null,candidates:[],
 ordinary:{available:true,outRunnerIds:[],furthestBases:{b:1},flyCaught:false,scoredRunnerIds:[]}});
it('credits a clean hit including a later tag out without converting normal throw variation into an error',()=>{
 const e=base();expect(classifyLocalScoringV100(e)).toMatchObject({status:'confirmed',hits:1,hitBases:1,ab:1,errors:[]});
 expect(classifyLocalScoringV100({...e,outs:[{runnerId:'b',tick:800,classification:'time_play'}]})).toMatchObject({hits:1,hitBases:1});
});
it('credits a hit and a separate later throwing error, with one error for multiple extra bases',()=>{
 const e=base();e.touches.push({runnerId:'b',base:2,tick:700},{runnerId:'b',base:3,tick:900});
 e.candidates.push({id:'throw-1',tick:500,fielderId:'rf',kind:'throwing'});
 const scored=classifyLocalScoringV100(e);expect(scored).toMatchObject({hits:1,hitBases:1,ab:1});expect(scored.errors).toHaveLength(1);
 expect(scored.errors[0]).toMatchObject({fielderId:'rf',reason:'extra_advance'});
});
it('requires an ordinary-effort lost out or extra base before charging a mechanical failure',()=>{
 const e=base();e.candidates.push({id:'field-1',tick:150,fielderId:'ss',kind:'fielding'});
 expect(classifyLocalScoringV100(e)).toMatchObject({hits:1,errors:[]});
 e.ordinary.outRunnerIds=['b'];e.ordinary.furthestBases.b=0;
 expect(classifyLocalScoringV100(e)).toMatchObject({hits:0,classification:'reached_on_error',errors:[{fielderId:'ss',reason:'lost_out'}]});
});
it('distinguishes force choice from a hit and preserves lack of scoring evidence as pending',()=>{
 const e=base();e.initialBases.r=1;e.outs.push({runnerId:'r',tick:200,classification:'force'});
 expect(classifyLocalScoringV100(e)).toMatchObject({hits:0,classification:'fielders_choice'});
 e.outs=[];e.firstChoice={tick:200,runnerId:'r',ordinaryFirstOutPossible:false};
 expect(classifyLocalScoringV100(e)).toMatchObject({hits:1});
 e.firstChoice.ordinaryFirstOutPossible=true;expect(classifyLocalScoringV100(e)).toMatchObject({hits:0,classification:'fielders_choice'});
 e.candidates=[{id:'throw-2',tick:100,fielderId:'ss',kind:'throwing'}];e.ordinary.available=false;
 expect(classifyLocalScoringV100(e)).toMatchObject({status:'pending',hits:null,errorsComplete:false});
});
it('records a dropped ordinary foul independently of a continuing plate appearance',()=>{
 const e={...base(),ended:false,classification:'foul',touches:[],candidates:[{id:'drop',tick:200,fielderId:'c',kind:'fielding' as const}]};
 e.ordinary.flyCaught=true;e.ordinary.outRunnerIds=['b'];
 expect(classifyLocalScoringV100(e)).toMatchObject({status:'in_progress',hits:null,ab:null,errors:[{fielderId:'c',reason:'extended_plate_appearance'}]});
});
it('keeps sacrifices and two independent errors distinct from AB and hit-base credit',()=>{
 const e=base();e.initialBases.r=2;e.touches.push({runnerId:'r',base:3,tick:600},{runnerId:'r',base:4,tick:950});
 e.candidates=[{id:'one',tick:400,fielderId:'rf',kind:'throwing'},{id:'two',tick:800,fielderId:'c',kind:'receiving'}];e.ordinary.furthestBases.r=2;
 expect(classifyLocalScoringV100(e).errors.map(v=>v.id)).toEqual(['one','two']);
 const fly={...base(),classification:'fly_out',initialBases:{b:0,r:3},outs:[{runnerId:'b',tick:200,classification:'batter_caught'}],scoredRunnerIds:['r']};
 expect(classifyLocalScoringV100(fly)).toMatchObject({ab:0,hits:0,classification:'sacrifice_fly'});
});
it('rejects future, duplicate, non-finite or inconsistent scoring candidates',()=>{
 const e=base();e.candidates=[{id:'x',tick:1001,fielderId:'ss',kind:'throwing'}];expect(()=>classifyLocalScoringV100(e)).toThrow();
 e.candidates=[{id:'x',tick:100,fielderId:'ss',kind:'throwing'},{id:'x',tick:120,fielderId:'ss',kind:'throwing'}];expect(()=>classifyLocalScoringV100(e)).toThrow();
});
it('can preserve a sacrifice while charging the independent physical error',()=>{
 const e=base();e.initialBases.r=1;e.bunt=true;e.ordinary.outRunnerIds=['b'];e.ordinary.furthestBases.r=2;
 e.candidates=[{id:'miss',tick:150,fielderId:'p',kind:'fielding'}];e.touches.push({runnerId:'r',base:2,tick:500});
 expect(classifyLocalScoringV100(e)).toMatchObject({ab:0,hits:0,classification:'sacrifice_bunt_error',errors:[{reason:'lost_out'}]});
});
it('does not charge a failed second-out throw without extra advancement, but can charge a dropped good throw',()=>{
 const e=base();e.initialBases.r=1;e.outs=[{runnerId:'r',tick:200,classification:'force'}];e.ordinary.outRunnerIds=['r','b'];e.ordinary.furthestBases.b=0;
 e.candidates=[{id:'relay-bad',tick:220,fielderId:'ss',kind:'throwing'}];
 expect(classifyLocalScoringV100(e).errors).toEqual([]);
 e.candidates[0].kind='receiving';expect(classifyLocalScoringV100(e).errors).toHaveLength(1);
});
it('does not charge a ground-ball bobble recovered in time for a force out, and recognizes late actual forces as FC',()=>{
 const e=base();e.initialBases.r=1;e.outs=[{runnerId:'r',tick:500,classification:'force'}];
 e.candidates=[{id:'bobble',tick:150,fielderId:'ss',kind:'fielding'}];e.ordinary.furthestBases.r=1;
 e.touches.push({runnerId:'r',base:2,tick:200});
 expect(classifyLocalScoringV100(e)).toMatchObject({hits:0,classification:'fielders_choice',errors:[]});
});
it('attributes a later lost out to its own opportunity rather than an earlier harmless failure',()=>{
 const e=base();e.ordinary.outRunnerIds=['b'];e.ordinary.outTicks={b:700};
 e.candidates=[{id:'harmless',tick:100,fielderId:'rf',kind:'fielding'},{id:'badthrow',tick:500,fielderId:'ss',kind:'throwing',targetRunnerId:'b'}];
 e.touches[0].tick=900;
 expect(classifyLocalScoringV100(e).errors.map(c=>c.id)).toEqual(['badthrow']);
 delete e.ordinary.outTicks;
 expect(classifyLocalScoringV100(e)).toMatchObject({status:'pending',errorsComplete:false,hits:null});
});
it('does not turn a faster reference out before the real misplay into a confirmed clean hit',()=>{
 const e=base();e.touches[0].tick=900;e.ordinary.outRunnerIds=['b'];e.ordinary.outTicks={b:400};
 e.candidates=[{id:'late',tick:500,fielderId:'ss',kind:'throwing',targetRunnerId:'b'}];
 expect(classifyLocalScoringV100(e)).toMatchObject({status:'pending',hits:null,errorsComplete:false,errors:[]});
});
