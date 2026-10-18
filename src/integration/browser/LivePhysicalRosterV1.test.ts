import { expect, it } from 'vitest';
import { defaultWorkbenchPlayer } from './WorkbenchPlayer';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import { applyLivePhysicalRosterV1 } from './LivePhysicalRosterV1';
import { setLiveTraitProfileV1, type LiveTraitRosterInputV1 } from './LiveTraitProfilesV1';

const players = [{ playerId: 'batter-a', name: 'Authored player', heightMeters: 1.8, bats: 'R' as const }];
const packet = (entry: Record<string, unknown>) => ({ players, roster: { version: 'live_physical_roster_v1', sourceId: 'test-roster',
  entries: [{ playerId: 'batter-a', sourceId: 'test-authoring', ...entry }] } });

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

it('passes ON/OFF controls from imported trait profiles to actual Host pitches without altering a taken ball', () => {
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
  type Diagnostics = { individualControls: { badBallControl: number }; swingOffered: boolean; zoneJudgment: unknown };
  const ad = a.play.diagnostics as Diagnostics, bd = b.play.diagnostics as Diagnostics;
  expect(ad.individualControls.badBallControl).toBe(.83);
  expect(bd.individualControls.badBallControl).toBe(0);
  expect(a.frames).toEqual(b.frames);
  expect(ad.swingOffered).toBe(false);
  expect(bd.zoneJudgment).toEqual(ad.zoneJudgment);
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
