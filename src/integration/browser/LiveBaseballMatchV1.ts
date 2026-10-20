import { resolveLiveTechnicalTraitsV75 } from './LiveTraitProfilesV1';
import { resolveLiveExecutionPhysicalV77 } from './LiveTraitRuntimeV77';
import { validatePitchRepertoireV77, validatePitchingMotionV77 } from './LivePitchAuthoringV77';
import { validatePitchRepertoireV78 } from './LivePitchAuthoringV78';
import { validateBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { cloneValidatedMeasuredCatalogV81 } from './MeasuredClipValidationCacheV81';
import type { Vec3 } from '../../core/model/geometry';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import type { AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { IDENTITY_QUATERNION, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { simulateLiveFieldPlayV1, deriveLiveFieldFenceGeometryV1, type LiveFielderV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import type { LiveDefensiveOpportunityV1 } from '../../core/sim/fielding/LiveDefensiveOpportunityV1';
import { reducePlayableMatchV1, type PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';
import { simulateLivePitchV1, type LiveMeasuredClipV1 } from './LivePitchV1';
import type { LivePhysicalAbilityControlsV1 } from './LivePhysicalRosterV1';
import { resolveLiveTraitPreferencesV54, validateLiveTraitProfileV1, type LiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { validateImpactTrajectorySettingsV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';

export type LivePositionV1 = 'P'|'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF';
export type LivePlayerPhysicalV1 = LivePhysicalAbilityControlsV1 & Readonly<{
  basis:'EXPLICIT_AUTHORED_SI_V1'; batLengthM:number;batMassKg:number;swingRate:number;
  timingStdSeconds:number;aimStdMeters:number;chaseMarginMeters:number;clipId?:string;
  releaseSpeedMps:number;spinRadPerSecond:Vec3;commandStdMeters:number;
  reactionSeconds:number;topSpeedMps:number;accelerationMps2:number;gloveSpeedMps:number;
  gloveReachMeters:number;gloveRadiusMeters:number;retentionCapacityJ:number;captureDissipationPowerW:number;
  transferSeconds:number;throwSpeedMps:number;
}>;
/** Explicit playability calibration, not measured abilities of any named player.
 * League ratings and presentation names never enter these physical parameters. */
export const LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1:LivePlayerPhysicalV1 = Object.freeze({
  basis:'EXPLICIT_AUTHORED_SI_V1',batLengthM:.84,batMassKg:.88,swingRate:1,
  timingStdSeconds:.009,aimStdMeters:.022,chaseMarginMeters:.12,
  releaseSpeedMps:42.5,spinRadPerSecond:Object.freeze({x:-230,y:15,z:10}),commandStdMeters:.11,
  reactionSeconds:.18,topSpeedMps:8,accelerationMps2:5.2,gloveSpeedMps:11,
  gloveReachMeters:1.35,gloveRadiusMeters:.11,retentionCapacityJ:160,captureDissipationPowerW:3000,
  transferSeconds:.46,throwSpeedMps:34,
});
export type LiveTeamV1 = Readonly<{id:string;name:string;battingOrder:readonly string[];pitcherId:string;defense:Readonly<Record<LivePositionV1,string>>}>;
export type LivePlayerV1 = Readonly<{playerId:string;name:string;heightMeters:number;bats:'R'|'L';throws?:'R'|'L';physical?:LivePlayerPhysicalV1;traitProfile?:LiveTraitProfileV1}>;
export type LiveMatchInputV1 = Readonly<{seed:number;innings?:number;teams:readonly [LiveTeamV1,LiveTeamV1];players:readonly LivePlayerV1[];
  measuredClips:readonly LiveMeasuredClipV1[];park?:Readonly<{fenceRadiusMeters:number;fenceHeightMeters:number}>}>;
export type LivePitchCommandV1 = Readonly<{batting:'auto'|'balanced'|'contact'|'power'|'take'|'bunt';pitchType:string;pitchId?:string;location:string;managedTeam:0|1;
  baserunning?:'conservative'|'balanced'|'aggressive'}>;
export type LiveMatchFrameV1 = Readonly<{tick:number;ball:Readonly<{position:Vec3;velocity:Vec3;spin:Vec3;orientation:Quaternion;visible:boolean}>|null;
  bat:Readonly<{grip:Vec3;tip:Vec3;radiusProfile?:unknown}>|null;
  actors:readonly Readonly<{playerId:string;role:LivePositionV1|'batter'|'runner';team:number;position:Vec3;velocity:Vec3;retired?:boolean}>[];
  batterPlayerId:string;pitcherPlayerId:string;phase:'ready'|'pitch'|'batted'|'throw'|'held'|'bench';
  ballKind:'pitch'|'batted'|'throw';fairKnown:boolean;possessedBy:string|null;fieldObserverPlayerId?:string;homeRunConfirmed?:boolean;
  defensiveOpportunity?:LiveDefensiveOpportunityV1|null}>;
export type LiveLineScoreV1 = Readonly<{inning:number;away:number|null;home:number|null}>;
export type LiveIssuedPitchV1 = Readonly<{
  beforeMatch:CanonicalMatchState;match:CanonicalMatchState;frames:readonly LiveMatchFrameV1[];events:readonly unknown[];
  play:Readonly<{classification:string;call:'ball'|'called_strike'|'swinging_strike'|null;contact:unknown;
    contactMoment:BallWorldMoment|null;contactOrientation:Quaternion|null;outgoingBallMoment:BallWorldMoment|null;
    field:ReturnType<typeof simulateLiveFieldPlayV1>|null;rules:PlayableMatchRuleResultV1;diagnostics:unknown}>;
  command:LivePitchCommandV1;
  requiresNextPitch:boolean;finished:boolean;batterPlayerId:string;pitcherPlayerId:string;pitchType:string;pitchId?:string;pitchName?:string;speedKmh:number;
  line:readonly LiveLineScoreV1[];hits:null;errors:null;
}>;
const positions:readonly LivePositionV1[]=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const zero=():Vec3=>({x:0,y:0,z:0});
const baseSide=27.432/Math.sqrt(2);
export const LIVE_MATCH_BASES_V1=Object.freeze({home:Object.freeze(zero()),first:Object.freeze({x:baseSide,y:0,z:baseSide}),
  second:Object.freeze({x:0,y:0,z:baseSide*2}),third:Object.freeze({x:-baseSide,y:0,z:baseSide})});
const placements:Readonly<Record<LivePositionV1,Vec3>>={P:{x:0,y:.9,z:18.44},C:{x:0,y:.85,z:-1.5},'1B':{x:23,y:.9,z:25},
  '2B':{x:13,y:.9,z:36},'3B':{x:-23,y:.9,z:25},SS:{x:-13,y:.9,z:36},LF:{x:-46,y:.9,z:76},CF:{x:0,y:.9,z:91},RF:{x:46,y:.9,z:76}};
/** Rubber top; actor/collider anchors remain independent of mound elevation. */
export const LIVE_MATCH_MOUND_SURFACE_V1=Object.freeze({x:placements.P.x,y:.254,z:placements.P.z});
export const LIVE_MATCH_PHYSICS_V1:AeroGroundBallPhysicsV1=Object.freeze({kind:'aero_ground_v1',
  air:Object.freeze({ticksPerSecond:1_000_000,integrationStepTicks:5000,gravityY:-9.80665,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS}),
  ground:Object.freeze({ticksPerSecond:1_000_000,gravityMps2:9.80665,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.28,
    material:Object.freeze({restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18})})});
const frozen=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error('live baseball match: '+m);}
/** A catalog is a bounded collection of independently inert measured clips.
 * Do not relax cloneInert's ordinary 100,000-node input boundary or copy all
 * 673 clips into every pitch. Descriptor reads reject getters before access. */
function cloneMatchInputWithMeasuredCatalogV68(raw:LiveMatchInputV1):LiveMatchInputV1{
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null),'inert match input required');
  const descriptors=Object.getOwnPropertyDescriptors(raw),catalogDescriptor=descriptors.measuredClips,other={};
  assert(catalogDescriptor&&catalogDescriptor.enumerable&&'value' in catalogDescriptor,'inert measured clip catalog required');
  for(const key of Reflect.ownKeys(raw))if(key!=='measuredClips')Object.defineProperty(other,key,Object.getOwnPropertyDescriptor(raw,key)!);
  const rest=cloneInert(other) as Omit<LiveMatchInputV1,'measuredClips'>,catalog=catalogDescriptor.value as unknown[];
  const measuredClips=cloneValidatedMeasuredCatalogV81(catalog);
  return {...rest,measuredClips};
}
function physical(player:LivePlayerV1):LivePlayerPhysicalV1{
  const p=player.physical??LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1;
  assert(p.basis==='EXPLICIT_AUTHORED_SI_V1','unknown player SI basis');
  const nonnegative=['timingStdSeconds','aimStdMeters','chaseMarginMeters','commandStdMeters','reactionSeconds','transferSeconds'] as const;
  const positive=['batLengthM','batMassKg','swingRate','releaseSpeedMps','topSpeedMps','accelerationMps2','gloveSpeedMps','gloveReachMeters',
    'gloveRadiusMeters','retentionCapacityJ','captureDissipationPowerW','throwSpeedMps'] as const;
  assert(nonnegative.every(k=>Number.isFinite(p[k])&&p[k]>=0)&&positive.every(k=>Number.isFinite(p[k])&&p[k]>0)
    &&Object.values(p.spinRadPerSecond).every(Number.isFinite),'invalid explicit player SI');
  assert(p.zoneJudgmentStdMeters===undefined||Number.isFinite(p.zoneJudgmentStdMeters)&&p.zoneJudgmentStdMeters>=0&&p.zoneJudgmentStdMeters<=.6,
    'invalid zone judgment SI');
  assert(p.plateVision===undefined||Number.isFinite(p.plateVision)&&p.plateVision>=1&&p.plateVision<=100,
    'invalid absolute plate vision');
  for(const [key,lo,hi] of [['pitchReleaseHeightMeters',.2,3.2],['pitchReleaseSideMeters',0,1.5],['pitchReleaseExtensionMeters',0,3.5]] as const)
    assert(p[key]===undefined||Number.isFinite(p[key])&&p[key]!>=lo&&p[key]!<=hi,'invalid pitch release SI: '+key);
  assert(p.baserunningSafetyMarginSeconds===undefined||Number.isFinite(p.baserunningSafetyMarginSeconds)&&p.baserunningSafetyMarginSeconds>=0&&p.baserunningSafetyMarginSeconds<=3,
    'invalid baserunning safety margin');
  assert(p.fieldingPursuitCostWeight===undefined||Number.isFinite(p.fieldingPursuitCostWeight)&&p.fieldingPursuitCostWeight>=.25&&p.fieldingPursuitCostWeight<=4,
    'invalid fielding pursuit cost weight');
  assert(p.baserunningTurnRadiusMeters===undefined||Number.isFinite(p.baserunningTurnRadiusMeters)&&p.baserunningTurnRadiusMeters>=.5&&p.baserunningTurnRadiusMeters<=10,
    'invalid baserunning turn radius SI');
  assert(p.baserunningLateralAccelerationMps2===undefined||Number.isFinite(p.baserunningLateralAccelerationMps2)&&p.baserunningLateralAccelerationMps2>=.5&&p.baserunningLateralAccelerationMps2<=20,
    'invalid baserunning lateral acceleration SI');
  if(p.impactTrajectory!==undefined)validateImpactTrajectorySettingsV1(p.impactTrajectory);
  if(p.pitchRepertoire!==undefined)validatePitchRepertoireV77(p.pitchRepertoire,p.maximumPitchSpeedMps);
  assert(!(p.pitchRepertoire&&p.pitchRepertoireV78),'ambiguous V77 and V78 pitch ownership');
  if(p.pitchRepertoireV78!==undefined)validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps);
  if(p.batterCourseProfileV79!==undefined)validateBatterCourseProfileV79(p.batterCourseProfileV79);
  assert(p.minimumSpinRatio===undefined||Number.isFinite(p.minimumSpinRatio)&&p.minimumSpinRatio>=0&&p.minimumSpinRatio<=1,'invalid minimum spin ratio');
  if(p.pitchingMotion!==undefined)validatePitchingMotionV77(p.pitchingMotion);
  return resolveLiveExecutionPhysicalV77(p,player.traitProfile);
}

/** A browser-neutral local Host. It executes the shared Core rather than
 * consuming a finite recording or delegating results to the former HTML game.
 * This is a separate local match, not authenticated Native SQLite history. */
export function createLiveBaseballMatchV1(raw:LiveMatchInputV1){
  const input=cloneMatchInputWithMeasuredCatalogV68(raw),innings=input.innings??9,tps=LIVE_MATCH_PHYSICS_V1.air.ticksPerSecond;
  assert(Number.isSafeInteger(input.seed)&&Number.isSafeInteger(innings)&&innings>0,'invalid seed/innings');
  assert(input.teams.length===2&&new Set(input.teams.map(t=>t.id)).size===2,'two unique teams required');
  const players=new Map(input.players.map(p=>[p.playerId,p]));
  assert(players.size===input.players.length&&input.players.every(p=>p.playerId&&p.name&&Number.isFinite(p.heightMeters)&&p.heightMeters>0&&['R','L'].includes(p.bats)
    &&(p.throws===undefined||['R','L'].includes(p.throws))),'unique physical players required');
  input.players.forEach(p=>{const source=physical(p);if(p.traitProfile!==undefined)validateLiveTraitProfileV1(p.traitProfile,source);});
  input.teams.forEach(t=>{
    assert(t.battingOrder.length===9&&new Set(t.battingOrder).size===9&&t.battingOrder.every(id=>players.has(id)),'nine-player batting order required');
    assert(positions.every(pos=>players.has(t.defense[pos]))&&new Set(positions.map(pos=>t.defense[pos])).size===9
      &&t.defense.P===t.pitcherId,'complete defense required');
  });
  assert(input.measuredClips.length>0,'OpenBiomechanics measured bat clips required');
  for(const player of input.players){const p=physical(player);
    assert(p.clipId===undefined||typeof p.clipId==='string'&&p.clipId.length>0,'invalid explicit measured clip identity');
    const candidates=input.measuredClips.filter(clip=>clip.side===player.bats&&(p.clipId===undefined?clip.defaultSelection!==false:clip.id===p.clipId));
    assert(candidates.length>0,'unknown measured clip or wrong batting side for '+player.playerId);
    if(p.impactTrajectory!==undefined&&p.impactTrajectory.method===undefined){const s=p.impactTrajectory;
      assert(candidates.every(clip=>clip.contactTimeSeconds*1e6-s.beforeSeconds*1e6>=clip.frames[0].tick
        &&clip.contactTimeSeconds*1e6+s.afterSeconds*1e6<=clip.frames.at(-1)!.tick),'impact adjustment window exceeds measured form for '+player.playerId);}
  }
  const park=input.park??{fenceRadiusMeters:110,fenceHeightMeters:3};
  assert(Number.isFinite(park.fenceRadiusMeters)&&park.fenceRadiusMeters>baseSide*2&&Number.isFinite(park.fenceHeightMeters)&&park.fenceHeightMeters>=0,'invalid park geometry');
  const fence=deriveLiveFieldFenceGeometryV1({bases:LIVE_MATCH_BASES_V1,...park}),fenceGeometry=frozen({
    center:{x:fence.fenceCenter.x,z:fence.fenceCenter.z},radiusMeters:fence.fenceRadiusMeters,heightMeters:fence.fenceHeightMeters});
  let match:CanonicalMatchState={ruleProfileId:asRuleProfileId('npb-2026'),inning:1,half:'top',outs:0,balls:0,strikes:0,
    bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0};
  let pitchCount=0,nextTick=tps,finished=false;
  const battingOrderIndices=[0,0],history:LiveIssuedPitchV1[]=[],line:{inning:number;away:number|null;home:number|null}[]=[{inning:1,away:0,home:null}];
  const offense=()=>match.half==='top'?0:1;
  const current=()=>{const team=offense();return {team,batterPlayerId:input.teams[team].battingOrder[battingOrderIndices[team]],pitcherPlayerId:input.teams[1-team].pitcherId};};
  const readyFrame=():LiveMatchFrameV1=>{
    const c=current(),def=input.teams[1-c.team],batter=players.get(c.batterPlayerId)!;
    return frozen({tick:nextTick,ball:{position:{x:0,y:1.8,z:16.4},velocity:zero(),spin:zero(),orientation:IDENTITY_QUATERNION,visible:false},bat:null,
      actors:[...positions.map(role=>({playerId:def.defense[role],role,team:1-c.team,position:{...placements[role],y:0},velocity:zero()})),
        {playerId:c.batterPlayerId,role:'batter' as const,team:c.team,position:{x:batter.bats==='R'?-.85:.85,y:0,z:-.2},velocity:zero()},
        ...(['first','second','third'] as const).flatMap(name=>match.bases[name]?[{playerId:match.bases[name]!,role:'runner' as const,team:c.team,
          position:LIVE_MATCH_BASES_V1[name],velocity:zero()}]:[])],
      batterPlayerId:c.batterPlayerId,pitcherPlayerId:c.pitcherPlayerId,phase:'ready',ballKind:'pitch',fairKnown:false,possessedBy:c.pitcherPlayerId});
  };
  const inspect=()=>frozen({version:33,authority:'LOCAL_BROWSER_CORE_HOST_V1' as const,nativeAuthentication:false,
    playerCalibration:'EXPLICIT_AUTHORED_SI_NOT_NAMED_LEAGUE_MEASUREMENTS' as const,match:cloneInert(match),frame:readyFrame(),...current(),pitchCount,finished,
    battingOrderIndices:[...battingOrderIndices],line:cloneInert(line),fenceGeometry,moundSurfacePosition:LIVE_MATCH_MOUND_SURFACE_V1,hits:null,errors:null,history:[...history]});
  function issuePitch(command:LivePitchCommandV1):LiveIssuedPitchV1{
    assert(!finished,'game already finished');
    assert(command&&['auto','balanced','contact','power','take','bunt'].includes(command.batting)&&[0,1].includes(command.managedTeam),'invalid manager command');
    assert(command.baserunning===undefined||['conservative','balanced','aggressive'].includes(command.baserunning),'invalid manager baserunning command');
    const beforeMatch=cloneInert(match),c=current(),batter=players.get(c.batterPlayerId)!,pitcher=players.get(c.pitcherPlayerId)!,
      bp=physical(batter),pp=physical(pitcher),cp=physical(players.get(input.teams[1-c.team].defense.C)!),ready=readyFrame();
    const batterTechnique=resolveLiveTechnicalTraitsV75(batter.traitProfile),pitcherTechnique=resolveLiveTechnicalTraitsV75(pitcher.traitProfile);
    const batterPreference=resolveLiveTraitPreferencesV54(batter.traitProfile),pitcherPreference=resolveLiveTraitPreferencesV54(pitcher.traitProfile),
      managedOffense=command.managedTeam===c.team,personalBatting=({POWER:'power',BALANCED:'balanced',CONTACT:'contact'} as const)[batterPreference.swingMode],
      batting=managedOffense&&command.batting!=='auto'?command.batting:personalBatting,
      pitchTypeCommand=command.managedTeam===1-c.team?command.pitchType:'auto',
      traitPreferences=command.batting==='auto'||batterPreference.swingMode!=='BALANCED'||pitcherPreference.pitchApproach!=='BALANCED'?{
        batting:{preference:batterPreference.swingMode,resolvedCommand:batting,source:managedOffense&&command.batting!=='auto'?'manager_command':'player_preference',
          overrideReason:managedOffense?(command.batting==='auto'?'manager_auto':'explicit_manager_batting'):'unmanaged_offense'},
        pitching:{preference:pitcherPreference.pitchApproach,pitchTypeCommand,source:pitchTypeCommand==='auto'?'player_preference':'manager_command',
          overrideReason:pitchTypeCommand!=='auto'?'explicit_manager_pitch':command.managedTeam===1-c.team?'manager_auto':'unmanaged_pitcher'},
      }:null;
    const runningInstruction=command.managedTeam===c.team?(command.baserunning??'balanced'):'balanced',
      runningMarginAdjustment=runningInstruction==='aggressive'?-.25:runningInstruction==='conservative'?.25:0,
      runningMargin=(p:LivePlayerPhysicalV1)=>Math.max(0,Math.min(3,(p.baserunningSafetyMarginSeconds??.35)+runningMarginAdjustment));
    const pitch=simulateLivePitchV1({originTick:nextTick,seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
      batter:{...bp,heightMeters:batter.heightMeters,bats:batter.bats,...(batterTechnique?{technicalSkills:batterTechnique}:{})},pitcher:{...pp,...(pitcherTechnique?{technicalSkills:pitcherTechnique}:{}),heightMeters:pitcher.heightMeters,moundPosition:LIVE_MATCH_MOUND_SURFACE_V1,...(pitcher.throws===undefined?{}:{throws:pitcher.throws}),
        pitchApproach:pitcherPreference.pitchApproach},measuredClips:input.measuredClips.filter(clip=>clip.side===batter.bats
          &&(bp.clipId===undefined?clip.defaultSelection!==false:clip.id===bp.clipId)),
      catcher:{gloveSpeedMps:cp.gloveSpeedMps,gloveReachMeters:cp.gloveReachMeters,gloveRadiusMeters:cp.gloveRadiusMeters,
        retentionCapacityJ:cp.retentionCapacityJ,captureDissipationPowerW:cp.captureDissipationPowerW,pocketRadiusMeters:.14},
      batting,pitchType:pitchTypeCommand,...(command.managedTeam===1-c.team&&command.pitchId!==undefined?{pitchId:command.pitchId}:{}),
      location:command.managedTeam===1-c.team?command.location:'auto',physics:LIVE_MATCH_PHYSICS_V1});
    const frames:LiveMatchFrameV1[]=pitch.frames.map(f=>({...ready,tick:f.tick,ball:f.ball,bat:f.bat,phase:'pitch',possessedBy:f.ball.possessedBy==='catcher'?input.teams[1-c.team].defense.C:null}));
    let field:ReturnType<typeof simulateLiveFieldPlayV1>|null=null,result:PlayableMatchRuleResultV1,outgoingBallMoment:BallWorldMoment|null=null;
    if(pitch.contact&&pitch.contactMoment){
      const def=input.teams[1-c.team];
      const fielders:LiveFielderV1[]=positions.map(role=>{const playerId=def.defense[role],p=physical(players.get(playerId)!);return{
        playerId,...(resolveLiveTechnicalTraitsV75(players.get(playerId)!.traitProfile)?{technicalSkills:resolveLiveTechnicalTraitsV75(players.get(playerId)!.traitProfile)}:{}),defensivePosition:role,position:placements[role],reactionSeconds:p.reactionSeconds,topSpeedMps:p.topSpeedMps,accelerationMps2:p.accelerationMps2,
        fieldingCognition:{decisionSeconds:p.defensiveDecisionSeconds??0,pursuitCostWeight:p.fieldingPursuitCostWeight??1},
        gloveSpeedMps:p.gloveSpeedMps,gloveReachMeters:p.gloveReachMeters,gloveRadiusMeters:p.gloveRadiusMeters,
        catchRetention:{ticksPerSecond:tps,ballMassKg:.145,ballRadiusMeters:.0366,pocketRadiusMeters:.14,centerRetentionCapacityJ:p.retentionCapacityJ,
          captureDissipationPowerW:p.captureDissipationPowerW,failedContactRestitution:.2,failedTangentialDamping:.35,failedSpinDamping:.2},
        transferSeconds:p.transferSeconds,throwSpeedMps:p.throwSpeedMps,throwBackspinRadPerSecond:120,
        ...(p.throwDirectionStdRadians===undefined?{}:{throwDirectionStdRadians:p.throwDirectionStdRadians})};});
      const runnerSpecs=[{runnerId:c.batterPlayerId,...(batterTechnique?{technicalSkills:batterTechnique}:{}),initialBase:0 as const,position:ready.actors.find(a=>a.playerId===c.batterPlayerId)!.position,
        topSpeedMps:bp.topSpeedMps,accelerationMps2:bp.accelerationMps2,reactionSeconds:bp.reactionSeconds,advanceSafetyMarginSeconds:runningMargin(bp),
        roundingRadiusMeters:bp.baserunningTurnRadiusMeters??4.5,lateralAccelerationMps2:bp.baserunningLateralAccelerationMps2??1.5*bp.accelerationMps2},
        ...(['first','second','third'] as const).flatMap((key,i)=>{const runnerId=beforeMatch.bases[key];if(!runnerId)return[];const p=physical(players.get(runnerId)!);
          const technique=resolveLiveTechnicalTraitsV75(players.get(runnerId)!.traitProfile);
          return[{runnerId,...(technique?{technicalSkills:technique}:{}),initialBase:(i+1) as 1|2|3,topSpeedMps:p.topSpeedMps,accelerationMps2:p.accelerationMps2,reactionSeconds:p.reactionSeconds,advanceSafetyMarginSeconds:runningMargin(p),
            roundingRadiusMeters:p.baserunningTurnRadiusMeters??4.5,lateralAccelerationMps2:p.baserunningLateralAccelerationMps2??1.5*p.accelerationMps2}];})];
      const outgoingMoment={...pitch.contactMoment,ball:{...pitch.contactMoment.ball,velocity:pitch.contact.exitVelocity,spin:pitch.contact.exitSpin}};
      outgoingBallMoment=outgoingMoment;
      field=simulateLiveFieldPlayV1({ball:outgoingMoment,orientation:pitch.contactOrientation??IDENTITY_QUATERNION,
        physics:pitch.diagnostics.sourceDescriptor.profile.air.aerodynamics.seamForce===undefined?LIVE_MATCH_PHYSICS_V1:pitch.diagnostics.sourceDescriptor.profile,
        seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
        field:{bases:LIVE_MATCH_BASES_V1,...park},fielders,runners:runnerSpecs,outs:beforeMatch.outs,maxPlaySeconds:45});
      if(!field.end.complete)throw new Error('live baseball match: physical field continuation unresolved: '+field.end.reason+' (pitch '+(pitchCount+1)+', seed '+input.seed+')',
        {cause:{outgoingMoment,fielders,runners:runnerSpecs,outs:beforeMatch.outs,field:{bases:LIVE_MATCH_BASES_V1,...park},end:field.end,diagnostics:field.diagnostics,facts:field.facts}});
      result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'field_play',facts:{...field.ruleFacts,buntAttempt:batting==='bunt'}}});
      let lastThrow=-Infinity,observer:string|undefined;
      for(const f of field.frames){
        const events=field.facts.filter(e=>e.tick<=f.tick);
        lastThrow=events.filter(e=>e.kind==='throw_release').at(-1)?.tick??-Infinity;
        const latestCatch=events.filter(e=>e.kind==='catch_secured').at(-1);
        observer=f.ball.possessedBy??latestCatch?.playerId??f.fielders.filter(a=>a.intent==='intercept').sort((a,b)=>Math.hypot(a.position.x-f.ball.position.x,a.position.z-f.ball.position.z)-Math.hypot(b.position.x-f.ball.position.x,b.position.z-f.ball.position.z))[0]?.playerId;
        frames.push({...ready,tick:f.tick,ball:f.ball,bat:pitch.sampleBatAtTick(f.tick),actors:[
          ...f.fielders.map(a=>({playerId:a.playerId,role:positions.find(pos=>def.defense[pos]===a.playerId)!,team:1-c.team,position:{...a.position,y:0},velocity:a.velocity})),
          ...f.runners.map(r=>{const out=result.kind==='applied'?result.outcomes.find(o=>o.runnerId===r.runnerId):null,
            dt=out?Math.max(0,(f.tick-out.tick)/tps):0,dx=(c.team===0?-30:30)-r.position.x,dz=3-r.position.z,length=Math.hypot(dx,dz),travel=Math.min(length,dt*3.2);
            return{playerId:r.runnerId,role:'runner' as const,team:c.team,position:{x:r.position.x+dx/(length||1)*travel,y:0,z:r.position.z+dz/(length||1)*travel},
              velocity:dt>0?{x:dx/(length||1)*3.2,y:0,z:dz/(length||1)*3.2}:r.velocity,retired:r.retired};})],
          phase:f.ball.possessedBy?'held':lastThrow>=(latestCatch?.tick??Infinity)?'throw':'batted',
          ballKind:lastThrow>=(latestCatch?.tick??Infinity)?'throw':'batted',fairKnown:events.some(e=>e.kind==='territory_determined'&&e.reason==='fair'),possessedBy:f.ball.possessedBy,
          fieldObserverPlayerId:observer,defensiveOpportunity:f.defensiveOpportunity,
          homeRunConfirmed:!!field.ruleFacts.overFence?.fair&&field.ruleFacts.overFence.untouchedGround&&f.tick>=field.ruleFacts.overFence.tick});
      }
    }else{
      assert(pitch.call!==null,'pitch ended without physical contact or secured count call');
      result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'pitch_call',tick:pitch.endedAtTick,call:pitch.call}});
    }
    assert(result.kind==='applied','rule continuation unresolved: '+(result.kind==='unresolved'?result.reason:''));
    // Truncate at the actual third out / walkoff, before starting bench movement.
    const acceptedFrames=frames.filter(f=>f.tick<=result.endedAtTick);
    if(!acceptedFrames.length)acceptedFrames.push(ready);
    if(result.halfChanged||result.gameOver){
      const last=acceptedFrames.at(-1)!,duration=.9,step=.055;
      for(let dt=step;dt<=duration+step/2;dt+=step){const seconds=Math.min(dt,duration);
        acceptedFrames.push({...last,tick:result.endedAtTick+Math.round(seconds*tps),phase:'bench',ball:last.ball?{...last.ball,visible:false}:null,
          actors:last.actors.map(a=>{const target={x:a.team===0?-30:30,z:3},dx=target.x-a.position.x,dz=target.z-a.position.z,length=Math.hypot(dx,dz),travel=Math.min(length,seconds*3.2);
            return{...a,position:{x:a.position.x+dx/(length||1)*travel,y:0,z:a.position.z+dz/(length||1)*travel},velocity:{x:dx/(length||1)*3.2,y:0,z:dz/(length||1)*3.2}};})});
      }
    }
    const row=line.find(r=>r.inning===beforeMatch.inning)!;
    row[beforeMatch.half==='top'?'away':'home']=(row[beforeMatch.half==='top'?'away':'home']??0)+result.scoredRunnerIds.length;
    match=result.match;finished=result.gameOver;pitchCount++;
    if(result.batterAdvanced)battingOrderIndices[c.team]=(battingOrderIndices[c.team]+1)%9;
    if(result.halfChanged){let r=line.find(r=>r.inning===match.inning);if(!r){r={inning:match.inning,away:null,home:null};line.push(r);}r[match.half==='top'?'away':'home']=0;}
    nextTick=Math.max(result.endedAtTick,acceptedFrames.at(-1)!.tick)+2*tps;
    const record:LiveIssuedPitchV1=frozen({beforeMatch,match:cloneInert(match),frames:acceptedFrames,
      events:[...(field?.facts??[]),...result.outcomes.map(o=>({kind:'runner_out',...o})),{kind:'pitch_adjudicated',tick:result.endedAtTick,classification:result.classification}],
      command:cloneInert(command),play:{classification:result.classification,call:pitch.call,contact:pitch.contact,
        contactMoment:pitch.contactMoment,contactOrientation:pitch.contactOrientation,outgoingBallMoment,field,rules:result,
        diagnostics:{...pitch.diagnostics,...(traitPreferences?{traitPreferences}:{}),managerBaserunning:{instruction:runningInstruction,safetyMarginAdjustmentSeconds:runningMarginAdjustment,appliedToOffense:command.managedTeam===c.team}}},
      requiresNextPitch:!finished,finished,batterPlayerId:c.batterPlayerId,pitcherPlayerId:c.pitcherPlayerId,pitchType:pitch.pitchType,
      ...(pitch.pitchId===undefined?{}:{pitchId:pitch.pitchId,pitchName:pitch.pitchName}),speedKmh:pitch.speedKmh,line:cloneInert(line),hits:null,errors:null});
    history.push(record);return record;
  }
  return Object.freeze({issuePitch,inspect});
}

