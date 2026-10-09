// Structural adapter tests: original physical/terminal evidence readers are
// explicitly substituted. Match finalization, attendance, outbox and World
// settlement use real Native owners. This does not qualify a physical game.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import { createBaseScheduleSnapshot } from '../../core/world/competition/LeagueSchedule';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { initializeDomesticSeason, prepareDomesticMatch, settlePhysicalDomesticGame, settleSamePaDomesticGame, settleFoulTerminalDomesticGame, reviseDomesticSeasonSchedule } from './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
import { openSqliteOfficialWorldSettlementOutbox } from './SqliteOfficialWorldSettlementOutbox';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import type { DurablePhysicalPlayClosure } from './SqlitePhysicalPlayClosureStore';
import type { SamePaTerminalTransitionRecord } from './SamePlateAppearanceTerminalTransition';
import type { SamePaTerminalRelease } from './SamePlateAppearanceTerminalReleaseArchive';
import { samePaTransitionReference } from './SamePlateAppearanceTerminalTransitionFromSqlite';

import { deriveOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayCompletion';
import { foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import type { FoulTerminalApplicationProposal, DurableFoulTerminalApplication } from './ActualFoulTerminalApplication';
import type { FoulTerminalFinalCompletion } from './ActualFoulTerminalPostPlayCompletion';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'completed-domestic-')), path = join(directory, 'world.sqlite');
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const handles: { close(): void }[] = [];
  const keep = <T extends { close(): void }>(owner: T) => { handles.push(owner); return owner; };
  const close = () => { while (handles.length) handles.pop()!.close(); };
  cleanup.push(close);
  const open = () => {
    const world = keep(openSqliteWorldSettlementStore(path)), archive = keep(openSqliteDomesticScheduleStore(path));
    const match = keep(new SqliteOfficialStateStore(path)), outbox = keep(openSqliteOfficialWorldSettlementOutbox(path));
    const attendance = keep(openSqliteMatchdayAttendanceStore(path, { world, archive, match }, { readAcceptedGateCount: () => gate }));
    return { world, archive, match, outbox, attendance };
  };
  const gate = { factId: 'gate', careerId: 'career-a', gameId: 'series:1', sourceEventId: 'turnstile', stadiumId: 'stadium-a',
    observedAtDay: 11, availableAtDay: 11, venueRevisionAtObservation: 0, count: 120 };
  const stores = open(), db = keep(new DatabaseSync(path));
  const baseSchedule = createBaseScheduleSnapshot({ seasonId: 'league-season-1', leagueId: 'league-a', calendarProfileVersion: 'fixture-v1',
    generatorVersion: 'fixture-v1', scheduleSeed: 'fixture', opponentMatrixVersion: 'fixture-v1', regularSeasonGamesPerClub: 2,
    memberClubIds: ['club-a', 'club-b'], opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b', gameCount: 2 }],
    allowedDays: [11, 12, 13], reservedWindows: [], series: [{ seriesId: 'series', homeClubId: 'club-a', awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }] });
  initializeDomesticSeason(stores, { careerId: 'career-a', baseSchedule,
    eventProfile: { version: 'fixture-v1', allStarEnabled: false, marketWindows: [], rosterExpansionEnabled: false, awardSelectionPolicyVersion: 'fixture-v1' },
    standingsPolicy: { version: 'fixture-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 },
    clubs: [state(), { ...state(), identity: { ...state().identity, clubId: 'club-b' }, live: { ...state().live,
      references: { ...state().live.references, rivalryStateRefs: [{ fromClubId: 'club-b', toClubId: 'club-a', stateRef: 'rivalry-b-a' }] } } }] });
  const before = { ruleProfileId: asRuleProfileId('npb-2026'), inning: 9, half: 'top' as const, outs: 2, balls: 0, strikes: 2,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 1 }, playId: 7 };
  const prepared = prepareDomesticMatch(stores, { careerId: 'career-a', seasonId: 'league-season-1', gameId: 'series:1', matchState: before });
  const timeline = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before, 100), 200, { kind: 'called_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 7, ruleProfileId: before.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'rule', tick: 201, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'close', closureId: 'apply', tick: 202 });
  const finalInput = { kind: 'non_live' as const, matchId: 'series:1', applicationId: 'apply', expectedDurableRevision: 0,
    match: before, timeline, adjudication, context: { kind: 'strikeout' as const }, game: { seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b',
      policy: { version: 'fixture-v1', minimumInnings: 9, tiesAllowed: false }, venueBinding: prepared.fixture.binding,
      lineScore: { innings: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, awayRuns: 0, homeRuns: i === 8 ? null : i === 0 ? 1 : 0 })),
        totals: { away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 1, hits: 1, errors: 0 } } } } };
  const final = stores.match.applyAndFinalize(finalInput);
  stores.attendance.accept('gate', 'league-season-1');
  const physical = { source: { sourceId: 'physical' }, status: 'COMPLETED', proposal: { application: finalInput, expectedOfficial: final,
    worldFixture: { careerId: 'career-a', seasonId: 'league-season-1', game: { gameId: 'series:1', homeClubId: 'club-a', awayClubId: 'club-b' } } },
    result: { sourceId: 'physical', gameId: 'series:1', playId: 7, official: final } } as unknown as DurablePhysicalPlayClosure;
  const reference = <O extends string>(owner: O, sourceId: string) => ({ owner, sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
  const transition = { kind: 'same_pa_terminal_transition_v1', source: { sourceId: 'transition', kind: 'game_final',
    terminalReference: reference('pa_terminal_v1_endpoints', 'endpoint'), settlementReference: reference('pa_settlement_v1_plans', 'settlement') },
    lineage: { careerId: 'career-a', gameId: 'series:1', playId: 7, enrollmentReference: reference('same_pa_enrollments', 'enrollment') },
    completion: 'game_final', officialApplication: finalInput, official: final } as unknown as SamePaTerminalTransitionRecord;
  const release = { kind: 'same_pa_terminal_release_v1', transitionReference: samePaTransitionReference(transition),
    settlementReference: transition.source.settlementReference, terminalReference: transition.source.terminalReference,
    enrollmentReference: transition.lineage.enrollmentReference } as unknown as SamePaTerminalRelease;
  const { game, ...body } = finalInput;
  const { lineScore: _lineScore, ...boundGame } = game;
  // Only the original terminal reader is substituted here. Its equivalent
  // final Match mirror was written above; this is not a genuine terminal DB.
  const foulProposal = { source: { sourceId: 'apply', sourceVersion: 'fixture-v1', applicationId: 'apply' }, gameId: 'series:1', playId: 7,
    originalOfficialRevision: 0, applicationBody: { ...body, mode: 'non_live_pending_post_play_v1', game: boundGame },
    seasonFixture: { careerId: 'career-a', competitionEditionId: 'league-season-1', game: { gameId: 'series:1', homeClubId: 'club-a', awayClubId: 'club-b' } },
  } as unknown as FoulTerminalApplicationProposal;
  const pending = deriveOfficialPendingNonLiveResult(foulTerminalPendingInput(foulProposal), 1);
  const completion = { version: 'actual_foul_terminal_post_play_completion_v2', kind: 'game_final', completionId: 'foul-complete',
    source: { sourceId: 'final-setup' }, sourceHash: 'c'.repeat(64), snapshotHash: 'd'.repeat(64),
    terminalReference: { sourceId: 'apply' }, finalResult: final.result } as unknown as FoulTerminalFinalCompletion;
  const foul = { source: foulProposal.source, proposal: foulProposal, status: 'POST_PLAY_COMPLETED_FINAL', officialApplied: true,
    result: { sourceId: 'apply', official: pending, completion } } as unknown as DurableFoulTerminalApplication;
  const terminalFinal = foulTerminalCompletedOfficial(pending, completion);
  const stateful = { foul: foul as DurableFoulTerminalApplication | null, physical: physical as DurablePhysicalPlayClosure | null, transition: transition as SamePaTerminalTransitionRecord | null,
    release: release as SamePaTerminalRelease | null, rejectOriginal: false };
  const owners = {
    foulTerminal: { read: () => { if (stateful.rejectOriginal) throw new Error('original foul archive changed'); return stateful.foul; } },
    physicalClosure: { read: () => { if (stateful.rejectOriginal) throw new Error('original workload archive changed'); return stateful.physical; } },
    transition: { read: () => { if (stateful.rejectOriginal) throw new Error('original terminal archive changed'); return stateful.transition; } },
    settlement: { readRelease: () => stateful.release },
  };
  const common = { attendanceFactId: 'gate', expectedSeasonRevision: 0, expectedClubRevision: 0,
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'), finalizedAtDay: 11,
    revenuePolicy: { version: 'fixture-v1', availableAtDay: 11, seasonId: 'league-season-1', currency: 'SIM', recognizedMinorUnitsPerAttendee: 5 } };
  const run = (kind: 'physical' | 'same_pa' | 'foul', target = stores, changed = {}) => kind === 'physical'
    ? settlePhysicalDomesticGame({ ...target, ...owners }, { ...common, closureSourceId: 'physical', ...changed })
    : kind === 'same_pa' ? settleSamePaDomesticGame({ ...target, ...owners }, { ...common, transitionSourceId: 'transition', ...changed })
    : settleFoulTerminalDomesticGame({ ...target, ...owners }, { ...common, terminalSourceId: 'apply', ...changed });
  return { path, db, stores, final, terminalFinal, finalInput, common, run, stateful, keep, owners,
    entry: (kind: string, target = stores) => kind === 'foul' ? target.outbox.completedTerminal.read('apply') : target.outbox.read('apply'), reopen: () => { close(); return open(); } };
};

it.each(['physical', 'same_pa', 'foul'] as const)('settles the original %s final exactly once and resumes after reopen', kind => {
  const f = fixture(), saved = f.run(kind);
  expect(saved.final).toEqual(kind === 'foul' ? f.terminalFinal : f.final);
  expect(f.entry(kind)!.request).toMatchObject(kind === 'foul' ? { kind: 'foul_terminal_world_settlement_v1', final: { official: f.terminalFinal } } : { finalInput: f.finalInput });
  expect(saved.world).toMatchObject({ seasonRevision: 1, clubRevision: 1 });
  expect(f.stores.world.readClub('career-a', 'club-a')!.state.live.finance.cash).toBe(1600);
  expect(f.run(kind, f.reopen())).toEqual(saved);
});
it.each(['physical', 'same_pa', 'foul'] as const)('retains frozen %s intake after interrupted World write and resumes only missing effects', kind => {
  const f = fixture();
  f.db.exec("CREATE TRIGGER fail_world BEFORE INSERT ON world_settlement_applications BEGIN SELECT RAISE(ABORT,'interrupted World write'); END;");
  expect(() => f.run(kind)).toThrow('interrupted World write');
  expect(f.entry(kind)!.status).toBe('PENDING');
  expect(f.stores.world.readSeason('career-a', 'league-season-1')!.revision).toBe(0);
  f.db.exec('DROP TRIGGER fail_world');
  expect(f.run(kind, f.reopen()).world.seasonRevision).toBe(1);
});
it.each(['physical', 'same_pa', 'foul'] as const)('revalidates original %s completion even after the outbox completed', kind => {
  const f = fixture(); f.run(kind); f.stateful.rejectOriginal = true;
  expect(() => f.run(kind)).toThrow(/original.*archive/);
});
it.each(['physical', 'same_pa', 'foul'] as const)('rejects changed %s retry economics and a stale initial CAS', kind => {
  const f = fixture();
  expect(() => f.run(kind, f.stores, { expectedClubRevision: 1 })).toThrow('stale');
  expect(f.entry(kind)).toBeNull();
  f.run(kind);
  expect(() => f.run(kind, f.stores, { revenuePolicy: { ...f.common.revenuePolicy, recognizedMinorUnitsPerAttendee: 6 } })).toThrow('frozen');
});
it.each(['physical', 'same_pa', 'foul'] as const)('keeps the historical %s basis after a later schedule and Club change', kind => {
  const f = fixture(), saved = f.run(kind);
  reviseDomesticSeasonSchedule(f.stores, { careerId: 'career-a', seasonId: 'league-season-1', expectedRevision: 0,
    event: { eventId: 'rainout-second', gameId: 'series:2', newDay: 13, reason: 'RAINOUT' }, acceptedAtDay: 12 });
  const club = f.stores.world.readClub('career-a', 'club-a')!.state;
  f.keep(openSqliteClubEconomyStore(f.path)).apply({ applicationId: 'sponsor', expectedClubRevision: club.revision, club,
    history: f.stores.world.readClubHistory('career-a', 'club-a')!, wageSchedules: f.common.wageSchedules,
    sources: [{ kind: 'STRUCTURAL_REVENUE', fact: { factId: 'sponsor-fact', careerId: 'career-a', clubId: 'club-a', season: 1,
      category: 'commercial', settlementRef: 'sponsor-settlement', sourceEventId: 'sponsor-paid', receivedAtDay: 12,
      availableAtDay: 12, capacityRevisionAtReceipt: club.revision, amount: 200, currency: 'SIM' },
      policy: { policyId: 'fixture-structural', version: 'v1', careerId: 'career-a', clubId: 'club-a', season: 1,
        availableAtDay: 12, currency: 'SIM', maximumSeasonAmount: 700, allowedCategories: ['commercial'] } }] });
  const reopened = f.reopen();
  expect(f.run(kind, reopened)).toEqual(saved);
  expect(reopened.world.readClub('career-a', 'club-a')!.state.live.finance.cash).toBe(1800);
});
it.each(['missing', 'pending', 'non_final'] as const)('rejects %s physical closure before World admission', fault => {
  const f = fixture();
  if (fault === 'missing') f.stateful.physical = null;
  else if (fault === 'pending') f.stateful.physical = { ...f.stateful.physical!, status: 'PENDING', result: null };
  else { const { game: _game, ...application } = f.finalInput;
    f.stateful.physical = { ...f.stateful.physical!, proposal: { ...f.stateful.physical!.proposal, application } } as unknown as DurablePhysicalPlayClosure; }
  expect(() => f.run('physical')).toThrow(/physical.*(complete|final)/);
  expect(f.stores.outbox.read('apply')).toBeNull();
});
it.each(['missing', 'non_final', 'unreleased', 'foreign_release'] as const)('rejects %s same-PA terminal before World admission', fault => {
  const f = fixture();
  if (fault === 'missing') f.stateful.transition = null;
  else if (fault === 'non_final') f.stateful.transition = { ...f.stateful.transition!, completion: 'next_play' };
  else if (fault === 'unreleased') f.stateful.release = null;
  else f.stateful.release = { ...f.stateful.release!, transitionReference: { ...f.stateful.release!.transitionReference, snapshotHash: 'f'.repeat(64) } };
  expect(() => f.run('same_pa')).toThrow(/same-PA.*(final|release)/);
  expect(f.stores.outbox.read('apply')).toBeNull();
});

it('retains the pending receipt/hash in typed delivery without normal finalization', () => {
  const f = fixture();
  const original = f.db.prepare('SELECT * FROM applications').all();
  const apply = f.stores.match.applyAndFinalize;
  f.stores.match.applyAndFinalize = () => { throw new Error('normal finalization must not run for completed terminal'); };
  const saved = f.run('foul');
  expect(saved.final).toEqual(f.terminalFinal);
  expect(f.db.prepare('SELECT * FROM applications').all()).toEqual(original);
  expect(f.stores.outbox.listPending()).toEqual([]);
  expect(f.stores.outbox.completedTerminal.listPending()).toEqual([]);
  f.stores.match.applyAndFinalize = apply;
});
it('revalidates completed-terminal evidence when resuming its outbox directly', () => {
  const f = fixture(); f.run('foul'); f.stateful.rejectOriginal = true;
  expect(() => f.stores.outbox.completedTerminal.resume('apply', { matchStore: f.stores.match, worldStore: f.stores.world,
    foulTerminal: f.owners.foulTerminal })).toThrow('original foul archive changed');
});
it.each(['missing', 'pending', 'continuing'] as const)('rejects %s foul completion without freezing World intake', fault => {
  const f = fixture();
  if (fault === 'missing') f.stateful.foul = null;
  else f.stateful.foul = { ...f.stateful.foul!, status: fault === 'pending' ? 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' : 'POST_PLAY_COMPLETED_CONTINUING' } as DurableFoulTerminalApplication;
  expect(() => f.run('foul')).toThrow(/foul.*final/);
  expect(f.entry('foul')).toBeNull();
});

it('retains a typed pending outbox after World committed but its receipt update failed', () => {
  const f = fixture();
  f.db.exec("CREATE TRIGGER fail_receipt BEFORE UPDATE ON world_settlement_outbox BEGIN SELECT RAISE(ABORT,'interrupted receipt'); END;");
  expect(() => f.run('foul')).toThrow('interrupted receipt');
  const original = f.stores.outbox.completedTerminal.read('apply')!;
  expect(original.status).toBe('PENDING');
  expect(f.stores.outbox.listPending()).toEqual([]);
  expect(f.stores.outbox.completedTerminal.listPending()).toEqual([original]);
  expect(f.stores.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
  f.db.exec('DROP TRIGGER fail_receipt');
  const reopened = f.reopen(), result = f.run('foul', reopened);
  expect(result.world.seasonRevision).toBe(1);
  expect(f.entry('foul', reopened)!.request).toEqual(original.request);
  expect(reopened.outbox.completedTerminal.listPending()).toEqual([]);
});
it('does not recreate a deleted World application behind a completed terminal outbox', () => {
  const f = fixture(); f.run('foul');
  f.db.exec('DELETE FROM world_settlement_applications');
  expect(() => f.run('foul')).toThrow(/World|world/);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_settlement_applications').get()!.n).toBe(0);
});
it.each(['physical', 'foul'] as const)('shares one application-id namespace when %s admitted first', kind => {
  const f = fixture(); f.run(kind);
  expect(() => f.run(kind === 'physical' ? 'foul' : 'physical')).toThrow(/outbox/);
  expect(f.db.prepare('SELECT count(*) AS n FROM world_settlement_outbox').get()!.n).toBe(1);
  expect(f.stores.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
});
it('rejects a changed terminal pending hash even when the final scoreboard is unchanged', () => {
  const f = fixture(); f.run('foul');
  const saved = f.stateful.foul!;
  if (saved.status !== 'POST_PLAY_COMPLETED_FINAL') throw new Error('fixture final missing');
  f.stateful.foul = { ...saved, result: { ...saved.result, official: { ...saved.result.official,
    pendingPostPlay: { ...saved.result.official.pendingPostPlay, requestHash: 'e'.repeat(64) } } } };
  expect(() => f.run('foul')).toThrow('original pending receipt differs');
  expect(f.stores.world.readSeason('career-a', 'league-season-1')!.revision).toBe(1);
});
