import { expect, it } from 'vitest';
import { defaultWorkbenchPlayer, type WorkbenchPlayer } from './WorkbenchPlayer';
import { simulateBattingWorkbench } from './BattingWorkbench';

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };
const player = () => {
  const value = structuredClone(defaultWorkbenchPlayer()) as Mutable<WorkbenchPlayer>;
  value.capability.positionErrorMeters = 0; value.capability.timingErrorTicks = 0;
  value.decision.approach = 'SWING'; return value;
};
const input = () => ({ player: player(), seed: 1234,
  pitch: { speedMps: 40, spinRpm: 2200, spinAxis: 'backspin' as const, courseX: 0, courseY: 1 }, throughSeconds: 8 });

it('creates one body-attached rigid bat path and feeds its actual collision to Core Aero/ground physics', () => {
  const result = simulateBattingWorkbench(input());
  expect(result.contact).not.toBeNull();
  expect(result.flightFrames.length).toBeGreaterThan(100);
  for (const f of result.batFrames) {
    expect(Math.hypot(f.tip.x - f.grip.x, f.tip.y - f.grip.y, f.tip.z - f.grip.z)).toBeCloseTo(result.player.bat.lengthM, 9);
    expect(f.body.hands[0]).toEqual(f.grip);
  }
  expect(result.authority).toBe('CORE_PHYSICAL_BATTING_WORKBENCH');
  expect(result.officialResult).toBeNull();
});

it('changing actual bat speed changes impulse and batted-ball velocity rather than a hit probability', () => {
  const slow = input(), fast = input();
  slow.player.swing.speedMps = 25; fast.player.swing.speedMps = 39;
  const a = simulateBattingWorkbench(slow), b = simulateBattingWorkbench(fast);
  expect(a.contact).not.toBeNull(); expect(b.contact).not.toBeNull();
  expect(b.metrics.exitSpeedMps!).toBeGreaterThan(a.metrics.exitSpeedMps!);
  expect(b.contact!.exitSpin).not.toEqual(a.contact!.exitSpin);
});

it('a late motor cannot retroactively meet the pitch, and a take creates no contact', () => {
  const late = input(); late.player.capability.motorLatencyTicks = 800_000;
  expect(simulateBattingWorkbench(late).contact).toBeNull();
  const take = input(); take.player.decision.approach = 'TAKE';
  expect(simulateBattingWorkbench(take).contact).toBeNull();
});

it('replays the same physical inputs and preserves league labels as display-only context', () => {
  const original = input(), anotherLeague = input();
  anotherLeague.player.identity.leagueId = 'NLB';
  const a = simulateBattingWorkbench(original), b = simulateBattingWorkbench(anotherLeague);
  expect(a.contact).toEqual(b.contact); expect(a.flightFrames).toEqual(b.flightFrames);
  expect(simulateBattingWorkbench(original)).toEqual(a);
});

it('rejects invalid source course/timing and maintains source speed limits', () => {
  expect(() => simulateBattingWorkbench({ ...input(), seed: NaN })).toThrow();
  expect(() => simulateBattingWorkbench({ ...input(), pitch: { ...input().pitch, speedMps: Infinity } })).toThrow();
  const tooFast = input(); tooFast.player.swing.speedMps = 80;
  expect(() => simulateBattingWorkbench(tooFast)).toThrow();
});

it('keeps both actual arm bone lengths on the near-folded regression path', () => {
  const scenario = input();
  scenario.player.swing.contactDepthM = 0.1482153846153846;
  scenario.pitch.courseX = -0.1242; scenario.pitch.courseY = 1.152;
  const result = simulateBattingWorkbench(scenario);
  const distance = (a: { x: number; y: number; z: number }, b: typeof a) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (const frame of result.batFrames) for (let arm = 0; arm < 2; arm++) {
    expect(distance(frame.body.shoulders[arm], frame.body.elbows[arm])).toBeCloseTo(result.player.body.heightMeters * 0.18, 6);
    expect(distance(frame.body.elbows[arm], frame.body.hands[arm])).toBeCloseTo(result.player.body.heightMeters * 0.16, 6);
  }
});

it('mirrors the body and contact for right/left hitters at a constrained course', () => {
  const right = input(), left = input();
  right.player.body.heightMeters = left.player.body.heightMeters = 1.2;
  right.pitch.courseX = 0.3; left.pitch.courseX = -0.3;
  right.pitch.courseY = left.pitch.courseY = 0.768;
  left.player.identity.bats = 'L';
  const a = simulateBattingWorkbench(right), b = simulateBattingWorkbench(left);
  expect(a.contact).not.toBeNull(); expect(b.contact).not.toBeNull();
  expect(a.contact!.tick).toBe(b.contact!.tick);
  expect(a.metrics.exitSpeedMps).toBeCloseTo(b.metrics.exitSpeedMps!, 8);
});

it('detects contact that starts and ends between the old 1ms sample endpoints', () => {
  const scenario = input(); scenario.player.capability.motorLatencyTicks = 1_000;
  scenario.player.swing.speedMps = 70; scenario.player.capability.maximumSweetSpotSpeedMps = 90;
  scenario.pitch.speedMps = 80;
  expect(simulateBattingWorkbench({ ...scenario, positionOffsetM: 0.055 }).contact).not.toBeNull();
});

it('audits the actual motor speed independently of the 4ms drawing frames', () => {
  const scenario = input(); scenario.player.swing.speedMps = 45;
  scenario.player.capability.maximumSweetSpotSpeedMps = 45;
  scenario.player.swing.preContactSeconds = 0.005; scenario.player.swing.loadAngleDeg = -1.1;
  expect(() => simulateBattingWorkbench({ ...scenario, timingOffsetMs: 0.845 })).toThrow('身体上限');
});

it('keeps the same pitched ball when only authored contact depth changes', () => {
  const before = input(), after = input(); after.player.swing.contactDepthM = 0.2;
  const a = simulateBattingWorkbench(before), b = simulateBattingWorkbench(after);
  const commonEnd = Math.min(a.contact?.tick ?? Infinity, b.contact?.tick ?? Infinity);
  expect(a.pitchFrames.filter(f => f.tick < commonEnd && f.tick % 8_000 === 0))
    .toEqual(b.pitchFrames.filter(f => f.tick < commonEnd && f.tick % 8_000 === 0));
});

it('does not make a visible held bat transparent when the hitter takes', () => {
  const scenario = input(); scenario.player.decision.approach = 'TAKE';
  scenario.player.swing.loadAngleDeg = -1.1;
  const result = simulateBattingWorkbench(scenario);
  expect(result.contact).not.toBeNull();
  expect(result.batFrames.every(f => f.grip.x === result.batFrames[0].grip.x && f.tip.z === result.batFrames[0].tip.z)).toBe(true);
  expect(result.diagnostics.some(d => d.includes('静止バット'))).toBe(true);
});
