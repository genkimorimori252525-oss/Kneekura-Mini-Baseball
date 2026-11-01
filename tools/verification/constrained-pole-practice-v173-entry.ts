import type { FieldPracticeRequestV98 } from '../../src/integration/browser/FieldPracticeWorkbenchV98';
type PublicCore = Pick<typeof import('../../src/integration/browser/index'), 'buildAverageFieldCaseV95'
  |'AVERAGE_FIELD_PROFILE_V95'|'resolveFieldPracticePlayersV98'>;
export type ConstrainedPolePracticeVariantV173 = 'omitted'|'far'|'near';
const roles=['P','C','1B','2B','3B','SS','LF','CF','RF'] as const;

/** Public authoring only: no private simulate function, replaced physical
 * validation, measured-player claim or special glove/body values. */
export function createConstrainedPolePracticeV173(core:PublicCore,variant:ConstrainedPolePracticeVariantV173):FieldPracticeRequestV98 {
  if(!['omitted','far','near'].includes(variant))throw Error('constrained practice v173: invalid variant');
  const ordinary=core.buildAverageFieldCaseV95({caseId:'SS_ground',seed:2025,bats:'R',parkRadiusMeters:110,maxPlaySeconds:.0000001}).input,
    ids=[...roles.map(role=>'def-'+role),'runner-0'],
    players=core.resolveFieldPracticePlayersV98(ids.map(playerId=>({playerId,name:'Public reference '+playerId,
      heightMeters:1.8,bats:'R' as const,throws:'R' as const,physical:core.AVERAGE_FIELD_PROFILE_V95.physical}))),
    radius=ordinary.physics.ground.radiusM,wallZ=ordinary.field.fenceRadiusMeters-radius,
    // The 100 nm gap is reachable at the authored 2 m/s within this
    // 100 ns horizon. The old .14 m center was 3.4 mm outside reach.
    poleCenter=variant==='near'?{x:radius+.1+.0000001,z:wallZ}:{x:0,z:-35};
  return {fieldInput:{
    ball:{originTick:100000,elapsedSeconds:.123456789,ball:{tick:223457,
      position:{x:0,y:radius,z:wallZ},velocity:{x:2,y:0,z:.001},spin:{x:0,y:0,z:0}}},
    orientation:{w:1,x:0,y:0,z:0},physics:ordinary.physics,seed:2025,
    field:{...ordinary.field,...(variant==='omitted'?{}:{poleEquipmentV148:{version:'source_free_pole_session_v148' as const,
      poles:[{surfaceId:'public-practice-pole-v173',center:poleCenter,minimumHeight:0,maximumHeight:3,radiusM:.1}],
      materials:[{surfaceId:'public-practice-pole-v173',material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}})},
    outs:2,maxPlaySeconds:.0000001,frameSeconds:.055,
    defense:Object.fromEntries(roles.map(role=>[role,'def-'+role])) as FieldPracticeRequestV98['fieldInput']['defense'],
    placements:Object.fromEntries(ordinary.fielders.map(f=>[f.defensivePosition,f.position])) as FieldPracticeRequestV98['fieldInput']['placements'],
    players,batterRunnerId:'runner-0',batterPosition:ordinary.runners[0].position!,
    occupiedBases:{first:null,second:null,third:null},baserunning:'balanced'},
    context:{source:'AUTHORED_NOCK',battingTeam:0,pitcherPlayerId:'def-P'}};
}
