import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { liveAthleticControlBoundsV115, resolveLiveAthleticProfileV115, type LiveAthleticControlsV115 } from '../../core/sim/LiveAthleticControlsV115';
import { defaultWorkbenchPlayer } from './WorkbenchPlayer';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { applyLivePhysicalRosterV1, getLiveInternalValueLimitsV82 } from './LivePhysicalRosterV1';
import { setLiveTraitProfileV1, type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';
import { buildPitcherWorkbenchInputV77, simulatePitcherWorkbenchV77 } from './PitcherWorkbenchV77';

const players = [{ playerId: 'batter-a', name: 'Authored player', heightMeters: 1.8, bats: 'R' as const }];
const packet = (entry: Record<string, unknown>) => ({ players, roster: { version: 'live_physical_roster_v1', sourceId: 'test-roster',
  entries: [{ playerId: 'batter-a', sourceId: 'test-authoring', ...entry }] } });

it('validates V98 field-only reaction scale and neutralizes an omitted legacy value over an already upgraded player', () => {
  const source = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', fieldingReactionScaleV98: .8 } }),
    changed = applyLivePhysicalRosterV1(source);
  expect(changed.players[0].physical.fieldingReactionScaleV98).toBe(.8);
  for (const scale of [0, 1, 4]) expect(applyLivePhysicalRosterV1(packet({ physical: {
    basis: 'EXPLICIT_AUTHORED_SI_V1', fieldingReactionScaleV98: scale } })).players[0].physical.fieldingReactionScaleV98).toBe(scale);
  for (const scale of [-.01, 4.01, NaN, Infinity]) expect(() => applyLivePhysicalRosterV1(packet({ physical: {
    basis: 'EXPLICIT_AUTHORED_SI_V1', fieldingReactionScaleV98: scale } }))).toThrow();
  const old = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', reactionSeconds: .33 } });
  const imported = applyLivePhysicalRosterV1({ ...old, players: changed.players });
  expect(imported.players[0].physical.fieldingReactionScaleV98).toBe(1);
  expect(imported.players[0].physical.reactionSeconds).toBe(.33);
  expect(changed.players[0].physical.fieldingReactionScaleV98).toBe(.8);
  const empty = applyLivePhysicalRosterV1({ players: changed.players, roster: { ...old.roster, entries: [] } });
  expect(empty.players[0].physical.fieldingReactionScaleV98).toBe(1);
});

it('accepts source-consistent trait metadata, preserves it on players and executes its numerical source once', () => {
  const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', badBallControl: .73, aimStdMeters: .04 } }),
    roster = raw.roster as LiveTraitRosterInputV1, before = JSON.stringify(raw),
    on = setLiveTraitProfileV1({ roster, playerId: 'batter-a', familyId: 'bad_ball_hitting', stateId: 'LEARNED' }),
    active = applyLivePhysicalRosterV1({ players, roster: JSON.parse(JSON.stringify(on.roster)) }),
    off = setLiveTraitProfileV1({ roster: on.roster, playerId: 'batter-a', familyId: 'bad_ball_hitting', stateId: null }),
    inactive = applyLivePhysicalRosterV1({ players: active.players, roster: off.roster });
  expect(active.players[0].traitProfile).toEqual(on.roster.entries[0].traitProfile);
  expect(active.players[0].physical.badBallControl).toBe(.73);
  expect(inactive.players[0].physical.badBallControl).toBe(0);
  expect(inactive.players[0].physical.aimStdMeters).toBe(.04);
  expect(inactive.players[0].traitProfile).toEqual(off.roster.entries[0].traitProfile);
  expect(active.audit.players[0].projected.filter(item => item.targetPath === 'badBallControl')).toHaveLength(1);
  expect(Object.isFrozen(active.players[0].traitProfile)).toBe(true);
  const legacy = applyLivePhysicalRosterV1({ players: active.players, roster });
  expect(legacy.players[0]).not.toHaveProperty('traitProfile');
  expect(legacy.players[0].physical.badBallControl).toBe(.73);
  expect(JSON.stringify(raw)).toBe(before);
});

it('checks trait metadata against the final workbench source and rejects false labels without partial updates', () => {
  const maker = defaultWorkbenchPlayer(), raw = packet({ workbenchPlayer: maker }), roster = raw.roster as LiveTraitRosterInputV1,
    owned = setLiveTraitProfileV1({ roster, playerId: 'batter-a', familyId: 'bad_ball_hitting', stateId: 'LEARNED', source: { badBallControl: .73 } }),
    projected = applyLivePhysicalRosterV1({ players, roster: owned.roster }), before = JSON.stringify(owned.roster);
  expect(projected.players[0].physical.badBallControl).toBe(.73);
  expect(projected.players[0].traitProfile).toEqual(owned.roster.entries[0].traitProfile);
  const invalid = structuredClone(owned.roster);
  Object.defineProperty(invalid.entries[0].workbenchPlayer!.traits, 'badBallControl', { value: .11 });
  expect(() => applyLivePhysicalRosterV1({ players, roster: invalid })).toThrow();
  const unknown = { ...owned.roster, entries: [{ ...owned.roster.entries[0], traitProfile: { version: 'live_trait_profile_v1',
    selections: [{ familyId: 'bad_ball_hitting', stateId: 'GOLD', source: { badBallControl: .73 } }] } }] };
  expect(() => applyLivePhysicalRosterV1({ players, roster: unknown })).toThrow();
  expect(JSON.stringify(owned.roster)).toBe(before);
});

it('passes ON/OFF controls to Host and retains take and judgment error independently of adaptive auto pitching', () => {
  const fixture = liveMatchFixture(2468), batter = fixture.teams[0].battingOrder[0],
    roster: LiveTraitRosterInputV1 = { version: 'live_physical_roster_v1', sourceId: 'actual-trait-test', entries: [
      { playerId: batter, sourceId: 'actual-technique', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', badBallControl: .83 } }] },
    on = setLiveTraitProfileV1({ roster, playerId: batter, familyId: 'bad_ball_hitting', stateId: 'LEARNED' }),
    off = setLiveTraitProfileV1({ roster: on.roster, playerId: batter, familyId: 'bad_ball_hitting', stateId: null }),
    issue = (packet: LiveTraitRosterInputV1) => {
      const projected = applyLivePhysicalRosterV1({ players: fixture.players, roster: packet });
      return createLiveBaseballMatchV1({ ...fixture, players: projected.players })
        .issuePitch({ batting: 'take', managedTeam: 0, pitchType: 'auto', location: 'auto' });
    }, a = issue(on.roster), b = issue(off.roster);
  type Diagnostics = { individualControls: { badBallControl: number }; swingOffered: boolean;
    zoneJudgment: { standardDeviationMeters: number; errorMeters: unknown; stream: string; basis: string } };
  const ad = a.play.diagnostics as Diagnostics, bd = b.play.diagnostics as Diagnostics;
  expect(ad.individualControls.badBallControl).toBe(.83);
  expect(bd.individualControls.badBallControl).toBe(0);
  expect(ad.swingOffered).toBe(false); expect(bd.swingOffered).toBe(false);
  expect(a.play.contact).toBeNull(); expect(b.play.contact).toBeNull();
  expect(a.play.field).toBeNull(); expect(b.play.field).toBeNull();
  // Auto pitching can respond to the opponent's raw technique. Only the
  // judgment error distribution, not the observed ball position, is invariant.
  expect(bd.zoneJudgment.standardDeviationMeters).toBe(ad.zoneJudgment.standardDeviationMeters);
  expect(bd.zoneJudgment.errorMeters).toEqual(ad.zoneJudgment.errorMeters);
  expect(bd.zoneJudgment.stream).toBe(ad.zoneJudgment.stream);
  expect(bd.zoneJudgment.basis).toBe(ad.zoneJudgment.basis);
});

it('keeps every taken-pitch frame and judgment identical when only bad-ball control changes under a fixed command', () => {
  const fixture = liveMatchFixture(2468), batter = fixture.teams[0].battingOrder[0],
    roster: LiveTraitRosterInputV1 = { version: 'live_physical_roster_v1', sourceId: 'actual-trait-test', entries: [
      { playerId: batter, sourceId: 'actual-technique', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', badBallControl: .83 } }] },
    on = setLiveTraitProfileV1({ roster, playerId: batter, familyId: 'bad_ball_hitting', stateId: 'LEARNED' }),
    off = setLiveTraitProfileV1({ roster: on.roster, playerId: batter, familyId: 'bad_ball_hitting', stateId: null }),
    issue = (packet: LiveTraitRosterInputV1) => {
      const input = buildPitcherWorkbenchInputV77({ players: fixture.players, roster: packet,
        pitcherId: fixture.teams[1].pitcherId, batterId: batter, catcherId: fixture.teams[1].defense.C,
        measuredClips: fixture.measuredClips, seed: (fixture.seed + Math.imul(1, 0x9e3779b9)) >>> 0,
        originTick: 1000000, pitchType: 'fastball', location: 'zone' });
      return { input, pitch: simulatePitcherWorkbenchV77({ pitch: input }).pitch };
    }, a = issue(on.roster), b = issue(off.roster);
  expect(a.input.batter.badBallControl).toBe(.83); expect(b.input.batter.badBallControl).toBe(0);
  expect({ ...a.input, batter: { ...a.input.batter, badBallControl: 0 } }).toEqual(b.input);
  expect(a.pitch.diagnostics.swingOffered).toBe(false); expect(b.pitch.diagnostics.swingOffered).toBe(false);
  expect(a.pitch.frames).toEqual(b.pitch.frames);
  expect(a.pitch.diagnostics.zoneJudgment).toEqual(b.pitch.diagnostics.zoneJudgment);
});

it('projects optional tactical preferences without changing the physical abilities or input packet', () => {
  const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', baserunningSafetyMarginSeconds: .7, fieldingPursuitCostWeight: .5 } }),
    before = JSON.stringify(raw), projected = applyLivePhysicalRosterV1(raw);
  expect(projected.players[0].physical).toEqual({ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, baserunningSafetyMarginSeconds: .7, fieldingPursuitCostWeight: .5 });
  for (const [path, value] of [['baserunningSafetyMarginSeconds', .7], ['fieldingPursuitCostWeight', .5]] as const)
    expect(projected.audit.players[0].projected).toContainEqual(expect.objectContaining({ inputPath: 'physical.' + path, targetPath: path, value }));
  expect(JSON.stringify(raw)).toBe(before);
  expect(Object.isFrozen(projected.players[0].physical)).toBe(true);
  const old = applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } }));
  expect(old.players[0].physical).toEqual(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1);
  expect(old.players[0].physical).not.toHaveProperty('baserunningSafetyMarginSeconds');
  expect(old.players[0].physical).not.toHaveProperty('fieldingPursuitCostWeight');
});

it('preserves authored rounding controls without materializing omitted runner defaults', () => {
  const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', baserunningTurnRadiusMeters: 3.2,
    baserunningLateralAccelerationMps2: 8.4 } }), before = JSON.stringify(raw), projected = applyLivePhysicalRosterV1(raw);
  expect(projected.players[0].physical).toEqual({ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    baserunningTurnRadiusMeters: 3.2, baserunningLateralAccelerationMps2: 8.4 });
  for (const [path, value] of [['baserunningTurnRadiusMeters', 3.2], ['baserunningLateralAccelerationMps2', 8.4]] as const)
    expect(projected.audit.players[0].projected).toContainEqual(expect.objectContaining({ inputPath: 'physical.' + path, targetPath: path, value }));
  expect(JSON.stringify(raw)).toBe(before);
  expect(Object.isFrozen(projected.players[0].physical)).toBe(true);
  const old = applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', accelerationMps2: 6 } }));
  expect(old.players[0].physical).not.toHaveProperty('baserunningTurnRadiusMeters');
  expect(old.players[0].physical).not.toHaveProperty('baserunningLateralAccelerationMps2');
});

