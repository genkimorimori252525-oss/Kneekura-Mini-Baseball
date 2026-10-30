import { authoredClockFixture as fixture } from './AuthoredMatchClockV1.test-support';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { compileAuthoredMatchClockV1 } from './AuthoredMatchClockV1';
import { resolveDefensiveDecisionTiming } from '../../core/sim/fielding/DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming } from '../../core/sim/fielding/DefenderFirstStepTiming';
import { createPlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { createPlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { samePaFieldThrowValuesInput } from '../../host/world/SamePlateAppearanceLifecycleCalibrationSource';
import { dispatchCalibrationValues } from '../../host/world/SamePlateAppearanceDispatchCalibration.test-support';
import { state as clubState } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from '../../host/world/SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from '../../host/world/SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore, type AcceptedPlayerIntakeSource } from '../../host/world/SqlitePlayerPersonLinkStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from '../../host/world/SqlitePlayerFieldingModelStore';
import { openSqlitePlayerObservationModelStore } from '../../host/world/SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore } from '../../host/world/SqlitePlayerDecisionModelStore';
import { openSqlitePlayerLocomotionModelStore } from '../../host/world/SqlitePlayerLocomotionModelStore';

const schedule = (value: ReturnType<typeof compileAuthoredMatchClockV1>) => {
  const c = value.plannedDefenders[0].effectiveValues.defender_decision;
  const decision = resolveDefensiveDecisionTiming(100, 0.5, c.decisionTimingParameters);
  return { decision, firstStep: resolveDefenderFirstStepTiming(decision.decisionTick, 0.5, c.firstStepTimingParameters) };
};

it('AC01 compiles explicit SI times into existing model declarations and effective values without Native authority', () => {
  const raw = fixture(), value = compileAuthoredMatchClockV1(raw), first = value.plannedDefenders[0];
  expect(value.nativeReady).toBe(false);
  expect(value.boundary).toBe('AUTHORING_DECLARATIONS_NOT_NATIVE_SOURCE_ACCEPTANCE');
  expect(value.unconnectedTemporalDomains).toEqual(['batting', 'pitch', 'communication', 'runner', 'scene_and_role_coverage', 'native_genesis']);
  expect(value.plannedDefenders.map(p => p.playerId)).toEqual(raw.defenders.map(p => p.playerId));
  expect(first.plannedModelSources.observation.sourceVersion).toBe('authored_si_clock_1000000_v1');
  expect(first.plannedModelSources.locomotion.capability).toBe('defender_locomotion_v1');
  expect(first.plannedModelSources.decision.careerId).toBe(raw.careerId);
  expect(first.plannedModelSources.observation.fieldingModelSourceId).toBe(raw.defenders[0].fieldingModelSourceId);
  expect(first.effectiveValues.defender_observation.refreshPolicy).toEqual({ attendedIntervalTicks: 20_000, peripheralIntervalTicks: 80_000 });
  expect(first.effectiveValues.defender_observation.memoryDecayParameters.ticksPerSecond).toBe(1_000_000);
  expect(first.effectiveValues.defender_locomotion.maxIntegrationStepTicks).toBe(2000);
  expect(first.effectiveValues.defender_throw.transferParameters).toEqual({ minimumTransferDelayTicks: 80_000, maximumTransferDelayTicks: 220_000, fixedGripOffsetTicks: 10_000 });
  for (const p of value.plannedDefenders) {
    expect(createPlayerObservationCalibration(p.effectiveValues.defender_observation)).toEqual(p.plannedModelSources.observation.calibration);
    expect(createPlayerDecisionCalibration(p.effectiveValues.defender_decision)).toEqual(p.plannedModelSources.decision.calibration);
    expect(createPlayerLocomotionCalibration(p.effectiveValues.defender_locomotion)).toEqual(p.plannedModelSources.locomotion.calibration);
    expect(() => samePaFieldThrowValuesInput(p.effectiveValues.defender_throw)).not.toThrow();
    for (const s of Object.values(p.plannedModelSources)) {
      expect(s.sourceId.startsWith(raw.namespace + ':r1:')).toBe(true);
      expect(Object.keys(s)).not.toContain('snapshotHash');
      expect(Object.keys(s)).not.toContain('accepted');
    }
  }
  expect(value.conversionLedger).toHaveLength(9 * 13);
  expect(schedule(value).firstStep.movementStartTick - 100).toBe(275_000);
});

it('AC02 separates the numerical/control segment cap from decision and body initiation latency', () => {
  const raw = fixture(), a = compileAuthoredMatchClockV1(raw);
  raw.defenders.forEach(p => { p.locomotion.maximumControlStepSeconds = '0.004'; });
  const b = compileAuthoredMatchClockV1(raw);
  expect(schedule(b)).toEqual(schedule(a));
  expect(b.plannedDefenders[0].effectiveValues.defender_locomotion.maxIntegrationStepTicks).toBe(4000);
  raw.defenders[0].decision.firstStepSeconds.fixedMotorOffset = '0.006';
  expect(schedule(compileAuthoredMatchClockV1(raw)).firstStep.movementStartTick).toBe(schedule(b).firstStep.movementStartTick + 1000);
});

it('AC03 owns detached frozen data and preserves an independently pinned legacy dispatch packet byte-for-byte', () => {
  const legacy = JSON.stringify(dispatchCalibrationValues()), raw = fixture(), result = compileAuthoredMatchClockV1(raw);
  expect(createHash('sha256').update(legacy).digest('hex')).toBe('3d039e1b105a1ffe669423b1c6f1b3f74ff57c28f6ccb1bc4464fbd754d1b01f');
  raw.defenders[0].observation.refreshSeconds.attended = '9.000';
  expect(result.manifest.defenders[0].observation.refreshSeconds.attended).toBe('0.020');
  expect(Object.isFrozen(result.plannedDefenders[0].plannedModelSources.observation.calibration)).toBe(true);
  expect(Object.isFrozen(result.manifest.defenders[0].decision.decisionSeconds)).toBe(true);
  expect(Object.isFrozen(result.conversionLedger[0])).toBe(true);
  expect(JSON.stringify(dispatchCalibrationValues())).toBe(legacy);
});

it.each(['0.0000001', '1e-3', '-0.001', 'NaN', 'Infinity', '', ' 0.020', '01.0', '9007199254.740992', '1'.repeat(1000)])('AC04 rejects invalid/nonrepresentable/unsafe seconds %s', seconds => {
  const raw = fixture(); raw.defenders[0].locomotion.maximumControlStepSeconds = seconds;
  expect(() => compileAuthoredMatchClockV1(raw)).toThrow();
});

it('AC05 accepts exact microsecond values and rejects missing, extra, numeric or zero positive intervals', () => {
  const raw = fixture(); raw.defenders[0].observation.refreshSeconds.attended = '0.000001000000000000';
  expect(compileAuthoredMatchClockV1(raw).plannedDefenders[0].effectiveValues.defender_observation.refreshPolicy.attendedIntervalTicks).toBe(1);
  for (const mutation of [
    (p: any) => { delete p.defenders[0].decision.firstStepSeconds; },
    (p: any) => { p.defenders[0].decision.firstStepSeconds.minimum = 0.03; },
    (p: any) => { p.defenders[0].locomotion.maximumControlStepSeconds = '0'; },
    (p: any) => { p.clock.ticksPerSecond = 1000; },
    (p: any) => { p.defenders[0].observation.memoryDecayParameters.ticksPerSecond = 1000; },
    (p: any) => { p.defenders[0].decision.decisionSeconds.minimum = '0.500'; },
    (p: any) => { p.defenders[0].locomotion.topSpeedMps = NaN; },
    (p: any) => { p.extra = 1; },
    (p: any) => { p.defenders[0].transferSeconds.extra = '0'; },
  ]) { const x = fixture(); mutation(x); expect(() => compileAuthoredMatchClockV1(x)).toThrow(); }
});

it('AC06 rejects namespace/identity collisions and does not silently fill missing defenders', () => {
  for (const mutation of [
    (p: ReturnType<typeof fixture>) => { p.defenders[0].playerId = 'old-player'; },
    (p: ReturnType<typeof fixture>) => { p.defenders[1].playerId = p.defenders[0].playerId; },
    (p: ReturnType<typeof fixture>) => { p.defenders[1].fieldingModelSourceId = p.defenders[0].fieldingModelSourceId; },
    (p: ReturnType<typeof fixture>) => { p.defenders[1].personLinkSourceId = p.defenders[0].personLinkSourceId; },
    (p: ReturnType<typeof fixture>) => { p.defenders.pop(); },
  ]) { const x = fixture(); mutation(x); expect(() => compileAuthoredMatchClockV1(x)).toThrow(); }
});

it('AC07 rejects accessors and cycles without invoking getters', () => {
  let called = false;
  const accessor = fixture(); Object.defineProperty(accessor.defenders[0].decision.decisionSeconds, 'minimum', { enumerable: true, get() { called = true; return '0.120'; } });
  expect(() => compileAuthoredMatchClockV1(accessor)).toThrow(); expect(called).toBe(false);
  const cyclic: any = fixture(); cyclic.defenders[0].loop = cyclic;
  expect(() => compileAuthoredMatchClockV1(cyclic)).toThrow();
});

it('AC08 rejects cross-role/generated source aliases and aggregate timing overflow', () => {
  const crossRole = fixture(); crossRole.defenders[0].personLinkSourceId = crossRole.defenders[1].fieldingModelSourceId;
  expect(() => compileAuthoredMatchClockV1(crossRole)).toThrow();
  const generated = fixture(); generated.defenders[0].fieldingModelSourceId = generated.namespace + ':r1:observation:' + generated.defenders[1].playerId;
  expect(() => compileAuthoredMatchClockV1(generated)).toThrow();
  const overflow = fixture();
  overflow.defenders[0].decision.decisionSeconds.maximum = '9007199254.740991';
  expect(() => compileAuthoredMatchClockV1(overflow)).toThrow();
  const maximum = fixture(); maximum.defenders[0].locomotion.maximumControlStepSeconds = '9007199254.740991';
  expect(compileAuthoredMatchClockV1(maximum).plannedDefenders[0].effectiveValues.defender_locomotion.maxIntegrationStepTicks).toBe(Number.MAX_SAFE_INTEGER);
});

it('AC09 registers all nine declared nominal models through their real Native owners and rereads without author callbacks', () => {
  const raw = fixture(), compiled = compileAuthoredMatchClockV1(raw), path = join(mkdtempSync(join(tmpdir(), 'kneekura-authored-clock-')), 'state.sqlite');
  const stores: { close(): void }[] = [], track = <T extends { close(): void }>(s: T): T => { stores.push(s); return s; };
  const sources = new Map<string, unknown>();
  const readings: unknown[] = [];
  try {
    const world = track(openSqliteWorldSettlementStore(path)), roster = track(openSqliteManagerRosterDecisionStore(path));
    world.initialize({ careerId: raw.careerId, clubs: [{ ...clubState(), careerId: raw.careerId }],
      schedule: { seasonId: 'league-season-1', leagueId: 'league-a', memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
        games: [{ gameId: 'authored-game', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
      standingsPolicy: { version: 'authored-standings', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
    roster.initialize({ careerId: raw.careerId, clubId: 'club-a', mood: null,
      roster: createRosterState({ careerId: raw.careerId, effectiveDay: 0,
        profiles: [{ profileId: 'authored-league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
          allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }], units: [{ unitId: 'authored-first', clubId: 'club-a', kind: 'FIRST_TEAM' }],
        players: raw.defenders.map(d => ({ playerId: d.playerId, clubRights: { rightsHolderClubId: 'club-a', contractId: 'contract:' + d.playerId },
          assignment: { unitId: 'authored-first', clubId: 'club-a' }, registrations: [], availability: { status: 'AVAILABLE', evidenceId: 'health:' + d.playerId } })) }) });
    const links = track(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: id => sources.get(id) as AcceptedPlayerIntakeSource | null }));
    const fielding = track(openSqlitePlayerFieldingModelStore(path, { readAcceptedModel: id => sources.get(id) as AcceptedPlayerFieldingModel | null }));
    const observation = track(openSqlitePlayerObservationModelStore(path, { readAcceptedModel: id => sources.get(id) as never }));
    const decision = track(openSqlitePlayerDecisionModelStore(path, { readAcceptedModel: id => sources.get(id) as never }));
    const locomotion = track(openSqlitePlayerLocomotionModelStore(path, { readAcceptedModel: id => sources.get(id) as never }));
    for (const [index, p] of compiled.plannedDefenders.entries()) {
      const authored = raw.defenders[index];
      const intake: AcceptedPlayerIntakeSource = { sourceId: authored.personLinkSourceId, careerId: raw.careerId, playerId: p.playerId,
        personId: raw.namespace + ':person:' + index, sourceRecordId: raw.namespace + ':intake:' + index,
        sourceVersion: 'explicit-authored-clock-native-test-v1', acceptedRevision: 1, acceptedAtDay: 0, rosterRevision: 0 };
      sources.set(intake.sourceId, intake); links.accept(intake.sourceId);
      const fieldSource: AcceptedPlayerFieldingModel = { sourceId: authored.fieldingModelSourceId, sourceVersion: 'authored_si_clock_1000000_v1',
        careerId: raw.careerId, playerId: p.playerId, personLinkSourceId: authored.personLinkSourceId, acceptedAtDay: 0,
        ratings: { positionSuitability: { P: .5, C: .5, '1B': .5, '2B': .5, '3B': .5, SS: .5, LF: .5, CF: .5, RF: .5 },
          firstStep: .5, acceleration: .5, battedBallRead: .5, routeEfficiency: .5, catching: .5, transfer: .5, armStrength: .5,
          throwingAccuracy: .5, situationalAwareness: .5, tagSkill: .5 }, ...p.effectiveValues.defender_throw };
      sources.set(fieldSource.sourceId, fieldSource); fielding.accept(fieldSource.sourceId);
      for (const s of Object.values(p.plannedModelSources)) sources.set(s.sourceId, s);
      readings.push([observation.accept(p.plannedModelSources.observation.sourceId), decision.accept(p.plannedModelSources.decision.sourceId),
        locomotion.accept(p.plannedModelSources.locomotion.sourceId)]);
    }
  } finally { stores.reverse().forEach(s => s.close()); }
  const forbidden = () => { throw new Error('cold model reader must use original saved rows'); };
  const observation = openSqlitePlayerObservationModelStore(path, { readAcceptedModel: forbidden });
  const decision = openSqlitePlayerDecisionModelStore(path, { readAcceptedModel: forbidden });
  const locomotion = openSqlitePlayerLocomotionModelStore(path, { readAcceptedModel: forbidden });
  try {
    for (const [index, p] of compiled.plannedDefenders.entries()) {
      expect([observation.read(p.plannedModelSources.observation.sourceId), decision.read(p.plannedModelSources.decision.sourceId),
        locomotion.read(p.plannedModelSources.locomotion.sourceId)]).toEqual(readings[index]);
    }
  } finally { observation.close(); decision.close(); locomotion.close(); }
  const evidencePath = process.env.BASEBALL_AUTHORED_CLOCK_EVIDENCE;
  if (evidencePath) {
    // Immutable evidence is optional; normal tests do not write deliverables.
    // Every owner handle above has closed. Never copy an active SQLite/WAL.
    mkdirSync(evidencePath, { recursive: false });
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(path, { readOnly: true }), databasePath = join(evidencePath, 'models.sqlite');
    try { db.prepare('VACUUM INTO ?').run(databasePath); } finally { db.close(); }
    const cold = new DatabaseSync(databasePath, { readOnly: true });
    const counts: Record<string, number> = {};
    try {
      expect(cold.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
      for (const name of ['fielding', 'observation', 'decision', 'locomotion']) {
        counts[name] = Number(cold.prepare('SELECT COUNT(*) AS count FROM world_player_' + name + '_models').get()!.count);
        expect(counts[name]).toBe(9);
      }
    } finally { cold.close(); }
    const sourceMapPath = join(evidencePath, 'accepted-sources.json');
    writeFileSync(sourceMapPath, JSON.stringify([...sources], null, 2), { flag: 'wx' });
    writeFileSync(join(evidencePath, 'authoring.json'), JSON.stringify(compiled, null, 2), { flag: 'wx' });
    const sha = (file: string | URL) => createHash('sha256').update(readFileSync(file)).digest('hex');
    writeFileSync(join(evidencePath, 'manifest.json'), JSON.stringify({ status: 'PASS_NATIVE_NOMINAL_MODEL_REGISTRATION_AND_REOPEN',
      databasePath, sourceMapPath, databaseHash: sha(databasePath), sourceMapHash: sha(sourceMapPath),
      sourceHash: sha(new URL('./AuthoredMatchClockV1.ts', import.meta.url)), counts,
      plannedDefenders: compiled.plannedDefenders.map(p => ({ playerId: p.playerId, modelIds: Object.values(p.plannedModelSources).map(s => s.sourceId) })),
      clockTicksPerSecond: 1_000_000, authoring: 'AUTHORED_SYNTHETIC_NOT_EMPIRICAL', ownerMocks: false,
      coldReopen: 'NEW_CONNECTIONS_SAME_PROCESS_WITHOUT_AUTHOR_CALLBACKS', nativeBodyExecution: false, nativeMatchReady: false, official: null }, null, 2), { flag: 'wx' });
  }
});
