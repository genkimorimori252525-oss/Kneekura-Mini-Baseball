import { prepareBatterRunPlan } from './BatterRunPlan';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { deriveBattedWorldFieldMotionAdoption } from '../../core/sim/ball/BattedWorldFieldMotion';
import { geometry,material } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const zero={x:0,y:0,z:0},parameters={...DEFAULT_BALL_FLIGHT_PARAMETERS,gravityY:0};
/** Existing Core physics with structural Source contracts only; no Native admission claim. */
export const samePaBatterRunFixture=(defender=false,defenderEndTick=5_000_000)=>{
  const body={playerId:'batter',personId:'person',primitives:(['glove','body','tag_hand','left_foot','right_foot'] as const).map((role,i)=>({role,radius:0.05,offset:{x:i*0.1,y:role.endsWith('foot')?-1:0,z:0}}))};
  const actors=body.primitives.map(p=>({playerId:'batter',primitive:{role:p.role,radius:p.radius,startTick:0,endTick:5_000_000,ticksPerSecond:1_000_000,
    startCenter:{x:p.offset.x,y:1+p.offset.y,z:0},startVelocity:zero,acceleration:zero}}));
  if(defender)actors.push(...actors.map(a=>({...a,playerId:'fielder',primitive:{...a.primitive,endTick:defenderEndTick,startCenter:{...a.primitive.startCenter,x:a.primitive.startCenter.x+50}}})));
  const contact={tick:0,ballCenter:{x:100,y:10,z:100},point:{x:100,y:10,z:100},batPoint:{x:100,y:10,z:100},normal:{x:1,y:0,z:0},segmentT:0.5,exitVelocity:{x:1,y:0,z:0},exitSpin:zero};
  const flight=createBattedBallFlightEvidence({contact,parameters,searchDurationTicks:0});
  const response:any={world:{flight,parameters,throughTick:0,actors,surfaces:[]},actors:actors.map(a=>({playerId:a.playerId,profile:a.primitive.role==='glove'
    ?{role:'glove',pocketCenterOffset:zero,bodyStability:1,parameters:{ticksPerSecond:1_000_000,ballMassKg:0.145,ballRadiusMeters:parameters.ballRadius,pocketRadiusMeters:0.1,centerRetentionCapacityJ:10,captureDissipationPowerW:100,failedContactRestitution:0.5,failedTangentialDamping:0,failedSpinDamping:0}}
    :{role:a.primitive.role,material}})),surfaces:[]};
  const shape=geometry(27),field=deriveBattedWorldFieldMotionAdoption({response,geometry:shape,actors,carrierPlayerId:null,cursor:{moment:{originTick:0,elapsedSeconds:0,ball:flight.initialBall},previousContacts:[]},availableAtTick:0,coverageThroughTick:Math.min(5_000_000,defenderEndTick),commands:actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:zero}))});
  const root:any={kind:'same_pa_physical_field_root_v1',source:{sourceId:'root',sourceVersion:'test'},physicalPitchSourceId:'pitch',lineage:{playId:1},response,geometry:shape,field,evaluationTick:0,timeline:{events:[],status:{kind:'batted_ball_pending'}}};
  const exit:any={playerId:'batter',personId:'person',body,source:{fieldReference:reference('pa_physical_v1_field_roots',root)},state:{tick:0,planarVelocity:{x:0,z:0},bodyForwardUnit:{x:1,z:0}},root:{position:{x:0,y:1,z:0},velocity:zero},firstBaseCenter:{x:27,z:0},model:{source:{parameters:{ticksPerSecond:1_000_000,maximumBodyTurnRateRadiansPerSecond:Math.PI,lateralRealignmentAccelerationMps2:4,backwardRecoveryAccelerationMps2:3}},runnerModel:{source:{motion:{ticksPerSecond:1_000_000,reactionDelayTicks:0,accelerationMps2:2,brakingMps2:3,slideDecelerationMps2:4,topSpeedMps:5}}}}};
  const intention={playerId:'batter',personId:'person',route:{segments:[{kind:'line' as const,start:{x:0,z:0},end:{x:30,z:0}}]},intent:{kind:'advance' as const,issuedTick:0},endTick:3_000_000};
  const plan:any={kind:'owned_batter_run_plan_v1',source:{sourceId:'run',sourceVersion:'test',physicalPitchReference:{sourceId:'pitch'}},lineage:root.lineage,playerId:'batter',personId:'person',exitState:exit,plan:prepareBatterRunPlan(exit,intention)};
  const source:any={throughTick:500_000,action:{kind:'batter_run_motion_v1',planReference:reference('world_batter_run_plans',plan)}};
  return{root,plan,source};
};