it.each([
  ['plateVision', 1, 100, 0, 100.001],
  ['baserunningSafetyMarginSeconds', 0, 3, -.001, 3.001],
  ['fieldingPursuitCostWeight', .25, 4, .249, 4.001],
  ['baserunningTurnRadiusMeters', .5, 10, .499, 10.001],
  ['baserunningLateralAccelerationMps2', .5, 20, .499, 20.001],
] as const)('validates %s at both roster and direct Host boundaries', (key, min, max, below, above) => {
  const fixture = liveMatchFixture();
  const hostInput = (value: number) => ({ ...fixture, players: fixture.players.map((p, i) => i ? p : { ...p,
    physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, [key]: value } }) });
  for (const value of [min, max]) {
    expect(applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } })).players[0].physical[key]).toBe(value);
    expect(() => createLiveBaseballMatchV1(hostInput(value))).not.toThrow();
  }
  for (const value of [below, above, NaN, Infinity]) {
    expect(() => applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } }))).toThrow();
    expect(() => createLiveBaseballMatchV1(hostInput(value))).toThrow();
  }
});

it('projects explicit course judgment precision independently of chase margin and swing preference', () => {
  const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', zoneJudgmentStdMeters: .12 } }), before = JSON.stringify(raw),
    projected = applyLivePhysicalRosterV1(raw);
  expect(projected.players[0].physical.zoneJudgmentStdMeters).toBe(.12);
  expect(projected.players[0].physical.chaseMarginMeters).toBe(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.chaseMarginMeters);
  expect(projected.audit.players[0].projected).toContainEqual(expect.objectContaining({ inputPath: 'physical.zoneJudgmentStdMeters', targetPath: 'zoneJudgmentStdMeters', value: .12 }));
  expect(JSON.stringify(raw)).toBe(before);
  for (const zoneJudgmentStdMeters of [-.001, .60001, NaN, Infinity]) expect(() => applyLivePhysicalRosterV1(packet({
    physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', zoneJudgmentStdMeters } }))).toThrow();
  const match = liveMatchFixture();
  expect(() => createLiveBaseballMatchV1({ ...match, players: match.players.map((p, i) => i ? p : { ...p,
    physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, zoneJudgmentStdMeters: -.1 } }) })).toThrow();
});

it('passes absolute vision through JSON/roster/Host without adding a physical pitch or batting bonus', () => {
  const fixture = liveMatchFixture(2468), batter = fixture.teams[0].battingOrder[0],
    issue = (plateVision: number) => {
      const roster = JSON.parse(JSON.stringify({ version: 'live_physical_roster_v1', sourceId: 'absolute-eye-test',
        entries: [{ playerId: batter, sourceId: 'explicit-eye', physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', plateVision } }] }));
      const projected = applyLivePhysicalRosterV1({ players: fixture.players, roster });
      expect(projected.players.find(p => p.playerId === batter)!.physical.plateVision).toBe(plateVision);
      return createLiveBaseballMatchV1({ ...fixture, players: projected.players })
        .issuePitch({ batting: 'take', managedTeam: 0, pitchType: 'auto', location: 'auto' });
    }, low = issue(1), high = issue(100);
  expect(high.frames).toEqual(low.frames);
  expect(high.play).toEqual(low.play);
  expect(high.match).toEqual(low.match);
});

it('projects explicit maker SI, keeps the binding and original data, and exposes remaining unsupported controls', () => {
  const maker = defaultWorkbenchPlayer(), input = packet({ workbenchPlayer: maker }), before = JSON.stringify(input);
  const result = applyLivePhysicalRosterV1(input), physical = result.players[0].physical!;
  expect(physical.batLengthM).toBe(maker.bat.lengthM);
  expect(physical.batMassKg).toBe(maker.bat.massKg);
  expect(physical.maximumSweetSpotSpeedMps).toBe(maker.capability.maximumSweetSpotSpeedMps);
  expect(physical.targetSweetSpotSpeedMps).toBe(maker.swing.speedMps);
  expect(physical.motorLatencySeconds).toBe(maker.capability.motorLatencyTicks / 1e6);
  expect(physical.technicalTimingOffsetSeconds).toBe(maker.capability.technicalTimingOffsetTicks / 1e6);
  expect(physical.timingStdSeconds).toBe(maker.capability.timingErrorTicks / 1e6);
  expect(physical.aimStdMeters).toBe(maker.capability.positionErrorMeters);
  expect(physical.topSpeedMps).toBe(maker.capability.runSpeedMps);
  expect(physical.throwSpeedMps).toBe(maker.capability.throwSpeedMps);
  expect(physical.releaseSpeedMps).toBe(maker.capability.pitchSpeedMps);
  expect(physical.swingDecision).toEqual(maker.decision);
  expect(physical.badBallControl).toBe(maker.traits.badBallControl);
  expect(result.players[0].playerId).toBe('batter-a');
  expect(result.audit.players[0].sourcePlayerId).toBe(maker.identity.playerId);
  expect(result.audit.players[0].unsupported.map(x => x.path)).toContain('workbenchPlayer.body.massKg');
  expect(result.audit.nativeAuthentication).toBe(false); expect(result.audit.projectionOnly).toBe(true);
  expect(JSON.stringify(input)).toBe(before); expect(Object.isFrozen(result.players[0].physical)).toBe(true);
});
it('converts an explicit 151 km/h maximum as a limit, without declaring a measured mean or spin', () => {
  const result = applyLivePhysicalRosterV1(packet({ maximumPitchSpeedKmh: 151 }));
  expect(result.players[0].physical!.maximumPitchSpeedMps).toBe(151 / 3.6);
  expect(result.players[0].physical!.releaseSpeedMps).toBe(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.releaseSpeedMps);
  expect(result.players[0].physical!.spinRadPerSecond).toEqual(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.spinRadPerSecond);
  expect(result.audit.players[0].projected).toContainEqual(expect.objectContaining({ inputPath: 'maximumPitchSpeedKmh', targetPath: 'maximumPitchSpeedMps', conversion: 'km/h / 3.6' }));
});
it('passes explicit SI and defensive decision latency without relative rating conversion', () => {
  const result = applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', topSpeedMps: 9.1,
    defensiveDecisionSeconds: .27, spinRadPerSecond: { x: -200, y: 30, z: 4 } } }));
  expect(result.players[0].physical).toMatchObject({ topSpeedMps: 9.1, defensiveDecisionSeconds: .27, spinRadPerSecond: { x: -200, y: 30, z: 4 } });
});
it('applies an explicit editable common height and refuses conflicting authoring sources', () => {
  const result = applyLivePhysicalRosterV1(packet({ heightMeters: 1.94, physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', throwDirectionStdRadians: .09 } }));
  expect(result.players[0].heightMeters).toBe(1.94); expect(result.players[0].physical.throwDirectionStdRadians).toBe(.09);
  expect(result.audit.players[0].projected).toContainEqual(expect.objectContaining({ inputPath: 'heightMeters', targetPath: 'heightMeters', value: 1.94 }));
  expect(() => applyLivePhysicalRosterV1(packet({ heightMeters: 1.94, workbenchPlayer: defaultWorkbenchPlayer() }))).toThrow('conflicting body heights');
});
it('retains all uncalibrated relative ratings and trait labels as visible unsupported entries', () => {
  const result = applyLivePhysicalRosterV1(packet({ legacyRelativeRatings: { power: 94, vision: 96, badBallControl: 98 }, traitLabels: ['悪球打ち', 'チャンス'] }));
  expect(result.players[0].physical).toEqual(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1);
  expect(result.audit.players[0].unsupported).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'legacyRelativeRatings.power', value: 94 }),
    expect.objectContaining({ path: 'legacyRelativeRatings.vision', value: 96 }),
    expect.objectContaining({ path: 'legacyRelativeRatings.badBallControl', value: 98 }),
    expect.objectContaining({ path: 'traitLabels[0]', value: '悪球打ち' }),
    expect.objectContaining({ path: 'traitLabels[1]', value: 'チャンス' }),
  ]));
});
it('does not infer physical ability from the player name, league or maker display name', () => {
  const maker = defaultWorkbenchPlayer(), one = applyLivePhysicalRosterV1(packet({ workbenchPlayer: maker }));
  const renamed = { ...maker, identity: { ...maker.identity, name: 'Different name', leagueId: 'NLB' as const } };
  const two = applyLivePhysicalRosterV1({ ...packet({ workbenchPlayer: renamed }), players: players.map(p => ({ ...p, name: 'Famous player' })) });
  expect(two.players[0].physical).toEqual(one.players[0].physical);
});
it('feeds the imported limits, motor controls and retained throwing identity into an actual local Host pitch', () => {
  const fixture=liveMatchFixture(2468),batter=fixture.teams[0].battingOrder[0],pitcher=fixture.teams[1].pitcherId,
    projection=applyLivePhysicalRosterV1({players:fixture.players.map(p=>p.playerId===pitcher?{...p,throws:'L'}:p),
      roster:{version:'live_physical_roster_v1',sourceId:'integration-author',entries:[
        {playerId:batter,sourceId:'individual-bat',physical:{basis:'EXPLICIT_AUTHORED_SI_V1',targetSweetSpotSpeedMps:24,maximumSweetSpotSpeedMps:40,zoneJudgmentStdMeters:.12}},
        {playerId:pitcher,sourceId:'individual-pitch',maximumPitchSpeedKmh:151}]}}),
    host=createLiveBaseballMatchV1({...fixture,players:projection.players}),r=host.issuePitch({batting:'take',managedTeam:0,pitchType:'auto',location:'auto'}),
    diagnostics=r.play.diagnostics as {individualControls:{maximumPitchSpeedMps:number;throwingSide:string;targetSweetSpotSpeedMps:number};zoneJudgment:{standardDeviationMeters:number;errorMeters:{x:number;y:number}};sourceDescriptor:{initial:{ball:{position:{x:number}}}}};
  expect(diagnostics.individualControls.maximumPitchSpeedMps).toBe(151/3.6);
  expect(diagnostics.individualControls.targetSweetSpotSpeedMps).toBe(24);
  expect(diagnostics.zoneJudgment.standardDeviationMeters).toBe(.12);
  expect(Math.hypot(diagnostics.zoneJudgment.errorMeters.x,diagnostics.zoneJudgment.errorMeters.y)).toBeGreaterThan(0);
  expect(diagnostics.individualControls.throwingSide).toBe('L');
  // Host geometry uses the pitcher's left (+world x), scaled to actual body
  // height; the legacy ±.18 direct-pitch convention is no longer its Source.
  expect(diagnostics.sourceDescriptor.initial.ball.position.x).toBe(fixture.players.find(p=>p.playerId===pitcher)!.heightMeters*.25);
  expect(r.speedKmh).toBeLessThanOrEqual(151);expect(r.play.call).not.toBeNull();expect(host.inspect().pitchCount).toBe(1);
});
it.each([
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', power: 94 } },
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', defensiveDecisionSeconds: -.1 } },
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', targetSweetSpotSpeedMps: 0 } },
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', badBallControl: 98 } },
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', swingDecision: { approach: 'AUTO', threshold: 2, aggressionWeight: .5 } } },
  { physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', spinRadPerSecond: { x: 0, y: NaN, z: 2 } } },
  { maximumPitchSpeedKmh: -1 },
])('refuses malformed or mislabeled physical authoring %#', entry => {
  expect(() => applyLivePhysicalRosterV1(packet(entry))).toThrow();
});
it('refuses ambiguous authoring, unknown players and duplicate bindings', () => {
  expect(() => applyLivePhysicalRosterV1(packet({ workbenchPlayer: defaultWorkbenchPlayer(), physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } }))).toThrow();
  const input = packet({ maximumPitchSpeedKmh: 151 });
  expect(() => applyLivePhysicalRosterV1({ ...input, roster: { ...input.roster, entries: [{ ...input.roster.entries[0], playerId: 'missing' }] } })).toThrow();
  expect(() => applyLivePhysicalRosterV1({ ...input, roster: { ...input.roster, entries: [input.roster.entries[0], input.roster.entries[0]] } })).toThrow();
});

it('projects experimental bat bounds and rejects invalid equipment atomically', () => {
  const maker = defaultWorkbenchPlayer(), authored = { ...maker, bat: { ...maker.bat, lengthM: 3, massKg: 5 } };
  expect(applyLivePhysicalRosterV1(packet({ workbenchPlayer: authored })).players[0].physical).toMatchObject({ batLengthM: 3, batMassKg: 5 });
  for (const [batLengthM, batMassKg] of [[.2, .1], [3, 5]]) {
    const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', batLengthM, batMassKg } }), before = structuredClone(raw);
    expect(applyLivePhysicalRosterV1(raw).players[0].physical).toMatchObject({ batLengthM, batMassKg }); expect(raw).toEqual(before);
  }
  for (const [key, values] of [['batLengthM', [0, 3.0001, NaN, Infinity]], ['batMassKg', [0, 5.0001, NaN, Infinity]]] as const) {
    for (const value of values) {
      const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } }), before = structuredClone(raw);
      expect(() => applyLivePhysicalRosterV1(raw)).toThrow(); expect(raw).toEqual(before);
    }
  }
});


