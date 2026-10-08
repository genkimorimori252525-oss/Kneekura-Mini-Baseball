import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayFields as fields,actualLivePlayId as id } from './ActualLivePlayScope';
import { foulOfficialDigest as digest } from './ActualFoulOfficialSource';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFoulTerminalPostPlaySetupInput,type AcceptedFoulTerminalPostPlaySetup,type FoulTerminalPostPlayReference } from './ActualFoulTerminalPostPlaySetup';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
type Common=Readonly<{sourceId:string;sourceVersion:string;capability:'actual_foul_terminal_post_play_setup_v2';
 terminalReference:FoulTerminalPostPlayReference;controllerReset:'rule_system_retire_original_play'}>;
export type AcceptedFoulTerminalPostPlayBoundary=Common & (
 Readonly<{kind:'half_change_continuing';nextStartedAtTick:number;worldSetup:BetweenPlayWorldSetup}>
 |Readonly<{kind:'game_final';completedAtTick:number}>);
export type AcceptedFoulTerminalPostPlayInput=AcceptedFoulTerminalPostPlaySetup|AcceptedFoulTerminalPostPlayBoundary;
/** Syntax only: a v2 request never supplies the authoritative transition/result. */
export const actualFoulTerminalPostPlayBoundaryInput=(raw:unknown,sourceId:string):AcceptedFoulTerminalPostPlayBoundary=>{
 const s=cloneInert(raw) as AcceptedFoulTerminalPostPlayBoundary;
 if(!s||!['half_change_continuing','game_final'].includes(s.kind)
  ||!fields(s,['sourceId','sourceVersion','capability','terminalReference','controllerReset','kind',...(s.kind==='game_final'?['completedAtTick']:['nextStartedAtTick','worldSetup'])])
  ||s.sourceId!==sourceId||![sourceId,s.sourceVersion].every(id)||s.capability!=='actual_foul_terminal_post_play_setup_v2'
  ||s.controllerReset!=='rule_system_retire_original_play')throw new Error('invalid accepted foul terminal boundary Source');
 const r=s.terminalReference;
 if(!fields(r,['owner','sourceId','sourceVersion','sourceHash','proposalHash'])||r.owner!=='actual_foul_terminal_applications'
  ||![r.sourceId,r.sourceVersion].every(id)||![r.sourceHash,r.proposalHash].every(digest))throw new Error('invalid foul terminal boundary reference');
 if(s.kind==='game_final'){
  if(!Number.isSafeInteger(s.completedAtTick)||s.completedAtTick<0)throw new Error('invalid foul terminal final completion tick');
 }else{
  actualFoulTerminalPostPlaySetupInput({sourceId:s.sourceId,sourceVersion:s.sourceVersion,capability:'actual_foul_terminal_post_play_setup_v1',
   terminalReference:r,controllerReset:s.controllerReset,nextStartedAtTick:s.nextStartedAtTick,worldSetup:s.worldSetup},sourceId);
 }
 return freeze(s);
};
export const actualFoulTerminalPostPlayInput=(raw:unknown,sourceId:string):AcceptedFoulTerminalPostPlayInput=>{
 const s=cloneInert(raw) as AcceptedFoulTerminalPostPlayInput;
 if(s?.capability==='actual_foul_terminal_post_play_setup_v1')return actualFoulTerminalPostPlaySetupInput(s,sourceId);
 if(s?.capability==='actual_foul_terminal_post_play_setup_v2')return actualFoulTerminalPostPlayBoundaryInput(s,sourceId);
 throw new Error('unsupported foul terminal post-play Source capability');
};
