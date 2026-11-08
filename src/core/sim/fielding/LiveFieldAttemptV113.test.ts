import {expect,it} from 'vitest';
import {buildCanonicalFieldingPlayInputV1} from './LiveFieldPlayDiagnosticsV1';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import {simulateLiveFieldPlayV1} from './LiveFieldPlayV1';

const v=(x=0,y=0,z=0)=>({x,y,z});
function crossingGroundBall() {
  const original=buildCanonicalFieldingPlayInputV1({id:'crossing',category:'infield_grounder',description:'Near crossing ball',
    ballPosition:v(.117,.95,.096),ballVelocity:v(16.896,-6.696,52.133),ballSpin:v(193.986,345.315,-112.124),expectedMinOutsWithCompetentAI:0}).input,
    height=1.8,model=resolveLiveFielderBodyModelV105(height,1.35);
  const places=[v(0,0,18.44),v(0,0,-1.5),v(23,0,25),v(13,0,36),v(-23,0,25),v(-13,0,36),v(-46,0,76),v(0,0,91),v(46,0,76)];
  return {...original,outs:0,maxPlaySeconds:2,fielders:original.fielders.map((f,i)=>({...f,
    position:{...places[i],y:model.hipHeightMeters},bodyModelV105:model,reactionSeconds:.15,
    fieldingCognition:{decisionSeconds:.04,pursuitCostWeight:1},gloveSpeedMps:8})),
    ball:{...original.ball,ball:{...original.ball.ball,position:v(.117,.95,.096),velocity:v(16.896,-6.696,52.133),spin:v(193.986,345.315,-112.124)}}};
}

it('tries a near crossing ground ball instead of holding solely because the arrival forecast is slightly late',()=>{
  const input=crossingGroundBall(),before=JSON.stringify(input),result=simulateLiveFieldPlayV1(input),start=input.ball.elapsedSeconds;
  const beforeCrossing=result.frames.filter(f=>f.elapsedSeconds<start+.9),id='def-2B';
  expect(beforeCrossing.some(f=>f.fielders.find(a=>a.playerId===id)!.intent==='intercept')).toBe(true);
  const moved=beforeCrossing.at(-1)!.fielders.find(a=>a.playerId===id)!;
  expect(Math.hypot(moved.position.x-13,moved.position.z-36)).toBeGreaterThan(.3);
  expect(moved.bodyPoseV105!.crouchMeters).toBeGreaterThan(0);
  expect(JSON.stringify(input)).toBe(before);
});

it('does not turn a clearly unreachable crossing into an automatic catch or move a defender before its own response',()=>{
  const original=crossingGroundBall(),input={...original,fielders:original.fielders.map(f=>({...f,reactionSeconds:1.5}))},
    result=simulateLiveFieldPlayV1(input),start=input.ball.elapsedSeconds;
  for(const frame of result.frames.filter(f=>f.elapsedSeconds<start+1.5)) {
    expect(frame.fielders.find(f=>f.playerId==='def-2B')!.position).toEqual(input.fielders[3].position);
  }
  expect(result.ruleFacts.flyCatch).toBeNull();
});

it('keeps a deep high fly with its outfield route rather than inventing a near infield attempt above arm reach',()=>{
  const original=crossingGroundBall(),input={...original,ball:{...original.ball,ball:{...original.ball.ball,
    position:v(0,.9,.3),velocity:v(-4,28,18),spin:v(-130,-40,0)}}},result=simulateLiveFieldPlayV1(input);
  expect(['def-LF','def-CF']).toContain(result.diagnostics.aiTelemetry.roleTransitions[0].handlerId);
  for(const frame of result.frames) for(const id of ['def-1B','def-2B','def-3B','def-SS'])
    expect(frame.fielders.find(f=>f.playerId===id)!.intent).not.toBe('intercept');
});
