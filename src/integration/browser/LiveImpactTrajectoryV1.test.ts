import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { DEFAULT_IMPACT_TRAJECTORY_V1, DEFAULT_WHOLE_ARC_TRAJECTORY_V1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const clips = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')).clips as LiveMeasuredClipV1[];
const input = (side: 'R' | 'L' = 'R', seed = 1): LivePitchInputV1 => ({
  originTick: 1234567, seed, batter: { heightMeters: 1.8, bats: side, batLengthM: .84, batMassKg: .88, swingRate: 1,
    timingStdSeconds: 0, aimStdMeters: 0, chaseMarginMeters: .2, clipId: clips.find(c => c.side === side)!.id },
  pitcher: { releaseSpeedMps: 42, spinRadPerSecond: { x: 230, y: 0, z: 0 }, commandStdMeters: 0 },
  measuredClips: clips, batting: 'balanced', pitchType: 'fastball', location: 'zone', physics: { kind: 'aero_ground_v1',
    air: { ticksPerSecond: 1e6, integrationStepTicks: 5000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
    ground: { ticksPerSecond: 1e6, gravityMps2: 9.81, radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .2,
      material: { restitution: .48, slidingFriction: .24, rollingDecelerationMps2: .36, normalSpinDecayPerSecond: .18 } } },
});
const sweet = (pose: NonNullable<ReturnType<typeof simulateLivePitchV1>['frames'][number]['bat']>, t: number) => ({
  x: pose.grip.x + (pose.tip.x - pose.grip.x) * t,
  y: pose.grip.y + (pose.tip.y - pose.grip.y) * t,
  z: pose.grip.z + (pose.tip.z - pose.grip.z) * t,
});

it.each(['R', 'L'] as const)('zero-angle %s settings keep every original physical ball/bat frame and collision', side => {
  const source = input(side), before = JSON.stringify(source), baseline = simulateLivePitchV1(source),
    zero = simulateLivePitchV1({ ...source, batter: { ...source.batter, impactTrajectory: DEFAULT_IMPACT_TRAJECTORY_V1 } });
  expect(zero.frames).toEqual(baseline.frames); expect(zero.contact).toEqual(baseline.contact); expect(zero.call).toEqual(baseline.call);
  expect(zero.diagnostics.playbackRate).toBe(baseline.diagnostics.playbackRate);
  expect(zero.diagnostics.referenceStartTick).toBe(baseline.diagnostics.referenceStartTick);
  expect(zero.diagnostics.referenceThroughTick).toBe(baseline.diagnostics.referenceThroughTick);
  expect(baseline.diagnostics).not.toHaveProperty('impactTrajectory'); expect(JSON.stringify(source)).toBe(before);
});
it.each(['R', 'L'] as const)('adjusts only the contact neighborhood for %s, with the same release Source and intended contact point/time', side => {
  const source = input(side), baseline = simulateLivePitchV1(source),
    changed = simulateLivePitchV1({ ...source, batter: { ...source.batter, impactTrajectory: { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 } } }),
    d = changed.diagnostics, old = baseline.diagnostics;
  expect(d.sourceDescriptor).toEqual(old.sourceDescriptor); expect(d.referenceContactTick).toBe(old.referenceContactTick);
  const at = changed.sampleBatAtTick(d.referenceContactTick)!, original = baseline.sampleBatAtTick(old.referenceContactTick)!;
  const a = sweet(at, d.sweetSpotT), b = sweet(original, old.sweetSpotT);
  expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-12);
  expect(at).not.toEqual(original);
  const angle = (v: { x: number; y: number; z: number }) => Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI;
  expect(angle(d.referenceContactSweetSpotVelocity) - angle(old.referenceContactSweetSpotVelocity)).toBeCloseTo(20, 8);
  expect(d.impactTrajectory!.launchAngleOrSpinOverridden).toBe(false);
  expect(changed.sampleBatAtTick(d.referenceContactTick - .11 / d.playbackRate * 1e6)).toEqual(baseline.sampleBatAtTick(old.referenceContactTick - .11 / old.playbackRate * 1e6));
});
it('recomputes the actual adjusted velocity ceiling, without assigning a ball launch angle or spin', () => {
  const source = input(), limit = 15, changed = simulateLivePitchV1({ ...source, batter: { ...source.batter,
    maximumSweetSpotSpeedMps: limit, targetSweetSpotSpeedMps: limit, impactTrajectory: { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 4 } } });
  expect(changed.diagnostics.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(limit * (1 + 1e-10));
  expect(changed.diagnostics.referenceContactSweetSpotSpeedMps).toBeLessThanOrEqual(limit * (1 + 1e-10));
  expect(changed.diagnostics.impactTrajectory!.speedCeilingRecomputed).toBe(true);
  expect(changed.diagnostics.impactTrajectory!.launchAngleOrSpinOverridden).toBe(false);
});
it('leaves legacy automatic clip selection unchanged when expanded clips are opt-in only', () => {
  const source = input(), { clipId: _clipId, ...batter } = source.batter,
    extra = { ...clips[0], id: 'obp-extra-research', defaultSelection: false }, expanded = [...clips, extra];
  for (const seed of [1, 2, 3, 7, 1234]) {
    const old = simulateLivePitchV1({ ...source, seed, batter }), fresh = simulateLivePitchV1({ ...source, seed, batter, measuredClips: expanded });
    expect(fresh.frames).toEqual(old.frames); expect(fresh.contact).toEqual(old.contact); expect(fresh.diagnostics).toEqual(old.diagnostics);
  }
  expect(simulateLivePitchV1({ ...source, batter: { ...batter, clipId: extra.id }, measuredClips: expanded }).clipId).toBe(extra.id);
  expect(() => simulateLivePitchV1({ ...source, batter: { ...batter, bats: 'L', clipId: extra.id }, measuredClips: expanded })).toThrow(/actual batting side/);
  expect(() => simulateLivePitchV1({ ...source, batter: { ...batter, clipId: 'obp-missing' }, measuredClips: expanded })).toThrow(/actual batting side/);
});
it('validates and preserves optional per-player JSON, and reaches a real ordinary match without changing other players', () => {
  const fixture = liveMatchFixture(2468), playerId = fixture.teams[0].battingOrder[0], settings = { ...DEFAULT_IMPACT_TRAJECTORY_V1, level: 3 as const },
    roster = { version: 'live_physical_roster_v1', sourceId: 'impact-research', entries: [{ playerId, sourceId: 'impact-authored',
      physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', impactTrajectory: settings } }] }, before = JSON.stringify(roster),
    projected = applyLivePhysicalRosterV1({ players: fixture.players, roster: JSON.parse(before) });
  expect(projected.players.find(p => p.playerId === playerId)!.physical.impactTrajectory).toEqual(settings);
  expect(projected.players.filter(p => p.playerId !== playerId).every(p => p.physical.impactTrajectory === undefined)).toBe(true);
  const issued = createLiveBaseballMatchV1({ ...fixture, players: projected.players }).issuePitch({ batting: 'take', managedTeam: 0, pitchType: 'fastball', location: 'zone' });
  expect((issued.play.diagnostics as { impactTrajectory: unknown }).impactTrajectory).toMatchObject(settings);
  expect(JSON.stringify(roster)).toBe(before);
  const malformed = { ...roster, entries: [{ ...roster.entries[0], physical: { ...roster.entries[0].physical, impactTrajectory: { ...settings, level: 0 } } }] };
  expect(() => applyLivePhysicalRosterV1({ players: fixture.players, roster: malformed })).toThrow(/impact trajectory/);
});
it('finishes a full ordinary nine-inning match with imported per-player trajectory edits and physical live plays', () => {
  const fixture=liveMatchFixture(2468), roster={version:'live_physical_roster_v1',sourceId:'impact-regulation-test',
    entries:[{playerId:'0-b0',sourceId:'impact-regulation-left',physical:{basis:'EXPLICIT_AUTHORED_SI_V1',
      impactTrajectory:{...DEFAULT_IMPACT_TRAJECTORY_V1,level:3}}},
    {playerId:'1-b1',sourceId:'impact-regulation-right',physical:{basis:'EXPLICIT_AUTHORED_SI_V1',
      impactTrajectory:{...DEFAULT_IMPACT_TRAJECTORY_V1,level:1}}}]},
    projected=applyLivePhysicalRosterV1({players:fixture.players,roster}),host=createLiveBaseballMatchV1({...fixture,players:projected.players});
  let pitches=0,contacts=0,edited=0;
  while(!host.inspect().finished&&pitches<700){
    const record=host.issuePitch({batting:pitches%7===0?'power':pitches%5===0?'contact':'balanced',pitchType:'auto',location:'auto',managedTeam:0});
    const d=record.play.diagnostics as {impactTrajectory?:unknown};if(d.impactTrajectory)edited++;
    if(record.play.contact){contacts++;expect(record.play.field!.end.complete).toBe(true);
      expect(record.play.field!.frames[0].ball.velocity).toEqual((record.play.contact as {exitVelocity:unknown}).exitVelocity);}
    pitches++;
  }
  expect(host.inspect().finished).toBe(true);expect(host.inspect().match.inning).toBeGreaterThanOrEqual(9);
  expect(pitches).toBeGreaterThan(54);expect(contacts).toBeGreaterThan(5);expect(edited).toBeGreaterThan(5);
},120_000);

it.each(['R', 'L'] as const)('uses absolute whole-arc targets for %s after authored direction controls without changing speed or release Source', side => {
  const source = input(side), batter = { ...source.batter, attackAngleDegrees: 15, pullAngleDegrees: 12,
    maximumSweetSpotSpeedMps: 35, targetSweetSpotSpeedMps: 30 }, baseline = simulateLivePitchV1({ ...source, batter });
  for (const level of [1, 2, 3, 4] as const) {
    const changed = simulateLivePitchV1({ ...source, batter: { ...batter, impactTrajectory: { ...DEFAULT_WHOLE_ARC_TRAJECTORY_V1, level } } }),
      d = changed.diagnostics, old = baseline.diagnostics, v = d.referenceContactSweetSpotVelocity;
    expect(Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI).toBeCloseTo(DEFAULT_WHOLE_ARC_TRAJECTORY_V1.angleDegreesByLevel[level - 1], 8);
    expect(d.sourceDescriptor).toEqual(old.sourceDescriptor); expect(d.playbackRate).toBe(old.playbackRate);
    expect(d.referenceStartTick).toBe(old.referenceStartTick); expect(d.referenceThroughTick).toBe(old.referenceThroughTick);
    expect(d.referenceContactTick).toBe(old.referenceContactTick);
    expect(d.referenceMaximumSweetSpotSpeedMps).toBe(old.referenceMaximumSweetSpotSpeedMps);
    expect(d.referenceContactSweetSpotSpeedMps).toBeCloseTo(old.referenceContactSweetSpotSpeedMps, 10);
    expect(d.referenceMaximumSweetSpotSpeedMps).toBeLessThanOrEqual(35 * (1 + 1e-10));
    expect(d.impactTrajectory).toMatchObject({ method: 'whole-arc-target', model: 'WHOLE_ARC_RIGID_CONTACT_PIVOT_TARGET', launchAngleOrSpinOverridden: false });
    const at = changed.sampleBatAtTick(d.referenceContactTick)!, original = baseline.sampleBatAtTick(old.referenceContactTick)!,
      a = sweet(at, d.sweetSpotT), b = sweet(original, old.sweetSpotT);
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-12);
    // Both physical output frames and replay observe the exact shared sampler.
    for (const frame of changed.frames.filter(f => f.bat !== null)) {
      const sampled = changed.sampleBatAtTick(source.originTick + frame.elapsedSeconds * 1e6)!;
      expect(sampled.grip).toEqual(frame.bat!.grip); expect(sampled.tip).toEqual(frame.bat!.tip);
    }
  }
});
it('round-trips new per-player JSON and admits forms shorter than legacy adjustment windows before an ordinary pitch', () => {
  const fixture = liveMatchFixture(2468), playerId = fixture.teams[0].battingOrder[0],
    player = fixture.players.find(p => p.playerId === playerId)!, clip = fixture.measuredClips.find(c => c.side === player.bats)!,
    sourceContact = clip.contactTimeSeconds * 1e6,
    shortClip = { ...clip, frames: clip.frames.filter(f => f.tick >= sourceContact - 50_000 && f.tick <= sourceContact + 30_000) },
    settings = { ...DEFAULT_WHOLE_ARC_TRAJECTORY_V1, level: 2 as const },
    roster = { version: 'live_physical_roster_v1', sourceId: 'whole-arc-json', entries: [{ playerId, sourceId: 'whole-arc-authored',
      physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', clipId: shortClip.id, impactTrajectory: settings } }] },
    before = JSON.stringify(roster), projected = applyLivePhysicalRosterV1({ players: fixture.players, roster: JSON.parse(before) }),
    matchInput = { ...fixture, measuredClips: fixture.measuredClips.map(c => c.id === shortClip.id ? shortClip : c), players: projected.players },
    host = createLiveBaseballMatchV1(matchInput), record = host.issuePitch({ batting: 'take', managedTeam: 0, pitchType: 'fastball', location: 'zone' });
  expect(projected.players.find(p => p.playerId === playerId)!.physical.impactTrajectory).toEqual(settings);
  expect(projected.players.filter(p => p.playerId !== playerId).every(p => p.physical.impactTrajectory === undefined)).toBe(true);
  expect((record.play.diagnostics as { impactTrajectory: unknown }).impactTrajectory).toMatchObject(settings);
  expect(JSON.stringify(roster)).toBe(before);
  const legacyPlayers = projected.players.map(p => p.playerId === playerId ? { ...p, physical: { ...p.physical,
    impactTrajectory: DEFAULT_IMPACT_TRAJECTORY_V1 } } : p);
  expect(() => createLiveBaseballMatchV1({ ...matchInput, players: legacyPlayers })).toThrow(/window exceeds/);
});
