import { expect, it } from 'vitest';
import * as terminal from './ActualFoulTerminalApplication';
// Synthetic syntax-only packets. They confer no accepted or physical authority.
const common=()=>({sourceId:'boundary',sourceVersion:'v2',capability:'actual_foul_terminal_post_play_setup_v2',
 terminalReference:{owner:'actual_foul_terminal_applications',sourceId:'terminal',sourceVersion:'v1',sourceHash:'a'.repeat(64),proposalHash:'b'.repeat(64)},
 controllerReset:'rule_system_retire_original_play'});
const half=()=>({...common(),kind:'half_change_continuing',nextStartedAtTick:100,worldSetup:{
 baseCenters:{first:{x:1,z:1},second:{x:0,z:2},third:{x:-1,z:1}},
 defenders:['P','C','1B','2B','3B','SS','LF','CF','RF'].map((registeredPosition,i)=>({playerId:'incoming-'+i,registeredPosition,position:{x:i,z:i}})),
 activePreviousPlayControllerIds:[]}});
const final=()=>({...common(),kind:'game_final',completedAtTick:100});
const parser=(name='actualFoulTerminalPostPlayBoundaryInput')=>{
 const fn=(terminal as unknown as Record<string,unknown>)[name];expect(typeof fn,'BOUNDARY_PARSER_MISSING').toBe('function');
 return fn as (raw:unknown,id:string)=>any;
};
it('BF-P01 captures exact half and final packets inertly and deeply freezes them',()=>{
 for(const packet of [half(),final()]){const parsed=parser()(packet,'boundary');expect(parsed).toEqual(packet);expect(parsed).not.toBe(packet);expect(Object.isFrozen(parsed)).toBe(true);}
 const packet=half(),parsed=parser()(packet,'boundary');packet.worldSetup.defenders[0].position.x=77;expect(parsed.worldSetup.defenders[0].position.x).toBe(0);
});
it('BF-P02 rejects missing extra and final activation fields',()=>{
 const parse=parser();for(const packet of [half(),final()])for(const key of Object.keys(packet)){const copy:any=structuredClone(packet);delete copy[key];expect(()=>parse(copy,'boundary')).toThrow();}
 for(const key of ['worldSetup','nextStartedAtTick','activation','nextWorld','receipt','score','winnerClubId'])expect(()=>parse({...final(),[key]:half().worldSetup},'boundary')).toThrow();
 expect(()=>parse({...half(),completedAtTick:100},'boundary')).toThrow();
});
it('BF-P03 rejects malformed discriminants ticks references and controller syntax',()=>{
 const parse=parser();for(const patch of [{kind:'continue'},{sourceId:'other'},{sourceVersion:''},{capability:'actual_foul_terminal_post_play_setup_v1'},{controllerReset:'retired'},
 {completedAtTick:-1},{completedAtTick:0.5},{completedAtTick:Number.MAX_SAFE_INTEGER+1},{terminalReference:{...common().terminalReference,sourceHash:'bad'}}])expect(()=>parse({...final(),...patch},'boundary')).toThrow();
 expect(()=>parse({...half(),worldSetup:{...half().worldSetup,activePreviousPlayControllerIds:['old']}},'boundary')).toThrow();
});
it('BF-P04 dispatcher preserves exact v1 and never admits v2 through the v1 parser',()=>{
 const {kind,...raw}=half();const v1={...raw,capability:'actual_foul_terminal_post_play_setup_v1'};
 const parse=parser('actualFoulTerminalPostPlayInput');expect(parse(v1,'boundary')).toEqual(terminal.actualFoulTerminalPostPlaySetupInput(v1,'boundary'));
 expect(parse(final(),'boundary')).toEqual(final());expect(()=>terminal.actualFoulTerminalPostPlaySetupInput(half(),'boundary')).toThrow();
 expect(()=>parse({...final(),capability:'unknown'},'boundary')).toThrow();
});
it('BF-P05 rejects accessors without invoking them even when inspecting capability',()=>{
 const parse=parser('actualFoulTerminalPostPlayInput');let calls=0;const raw=final();Object.defineProperty(raw,'capability',{enumerable:true,get(){calls++;return 'actual_foul_terminal_post_play_setup_v2';}});
 expect(()=>parse(raw,'boundary')).toThrow();expect(calls).toBe(0);
});
