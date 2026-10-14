import { expect,it } from 'vitest';
import { samePaInitialLiveTransitionBoundary as boundary } from './SamePlateAppearanceInitialLiveContinuationFromSqlite';
const ref=(owner:string,sourceId=owner)=>({owner,sourceId,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)}) as any;
const launch=(id:string)=>({reference:ref('pa_physical_v1_launches',id),physical:{kind:'same_pa_physical_launch_v1',source:{sourceId:id}}}) as any;
const taken=()=>({reference:ref('pa_physical_v1_resolutions'),physical:{kind:'same_pa_physical_resolution_v1',resolution:{kind:'recorded_take'},timeline:{status:{kind:'active'}}}}) as any;
const field=()=>({reference:ref('pa_physical_v1_field_roots'),physical:{kind:'same_pa_physical_field_root_v1'}}) as any;
it('carries the owned TAKE abstraction into the selected field without requiring a hand path',()=>{
  expect(boundary('current',[launch('prior'),taken(),launch('current'),field()])).toBeNull();
});
it('retains known current-pitch declarations for the existing exact-clock live history',()=>{
  expect(boundary('current',[launch('current'),field(),{reference:ref('pa_live_ball_v1_actions'),physical:null,livePitchSourceId:'current'}])).toBeNull();
});
it.each(['pa_lifecycle_v1_outcomes','pa_lifecycle_v1_resets','pa_live_ball_v1_actions'])('does not carry initial Play across %s',owner=>{
  expect(boundary('current',[{reference:ref(owner),physical:null},launch('current'),field()])).toMatch(/restart/);
});
it('does not cross an earlier field episode or a missing completed TAKE',()=>{
  expect(boundary('current',[launch('prior'),field(),launch('current'),field()])).toMatch(/prior_field/);
  expect(boundary('current',[launch('prior'),launch('current'),field()])).toMatch(/completed_taken/);
  expect(boundary('current',[launch('prior'),{...taken(),physical:{kind:'same_pa_physical_resolution_v1',resolution:{kind:'recorded_take'},timeline:{status:{kind:'strikeout'}}}},launch('current')])).toMatch(/nonterminal/);
});
