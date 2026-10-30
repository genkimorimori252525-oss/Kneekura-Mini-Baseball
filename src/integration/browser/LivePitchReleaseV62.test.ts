import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, LIVE_MATCH_MOUND_SURFACE_V1, LIVE_MATCH_PHYSICS_V1, createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { resolveLivePitchReleaseV1, simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const input=():LivePitchInputV1=>({originTick:1_000_000,seed:3,
  batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',timingStdSeconds:0,aimStdMeters:0},
  pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0,heightMeters:1.9,moundPosition:LIVE_MATCH_MOUND_SURFACE_V1},
  measuredClips:clips,batting:'take',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});

it('launches the physical ball on the pitcher right/left side, not a drawing-only offset',()=>{
  const i=input(),right=simulateLivePitchV1({...i,pitcher:{...i.pitcher,throws:'R'}}),
    left=simulateLivePitchV1({...i,pitcher:{...i.pitcher,throws:'L'}});
  for(const [result,side] of [[right,-1],[left,1]] as const){
    const source=result.diagnostics.sourceDescriptor.initial.ball;
    expect(source.position.x).toBe(side*1.9*.25);
    expect(source.position.y).toBeCloseTo(.254+1.9*.86,12);
    expect(source.position.z).toBeCloseTo(18.44-1.54,12);
    expect(result.frames[0].ball.position).toEqual(source.position);
    expect(result.diagnostics.releaseGeometry.position).toEqual(source.position);
    expect(result.diagnostics.sourceBallReanchored).toBe(false);
  }
  // Inverse command is solved again for each real release. Both pilots aim at
  // the same seeded course; the authored world spin is never silently flipped.
  const r=right.diagnostics.zoneJudgment.observedForecastPosition,l=left.diagnostics.zoneJudgment.observedForecastPosition;
  expect(Math.hypot(r.x-l.x,r.y-l.y,r.z-l.z)).toBeLessThan(.01);
  expect(right.diagnostics.sourceDescriptor.initial.ball.spin).toEqual(left.diagnostics.sourceDescriptor.initial.ball.spin);
  expect(right.diagnostics.sourceDescriptor.initial.ball.velocity).not.toEqual(left.diagnostics.sourceDescriptor.initial.ball.velocity);
});
it('uses independent authored release height, lateral offset and extension in the immutable Source',()=>{
  const i=input(),physical={pitchReleaseHeightMeters:1.25,pitchReleaseSideMeters:.8,pitchReleaseExtensionMeters:2.1},
    result=simulateLivePitchV1({...i,pitcher:{...i.pitcher,...physical,throws:'L'}});
  expect(result.diagnostics.sourceDescriptor.initial.ball.position).toEqual({x:.8,y:.254+1.25,z:18.44-2.1});
  expect(result.diagnostics.releaseGeometry).toMatchObject({heightAboveRubberMeters:1.25,sideMagnitudeMeters:.8,
    extensionTowardHomeMeters:2.1,measuredNamedPlayer:false});
  const short=resolveLivePitchReleaseV1({...i.pitcher,heightMeters:1.6}),tall=resolveLivePitchReleaseV1({...i.pitcher,heightMeters:2.1});
  expect(tall.position.y).toBeGreaterThan(short.position.y);
});
it('keeps direct legacy pitch callers exact until they opt into body/rubber/release geometry',()=>{
  const {heightMeters:_height,moundPosition:_mound,...legacy}=input().pitcher;
  expect(resolveLivePitchReleaseV1({...legacy,throws:'R'}).position).toEqual({x:.18,y:1.83,z:16.9});
  expect(resolveLivePitchReleaseV1({...legacy,throws:'L'}).position).toEqual({x:-.18,y:1.83,z:16.9});
});
it('projects individual release SI through an old-format roster packet into the live match Source',()=>{
  const fixture=liveMatchFixture(1234),pitcherId=fixture.teams[1].pitcherId,
    physical={basis:'EXPLICIT_AUTHORED_SI_V1',pitchReleaseHeightMeters:1.55,pitchReleaseSideMeters:.55,pitchReleaseExtensionMeters:1.8},
    raw={players:fixture.players.map(p=>p.playerId===pitcherId?{...p,throws:'L' as const}:p),
      roster:{version:'live_physical_roster_v1',sourceId:'release-v62',entries:[{playerId:pitcherId,sourceId:'authored-release',physical}]}},
    before=JSON.stringify(raw),projected=applyLivePhysicalRosterV1(JSON.parse(before)),
    host=createLiveBaseballMatchV1({...fixture,players:projected.players}),
    record=host.issuePitch({batting:'take',pitchType:'auto',location:'auto',managedTeam:0});
  expect(host.inspect().moundSurfacePosition).toEqual(LIVE_MATCH_MOUND_SURFACE_V1);
  expect(record.frames[0].ball!.position).toEqual({x:.55,y:.254+1.55,z:18.44-1.8});
  expect(JSON.stringify(raw)).toBe(before);
  expect(projected.players.find(p=>p.playerId===pitcherId)!.physical).toMatchObject(physical);
});
it('rejects nonfinite or unsupported release SI before a physical Source can be returned',()=>{
  const i=input();
  for(const [key,values] of [['pitchReleaseHeightMeters',[.199,3.201,NaN,Infinity]],
    ['pitchReleaseSideMeters',[-.001,1.501,NaN,Infinity]],['pitchReleaseExtensionMeters',[-.001,3.501,NaN,Infinity]]] as const)
    for(const value of values)expect(()=>resolveLivePitchReleaseV1({...i.pitcher,[key]:value})).toThrow('release geometry');
});
