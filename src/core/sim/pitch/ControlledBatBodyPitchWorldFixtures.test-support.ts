import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY } from '../contact/RigidBatBallContact';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../contact/WoodBatProductionProfileV1';
import { controlledHeldPitchFixture } from './ControlledHeldPitchFixtures.test-support';
import type { ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';
import type { ControlledBatBodyPitchWorldInputV1 } from './ControlledBatBodyPitchWorldV1';
const v=(x:number,y:number,z:number)=>({x,y,z});

/** Explicit synthetic contact geometry. This is NOT a player calibration,
 * a Native execution, a real-roster test or a scenario in the game AI. */
export function controlledBatBodyPitchFixture():ControlledBatBodyPitchWorldInputV1{
  const zero=v(0,0,0),bodyOrigin=v(0,.95,0),handCenter=v(.55,1.52,.05),length=.84;
  const actor=(playerId:string,role:DefenderPhysicalPrimitiveRole,center:ReturnType<typeof v>,radius:number)=>({playerId,
    primitive:{role,radius,startTick:0,endTick:1500000,ticksPerSecond:1000000,startCenter:center,startVelocity:zero,acceleration:zero}});
  const actors=[actor('b','body',bodyOrigin,.2),actor('b','glove',v(.3,1.1,.1),.08),actor('b','tag_hand',handCenter,.06),
    actor('b','left_foot',v(-.1,.07,0),.07),actor('b','right_foot',v(.1,.07,0),.07),actor('p','body',v(0,.95,18),.25),
    actor('p','glove',v(.4,1.15,18),.09),actor('p','left_foot',v(-.1,.07,18),.07),actor('p','right_foot',v(.1,.07,18),.07)];
  const a:ControlledHeldPitchAnchorsV1={initialBall:{tick:0,position:v(-.3,1.05,18.1),velocity:zero,spin:zero},
    initialHand:{position:v(-.3,1.05,18.1),velocity:zero},shoulder:v(0,1.4,18),armReachM:.8,handRadiusM:.06,ballRadiusM:.0366,
    release:{releaseAtUs:600000,position:v(.08,1.52,17.84),velocity:v(0,2.5,-40),spin:zero},releaseAcceleration:v(0,-9.81,0),followThroughEndTick:800000,
    obstacles:actors.map(a=>({center:a.primitive.startCenter,radiusM:a.primitive.radius}))};
  const frames=[0,100000,200000,300000],transform={rotation:{x:0,y:0,z:0,w:1},translation:zero,scale:1 as const};
  return {version:'controlled_bat_body_pitch_world_v1',batterPlayerId:'b',maximumGloveReachM:1.3,
    pitch:{anchors:a,motion:controlledHeldPitchFixture(a),pitcherPlayerId:'p',otherActors:actors,throughTick:1299999,
      descriptor:{kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:600000,elapsedSeconds:0,
        ball:{tick:600000,position:a.release.position,velocity:a.release.velocity,spin:a.release.spin}},
        throughElapsedSeconds:.699999,profile:{kind:'aero_ground_v1',air:{ticksPerSecond:1000000,integrationStepTicks:2000,gravityY:-9.81,
          aerodynamics:{...REFERENCE_BASEBALL_AERODYNAMICS,airDensityKgM3:0}},
          ground:{ticksPerSecond:1000000,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
            material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}}}},
    pitcherRenewal:{version:'pitch_hand_hold_renewal_v1',fromTick:800000,throughTick:1299999,sceneThroughTick:1500000},
    batterControl:{version:'coupled_held_measured_bat_body_control_v1',bodyObstacleIndex:0,footObstacleIndices:[2,3],maximumLegReachM:1.6,
      bat:{version:'held_to_measured_bat_control_v1',bridgeStartTick:800000,throughTick:1299999,maximumSweetSpotSpeedMps:20,
        initial:{version:'initial_held_bat_v1',startTick:0,throughTick:1500000,grip:v(.55,1.4,.05),orientation:{x:0,y:0,z:0,w:1},
          batLengthM:length,maximumBatRadiusM:.033,handReferenceFromKnobM:.12},
        body:{bodyOrigin,maximumHandReachM:1.4,handCenter,handRadiusM:.06,
          obstacles:[...actors.filter(a=>!(a.playerId==='b'&&a.primitive.role==='tag_hand')).map(a=>({center:a.primitive.startCenter,radiusM:a.primitive.radius})),
            {center:a.shoulder,radiusM:a.armReachM+a.handRadiusM}]},
        measured:{provenance:{clipId:'synthetic-world-contact',sourceSha256:'1'.repeat(64)},startTick:1000000,ticksPerSecond:1000000,
          sourceTicksPerSecond:1000000,playbackRate:1,transform,batLengthM:length,sweetSpotT:.8,
          frames:frames.map((tick,i)=>({tick,grip:v(.55,1.67,[-.4,.4,.5,.4][i]),orientation:quaternionFromAxisAngle(v(0,0,1),Math.PI/2)}))}},
      body:{version:'measured_pelvis_control_v1',startTick:0,bridgeStartTick:800000,throughTick:1299999,initialCenter:bodyOrigin,maximumSpeedMps:5,
        reference:{provenance:{clipId:'synthetic-world-contact',sourceSha256:'2'.repeat(64),batSourceSha256:'1'.repeat(64)},
          frames:frames.map(tick=>({tick,leftHip:v(-.08,.95,-.5),rightHip:v(.08,.95,-.5)})),startTick:1000000,
          ticksPerSecond:1000000,sourceTicksPerSecond:1000000,playbackRate:1,transform}}},
    batPhysical:{massKg:.9,centerOfMassT:.58,transverseMomentOfInertiaKgM2:.055,axialMomentOfInertiaKgM2:.0005,
      radiusProfile:{knots:[{t:0,radiusM:.025},{t:.55,radiusM:.031},{t:1,radiusM:.033}]}},ball:REALISTIC_BASEBALL_RIGID_BODY,
    contactResponse:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1};
}
