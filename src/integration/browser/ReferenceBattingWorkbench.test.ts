import { expect, it } from 'vitest';
import { defaultWorkbenchPlayer, type WorkbenchPlayer } from './WorkbenchPlayer';
import { simulateReferenceBattingWorkbench } from './ReferenceBattingWorkbench';
import { quaternionFromAxisAngle } from '../../core/sim/pitching/BaseballOrientation';

const scenario = () => {
  type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
  const player = structuredClone(defaultWorkbenchPlayer()) as Mutable<WorkbenchPlayer>;
  return {player,pitch:{speedMps:40,spinRpm:2200,spinAxis:'backspin' as const,courseX:0,courseY:1},throughSeconds:1,
    referenceTrajectory:{provenance:{clipId:'controlled-rigid-rod',sourceSha256:'b'.repeat(64)},
      frames:[{tick:0,grip:{x:-.84*.72,y:1,z:-.5},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},-Math.PI/2)},
        {tick:750_000,grip:{x:-.84*.72,y:1,z:.25},orientation:quaternionFromAxisAngle({x:0,y:0,z:1},-Math.PI/2)}],
      batLengthM:.84,sweetSpotT:.72,sourceTicksPerSecond:1_000_000,startTick:140_000,ticksPerSecond:1_000_000,playbackRate:1,
      transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}}};
};
it('uses the same reference state for the visible bat, actual rigid contact, and subsequent Aero/ground ball',()=>{
  const input=scenario(),result=simulateReferenceBattingWorkbench(input);
  expect(result.contact).not.toBeNull(); expect(result.flightFrames.length).toBeGreaterThan(50);
  expect(result.authority).toBe('CORE_REFERENCE_BAT_RESEARCH'); expect(result.nativeAdmission).toBe(false);
  expect(result.officialResult).toBeNull(); expect(result.batFrames.every(f=>f.body===null)).toBe(true);
  const first=result.flightFrames[0]; expect(first.ball.tick).toBe(result.contact!.tick);
  expect(first.ball.velocity).toEqual(result.contact!.exitVelocity);expect(first.ball.spin).toEqual(result.contact!.exitSpin);
  expect(result.batFrames.some(f=>f.tick===result.contact!.tick)).toBe(true);
  expect(simulateReferenceBattingWorkbench(input)).toEqual(result);
});
it('keeps geometric misses and declared input trajectories unchanged',()=>{
  const input=scenario(),before=JSON.stringify(input); input.referenceTrajectory.transform.translation.x=5;
  const shifted=JSON.stringify(input),result=simulateReferenceBattingWorkbench(input);
  expect(result.contact).toBeNull();expect(result.flightFrames).toEqual([]);expect(JSON.stringify(input)).toBe(shifted);
  expect(before).not.toBe(shifted);
});
it('rejects physical speed/length/clock/latency mismatches rather than silently normalizing source motion',()=>{
  const cap=scenario();cap.player.capability.maximumSweetSpotSpeedMps=.5;cap.player.swing.speedMps=.5;
  expect(()=>simulateReferenceBattingWorkbench(cap)).toThrow(/上限/);
  const length=scenario();length.referenceTrajectory.transform.scale=2;expect(()=>simulateReferenceBattingWorkbench(length)).toThrow(/長さ/);
  const clock=scenario();clock.referenceTrajectory.ticksPerSecond=30;expect(()=>simulateReferenceBattingWorkbench(clock)).toThrow(/clock/);
  const latency=scenario();latency.referenceTrajectory.startTick=0;expect(()=>simulateReferenceBattingWorkbench(latency)).toThrow(/反応/);
});
it('keeps league labels outside actual impulse and makes unmodelled body/recoil explicit',()=>{
  const a=scenario(),b=scenario(); b.player.identity.leagueId='NLB';
  const first=simulateReferenceBattingWorkbench(a),second=simulateReferenceBattingWorkbench(b);
  expect(second.contact).toEqual(first.contact);expect(second.flightFrames).toEqual(first.flightFrames);
  expect(first.trajectoryAuthority.afterContact).toBe('PRESCRIBED_REFERENCE_REPLAY_RECOIL_NOT_COUPLED');
  expect(first.bodyConstraintsApplied).toBe(false);
});
