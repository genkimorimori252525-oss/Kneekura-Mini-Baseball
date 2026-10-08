import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import * as OfficialState from '../SqliteOfficialStateStore';
import type { PersistOfficialPlayInput, PersistOfficialFinalInput } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore, type AcceptedScoredOfficialPlay,
  type PersistOfficialScoringInput, type PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import type { PersistOfficialPendingNonLiveInput } from '../OfficialPendingPostPlay';
import { officialStateHash as hash, officialStateSerialized as json } from '../OfficialStateEncoding';
import * as OfficialScoring from '../../core/adjudication/OfficialScoring';
import * as NonLiveApplication from '../../core/adjudication/NonLiveOfficialApplication';
import * as AdjudicationLedger from '../../core/adjudication/PlayAdjudicationLedger';
import * as PhysicalWorkload from '../../core/world/development/OfficialPhysicalPitchWorkload';
import { openSqliteOfficialPitchWorkloadStore, type OfficialPitchWorkloadRequest } from './SqliteOfficialPitchWorkloadStore';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { derivePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { terminalFixtureCompatibility, terminalFixtureManifest } from './ActualFoulTerminalApplicationFixtures.test-support';

/** Synthetic negative boundary fixtures only. These are neither a genuinely
 * acknowledged terminal nor Native provenance, scoring, or readiness evidence.
 * No terminal producer, application runner, or acknowledgement writer is used.
 * The pure compatibility helper supplies the existing pinned baseball inputs.
 * The raw receipt-only archive deliberately has no terminal owner/marker, so
 * the actor test reaches the legacy fallback without disabling its raw guards.
 */
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [], resources: { close(): void }[] = [];
const track = <T extends { close(): void }>(resource: T): T => { resources.push(resource); return resource; };
afterEach(() => {
  vi.restoreAllMocks();
  while (resources.length) resources.pop()!.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

const gameVariants = ['absent', 'null', 'bound'] as const;
type GameVariant = typeof gameVariants[number];
type PendingCandidate = Omit<PersistOfficialPendingNonLiveInput, 'game'>
  & Partial<Pick<PersistOfficialPendingNonLiveInput, 'game'>>;

const syntheticFixture = (variant: GameVariant, seedScoring: boolean) => {
  const pure = terminalFixtureCompatibility(), m = terminalFixtureManifest;
  const request: PendingCandidate = {
    mode: 'non_live_pending_post_play_v1', kind: 'non_live', matchId: m.gameId,
    applicationId: 'synthetic-consumer-fence-application', expectedDurableRevision: m.durableRevision,
    match: pure.original, timeline: pure.timeline, adjudication: pure.ledger, context: { kind: 'strikeout' },
    origin: { owner: 'actual_foul_terminal_applications', sourceId: 'compat-close', sourceVersion: 'synthetic-negative-v1',
      sourceHash: hash({ synthetic: 'consumer-fence-source' }), snapshotHash: hash({ synthetic: 'consumer-fence-snapshot' }) },
    ...(variant === 'absent' ? {} : { game: variant === 'null' ? null : {
      seasonId: m.seasonId, homeClubId: m.homeClubId, awayClubId: m.awayClubId,
      policy: m.legalGamePolicy, venueBinding: m.fixture,
    } }),
  };
  const classification = OfficialScoring.classifyClosedPlayForOfficialScoring({ kind: 'non_live',
    match: request.match, timeline: request.timeline, adjudication: request.adjudication, context: request.context });
  if (classification.kind !== 'supported') throw new Error('synthetic compatibility scoring prerequisite differs');
  const scoring: PersistedOfficialScoring = {
    scoringApplicationId: JSON.stringify(['actual_foul_terminal_scoring_v1', request.origin.sourceId]),
    matchId: request.matchId, officialApplicationId: request.applicationId,
    closureId: request.origin.sourceId, sourceEventId: 'official-non-live:' + request.applicationId,
    record: classification.record,
  };
  const directory = mkdtempSync(join(tmpdir(), 'terminal-consumer-fence-')); directories.push(directory);
  const path = join(directory, 'synthetic.sqlite'), db = track(new DatabaseSync(path));
  db.exec(`CREATE TABLE matches (
    match_id TEXT PRIMARY KEY, durable_revision INTEGER NOT NULL, state_json TEXT NOT NULL, activation_json TEXT
  );
  CREATE TABLE applications (
    application_id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(match_id), closure_id TEXT NOT NULL,
    request_hash TEXT NOT NULL, result_json TEXT NOT NULL, UNIQUE(match_id, closure_id)
  );`);
  db.prepare('INSERT INTO matches VALUES (?, ?, ?, NULL)').run(request.matchId, 1, json(pure.next));
  const receipt = { ...pure.expectedReceipt, applicationId: request.applicationId };
  db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)').run(
    request.applicationId, request.matchId, scoring.closureId, hash(request), json({ receipt }));
  // Use the public legacy opener to install its own unchanged scoring schema.
  const installer = openSqliteOfficialScoringStore(path); installer.close();
  const input = { scoringApplicationId: scoring.scoringApplicationId, officialApplication: request };
  if (seedScoring) db.prepare(`INSERT INTO official_scoring_applications
    (scoring_application_id, match_id, official_application_id, closure_id, source_event_id, request_json, result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(scoring.scoringApplicationId, scoring.matchId, scoring.officialApplicationId,
    scoring.closureId, scoring.sourceEventId, json({ input, evidence: null }), json(scoring));
  expect('game' in request).toBe(variant !== 'absent');
  expect(request.mode).toBe('non_live_pending_post_play_v1');
  return { path, db, request, scoring, input };
};

const originalRows = (db: Database) => ({
  matches: db.prepare('SELECT rowid, * FROM matches ORDER BY rowid').all(),
  applications: db.prepare('SELECT rowid, * FROM applications ORDER BY rowid').all(),
  scoring: db.prepare('SELECT rowid, * FROM official_scoring_applications ORDER BY rowid').all(),
  schema: db.prepare('SELECT type, name, tbl_name, rootpage, sql FROM sqlite_master ORDER BY type, name').all(),
});

/** Generic malformed-input, missing-row, and spy-sentinel failures cannot pass.
 * The deliberate terminal-mode rejection must remain the public error, including
 * legacy scoring reads that otherwise wrap their decoder's errors as corruption.
 */
const expectTerminalModeRejection = (operation: () => unknown): void => {
  let failure: unknown;
  try { operation(); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error)) throw new Error('expected an explicit terminal mode Error');
  expect(failure.message).toMatch(/terminal pending/);
  expect(failure.message).not.toMatch(/SYNTHETIC_FORBIDDEN|corrupt durable official scoring application/);
};

const forbidLegacyDerivation = () => [
  vi.spyOn(OfficialState, 'deriveOfficialPlayResult').mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_IMMEDIATE_ACTIVATION'); }),
  vi.spyOn(OfficialState, 'deriveOfficialFinalResult').mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_GAME_FINAL'); }),
  vi.spyOn(OfficialScoring, 'classifyClosedPlayForOfficialScoring').mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_CLASSIFICATION'); }),
  vi.spyOn(NonLiveApplication, 'deriveClosedNonLiveMatchState').mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_NON_LIVE_DERIVATION'); }),
  vi.spyOn(AdjudicationLedger, 'getOfficialPlayClosure').mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_CLOSURE_DERIVATION'); }),
];

it('C00 preserves the complete legacy scoring and accepted-play public unions', () => {
  type LegacyOfficialInput = PersistOfficialPlayInput | PersistOfficialFinalInput;
  type LegacyScoringInput = Readonly<{ scoringApplicationId: string;
    officialApplication: Extract<LegacyOfficialInput, { kind: 'live_ball' }>; sourceEventId?: string }>
    | Readonly<{ scoringApplicationId: string; officialApplication: Extract<LegacyOfficialInput, { kind: 'non_live' }> }>;
  expectTypeOf<PersistOfficialScoringInput>().toEqualTypeOf<LegacyScoringInput>();
  expectTypeOf<AcceptedScoredOfficialPlay>().toEqualTypeOf<Readonly<{
    scoring: PersistedOfficialScoring; application: LegacyOfficialInput;
  }>>();
});

it.each(gameVariants)('C01 legacy scoring apply explicitly rejects terminal mode with game=%s before evidence/derivation', variant => {
  const f = syntheticFixture(variant, false), forbidden = forbidLegacyDerivation();
  const evidenceGuard = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_LEGACY_EVIDENCE'); });
  const authority = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_SCORER_AUTHORITY'); });
  const legacy = track(openSqliteOfficialScoringStore(f.path, { readAcceptedOfficialScoringEvidence: authority }, evidenceGuard));
  const before = originalRows(f.db);
  // Deliberately violate the API boundary only at this negative-test call.
  expectTerminalModeRejection(() => legacy.apply(f.input as unknown as PersistOfficialScoringInput));
  expect(evidenceGuard).not.toHaveBeenCalled(); expect(authority).not.toHaveBeenCalled();
  for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
  expect(originalRows(f.db)).toEqual(before);
  expect(legacy.readApplication(f.scoring.scoringApplicationId)).toBeNull();
});

for (const method of ['readApplication', 'readAcceptedPlay'] as const) {
  it.each(gameVariants)(`C02 ${method} explicitly rejects a raw terminal-mode row with game=%s before legacy replay`, variant => {
    const f = syntheticFixture(variant, true), forbidden = forbidLegacyDerivation();
    const evidenceGuard = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_LEGACY_EVIDENCE'); });
    const legacy = track(openSqliteOfficialScoringStore(f.path, undefined, evidenceGuard)), before = originalRows(f.db);
    expectTerminalModeRejection(() => legacy[method](f.scoring.scoringApplicationId));
    expect(evidenceGuard).not.toHaveBeenCalled();
    for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
    expect(originalRows(f.db)).toEqual(before);
  });
}

for (const origin of ['activation', 'initial'] as const) {
  it.each(gameVariants)(`C03 ${origin} pitch-workload intake rejects terminal mode with game=%s before participation or physical assessment`, variant => {
    const f = syntheticFixture(variant, true);
    // The source seam intentionally supplies an out-of-union pending value to
    // exercise this consumer's own fence, independently of the legacy reader.
    const readAcceptedPlay = vi.fn(() => ({ scoring: f.scoring, application: f.request }) as unknown as AcceptedScoredOfficialPlay);
    const readPitcherPlay = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_PARTICIPATION'); });
    const readAcceptedSource = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_INITIAL_WORLD'); });
    const readInitialPitcherPlay = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_INITIAL_PITCHER'); });
    const readProgress = vi.fn(() => { throw new Error('SYNTHETIC_FORBIDDEN_PHYSICAL_PROGRESS'); });
    const assess = vi.spyOn(PhysicalWorkload, 'assessOfficialPhysicalPitchWorkload')
      .mockImplementation(() => { throw new Error('SYNTHETIC_FORBIDDEN_WORKLOAD_ASSESSMENT'); });
    // The existing API reads/detaches accepted calibration before project().
    // Reuse the pinned fixture policy; no new calibration or terminal charge.
    const policy = { ...terminalFixtureManifest.effortPolicy, sourceId: 'synthetic-consumer-fence-policy', sourceVersion: 'synthetic-negative-v1' };
    const readAcceptedPolicy = vi.fn(() => policy);
    const workload = track(openSqliteOfficialPitchWorkloadStore(f.path, {
      scoring: { readAcceptedPlay }, participation: { readPitcherPlay },
      initialWorlds: { readAcceptedSource, readInitialPitcherPlay }, physicalPitches: { readProgress },
    }, { readAcceptedPolicy }));
    const request: OfficialPitchWorkloadRequest = {
      scoringApplicationId: f.scoring.scoringApplicationId, policySourceId: policy.sourceId,
      ...(origin === 'activation' ? { activationApplicationId: 'synthetic-prior-activation' }
        : { initialWorldSourceId: terminalFixtureManifest.initialWorldSourceId }),
    };
    const before = originalRows(f.db);
    expectTerminalModeRejection(() => workload.accept(request));
    expect(readAcceptedPlay).toHaveBeenCalledTimes(1);
    expect(readAcceptedPlay).toHaveBeenCalledWith(f.scoring.scoringApplicationId);
    expect(readAcceptedPolicy).toHaveBeenCalledTimes(1);
    for (const spy of [readPitcherPlay, readAcceptedSource, readInitialPitcherPlay, readProgress, assess]) {
      expect(spy).not.toHaveBeenCalled();
    }
    expect(f.db.prepare('SELECT * FROM official_pitch_workload_policies').all()).toEqual([]);
    expect(f.db.prepare('SELECT * FROM official_pitch_workload_sources').all()).toEqual([]);
    expect(originalRows(f.db)).toEqual(before);
  });
}

it.each(gameVariants)('C04 scoring history rejects terminal mode with game=%s before final/play discrimination', variant => {
  const f = syntheticFixture(variant, true), forbidden = forbidLegacyDerivation(), before = originalRows(f.db);
  expectTerminalModeRejection(() => readPhysicalClosureScoringHistory(f.db, { gameId: f.request.matchId, officialRevision: 1 }));
  for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
  expect(originalRows(f.db)).toEqual(before);
});

it.each(gameVariants)('C05 actor fallback rejects terminal mode with game=%s before immediate activation', variant => {
  const f = syntheticFixture(variant, true), before = originalRows(f.db);
  // Prove the unchanged raw ownership guards permit reaching the specific
  // legacy fallback in this deliberately incomplete negative archive.
  expect(readActualLivePhysicalActivation(f.db, f.request.matchId, f.request.applicationId)).toBeNull();
  expect(originalRows(f.db)).toEqual(before);
  const forbidden = forbidLegacyDerivation();
  expectTerminalModeRejection(() => derivePhysicalPlateAppearanceActor(f.db, {
    sourceId: 'synthetic-consumer-fence-actor', sourceVersion: 'synthetic-negative-v1', gameId: f.request.matchId,
    playerId: terminalFixtureManifest.batter.playerId, activationApplicationId: f.request.applicationId,
  }));
  for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
  expect(originalRows(f.db)).toEqual(before);
});