it('preserves explicit V79 course data through roster/Host JSON and rejects invalid profiles atomically', () => {
  const profile = { version: 'batter_course_profile_v79', referenceAverages: Array(63).fill(.33), effectScale: 1,
    directionWeights: [.1, .2, .4, .2, .1] }, raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', batterCourseProfileV79: profile } }),
    before = JSON.stringify(raw), projected = applyLivePhysicalRosterV1(JSON.parse(before));
  expect(projected.players[0].physical.batterCourseProfileV79).toEqual(profile);
  expect(Object.isFrozen(projected.players[0].physical.batterCourseProfileV79!.referenceAverages)).toBe(true);
  expect(projected.audit.players[0].projected).toContainEqual(expect.objectContaining({ targetPath: 'batterCourseProfileV79', value: profile }));
  expect(JSON.stringify(raw)).toBe(before);
  const fixture = liveMatchFixture(2468), batterId = fixture.teams[0].battingOrder[0],
    hostPlayers = fixture.players.map(p => p.playerId !== batterId ? p : { ...p,
      physical: { ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, batterCourseProfileV79: { ...profile, version: 'batter_course_profile_v79' as const } } });
  expect(() => createLiveBaseballMatchV1({ ...fixture, players: hostPlayers })).not.toThrow();
  for (const effectScale of [-1, 3.001, NaN]) {
    expect(() => applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1',
      batterCourseProfileV79: { ...profile, effectScale } } }))).toThrow();
    expect(() => createLiveBaseballMatchV1({ ...fixture, players: hostPlayers.map(p => p.playerId !== batterId ? p : { ...p,
      physical: { ...p.physical!, batterCourseProfileV79: { ...p.physical!.batterCourseProfileV79!, effectScale } } }) })).toThrow();
  }
  expect(applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } })).players[0].physical).not.toHaveProperty('batterCourseProfileV79');
});


it('V105 preserves explicit body controls and raw omissions while clearing stale overrides on legacy reimport', () => {
  const controls = { fieldArmReachMetersV105: 1.2, fieldShoulderHeightRatioV105: .8, fieldEyeHeightRatioV105: .93,
    fieldCrouchFractionV105: .4, fieldPostureSpeedMpsV105: 3, fieldTurnSpeedRadiansPerSecondV105: 6, fieldRearReachFractionV105: .2 },
    raw = packet({ heightMeters: 2, physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', ...controls } }), before = JSON.stringify(raw),
    projected = applyLivePhysicalRosterV1(raw);
  expect(projected.players[0].heightMeters).toBe(2); expect(projected.players[0].physical).toMatchObject(controls);
  expect(projected.players[0].physical.gloveReachMeters).toBe(1.35); expect(JSON.stringify(raw)).toBe(before);
  const old = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', reactionSeconds: .31 } }),
    restored = applyLivePhysicalRosterV1({ ...old, players: projected.players });
  for (const key of Object.keys(controls)) expect(restored.players[0].physical).not.toHaveProperty(key);
  expect(restored.players[0].physical.reactionSeconds).toBe(.31); expect(projected.players[0].physical).toMatchObject(controls);
  expect(JSON.stringify(old)).not.toMatch(/fieldArmReachMetersV105/);
});

it('V105 body control limits match validation and reject invalid values atomically', () => {
  for (const key of ['fieldArmReachMetersV105', 'fieldShoulderHeightRatioV105', 'fieldEyeHeightRatioV105',
    'fieldCrouchFractionV105', 'fieldPostureSpeedMpsV105', 'fieldTurnSpeedRadiansPerSecondV105', 'fieldRearReachFractionV105']) {
    const limits = getLiveInternalValueLimitsV82(key)!; expect(limits).not.toBeNull();
    for (const value of [limits.minimum, limits.maximum]) expect(applyLivePhysicalRosterV1(packet({
      physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } })).players[0].physical).toHaveProperty(key, value);
    for (const value of [limits.minimum! - .001, limits.maximum! + .001, NaN, Infinity]) {
      const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } }), before = structuredClone(raw);
      expect(() => applyLivePhysicalRosterV1(raw)).toThrow(); expect(raw).toEqual(before);
    }
  }
});

it('V115 preserves all optional athletic controls through sparse JSON authoring and atomic projection', () => {
  const controls = Object.fromEntries(Object.entries(liveAthleticControlBoundsV115).map(([key, range]) => [key, (range[0] + range[1]) / 2])) as LiveAthleticControlsV115,
    raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', ...controls } }), before = JSON.stringify(raw),
    projected = applyLivePhysicalRosterV1(JSON.parse(before));
  expect(projected.players[0].physical).toMatchObject(controls);
  for (const [key, value] of Object.entries(controls)) expect(projected.audit.players[0].projected).toContainEqual(
    expect.objectContaining({ inputPath: 'physical.' + key, targetPath: key, value }));
  expect(projected.players[0].physical.throwSpeedMps).toBe(LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1.throwSpeedMps);
  expect(JSON.stringify(raw)).toBe(before);
  const old = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1' } });
  for (const key of Object.keys(controls)) expect(applyLivePhysicalRosterV1(old).players[0].physical).not.toHaveProperty(key);
});
it('V115 athletic limits are shared with the motor model and reject invalid edits without partial mutation', () => {
  for (const [key, [minimum, maximum]] of Object.entries(liveAthleticControlBoundsV115)) {
    expect(getLiveInternalValueLimitsV82(key)).toMatchObject({ minimum, maximum, minimumInclusive: true, maximumInclusive: true });
    for (const value of [minimum, maximum]) expect(applyLivePhysicalRosterV1(packet({
      physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } })).players[0].physical).toHaveProperty(key, value);
    for (const value of [minimum - .001, maximum + .001, NaN, Infinity]) {
      const raw = packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', [key]: value } }), before = structuredClone(raw);
      expect(() => applyLivePhysicalRosterV1(raw)).toThrow(); expect(raw).toEqual(before);
    }
  }
});
it('V115 legacy reimport discards stale athletic overrides and derives defaults from the individual without materializing JSON', () => {
  const controls = Object.fromEntries(Object.entries(liveAthleticControlBoundsV115).map(([key, range]) => [key, range[1]])),
    edited = applyLivePhysicalRosterV1(packet({ physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', ...controls } })),
    old = packet({ heightMeters: 1.6, physical: { basis: 'EXPLICIT_AUTHORED_SI_V1', reactionSeconds: .31, accelerationMps2: 3.2, gloveSpeedMps: 7 } }),
    before = JSON.stringify(old), restored = applyLivePhysicalRosterV1({ ...old, players: edited.players }), p = restored.players[0],
    athletic = resolveLiveAthleticProfileV115({ heightMeters: p.heightMeters, accelerationMps2: p.physical.accelerationMps2,
      reactionSeconds: p.physical.reactionSeconds, gloveSpeedMps: p.physical.gloveSpeedMps });
  for (const key of Object.keys(controls)) expect(p.physical).not.toHaveProperty(key);
  expect(athletic.jumpHeightMeters).toBe(1.6 * .18); expect(athletic.slideReachMeters).toBe(1.6 * .48);
  expect(athletic.diveRecoverySeconds).toBe(.55 + .31 * 2 + .2 * 8 / 7);
  expect(JSON.stringify(old)).toBe(before); expect(edited.players[0].physical).toMatchObject(controls);
});
it('V115 maker and AI catalog expose the same ten bounded internal controls with derived defaults', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../../docs/demos/live-game-roster-catalog-v105.json', import.meta.url), 'utf8')) as {
    fields: { path: string; section: string; min: number; max: number; unit?: string; displayScale?: number; defaultFromAthleticV115?: string; note?: string }[] };
  const keys = Object.keys(liveAthleticControlBoundsV115), fields = catalog.fields.filter(f => keys.includes(f.path)),
    profile = resolveLiveAthleticProfileV115({ heightMeters: 1.6, accelerationMps2: 3.2, reactionSeconds: .31, gloveSpeedMps: 7 });
  expect(fields).toHaveLength(10); expect(new Set(fields.map(f => f.path)).size).toBe(10);
  for (const field of fields) {
    const [min, max] = liveAthleticControlBoundsV115[field.path as keyof LiveAthleticControlsV115];
    expect(field).toMatchObject({ section: 'common', min, max });
    expect(field.defaultFromAthleticV115).toBeTruthy(); expect(profile).toHaveProperty(field.defaultFromAthleticV115!);
    expect(field).not.toHaveProperty('default'); expect(field.note).toContain('暫定');
    if (field.path.includes('Meters')) expect(field).toMatchObject({ unit: 'm', displayScale: .01 });
  }
});
