// Compatibility contract only: use the existing scoring fixture's substituted
// physical inputs. Closure, Match, ten-role readiness and both scoring owners are
// real Native owners. Genuine physical setup routing is tested separately.
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { actualScoringFixture } from './ActualLiveScoringContract.test-support';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
import type { DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
const fixtureInput = vi.hoisted(() => (db: Pick<DatabaseSync, 'prepare'>, kind: string): any => {
  const row = db.prepare('SELECT value_json FROM fixture_scoring_inputs WHERE kind=?').get(kind);
  return row ? JSON.parse(String(row.value_json)) : null;
});
vi.mock('./ActualLiveAdjudicationFromSqlite', () => ({ actualLiveAdjudicationEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => id === 'adjudication' ? fixtureInput(db, 'adjudication') : null,
  readWithClosureInputs: (id: string) => id !== 'adjudication' ? null : ({ value: fixtureInput(db, 'adjudication'),
    end: fixtureInput(db, 'end'), prefix: { baseField: fixtureInput(db, 'baseField'), fields: [], executions: [{ source: { sourceId: 'execution' } }] } }),
}) }));
vi.mock('./SqliteActualFirstBasePlayEndStore', () => ({ actualFirstBaseClosedEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => id === 'end' ? fixtureInput(db, 'end') : null,
}) }));
vi.mock('./SqliteBattedWorldFieldStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldStore')>(),
  battedWorldFieldEvidenceFromSqlite: (db: DatabaseSync) => ({ read: () => fixtureInput(db, 'baseField'), scope: () => [] }),
}));
vi.mock('./SqliteBattedWorldFieldExecutionStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldExecutionStore')>(),
  battedWorldFieldExecutionEvidenceFromSqlite: () => ({ scope: () => [{ source: { sourceId: 'execution' } }] }),
}));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: (_ids: unknown, prefix: any) => prefix.baseField.fixturePlayers }));
vi.mock('./ActualPostPlayReviewFromSqlite', () => ({ actualPostPlayReviewEvidenceFromSqlite: (db: DatabaseSync) => ({
  readCurrent: (id: string) => id === 'review' ? fixtureInput(db, 'review') : null,
}) }));

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const setupFixture = () => {
  const f = actualScoringFixture(cleanup, { opening: true }), ready = f.closure.readReadiness('closure'), p = f.proposal;
  if (ready.kind !== 'ready' || !('activation' in p.expectedOfficial) || !('worldSetup' in p.application)) throw new Error('continuing scorer contract fixture required');
  const official = p.expectedOfficial;
  // This is the helper's frame contract, not a claimed durable physical flight.
  const flight = { source: { physicalPitchSourceId: 'fixture-next', execution: { venueId: p.fixture.venue_id } },
    physicalPitch: { source: { sourceId: 'fixture-next', gameId: p.gameId, activationApplicationId: p.application.applicationId },
      frame: { gameId: p.gameId, initialWorld: null, activationApplicationId: p.application.applicationId,
        officialRevision: official.receipt.durableRevision, match: official.activation.nextMatchState, world: official.nextWorld,
        activation: official.activation, batterActor: { source: { gameId: p.gameId, activationApplicationId: p.application.applicationId },
          match: official.activation.nextMatchState, world: official.nextWorld, officialRevision: official.receipt.durableRevision,
          fixtureHash: hash(p.fixture), binding: p.actors[0].binding, origin: { actualLiveReadiness: ready.reference } } } } } as unknown as DurableBattedBallFlight;
  return { f, flight, setup: p.application.worldSetup };
};
it('preserves closure-owned centers alongside a genuine compatible independent actual-live score', () => {
  const { f, flight, setup } = setupFixture();
  f.open().submit(f.source.sourceId);
  const before = f.preserved(), changes = f.db.prepare('SELECT total_changes() AS n').get()!.n;
  expect(battedWorldFrameBaseCenters(f.db, flight)).toEqual(setup.baseCenters);
  expect(f.preserved()).toEqual(before); expect(f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
});
it('rejects a corrupt compatible scorer archive instead of taking setup from its JSON', () => {
  const { f, flight } = setupFixture(); f.open().submit(f.source.sourceId);
  f.db.prepare("UPDATE official_scoring_applications SET request_json=json_set(request_json,'$.input.officialApplication.worldSetup.baseCenters.first.x',99)").run();
  expect(() => battedWorldFrameBaseCenters(f.db, flight)).toThrow(/scoring/);
});
it('keeps historical setup after a later valid Native Match application', () => {
  const { f, flight, setup } = setupFixture(); f.open().submit(f.source.sourceId);
  const current = f.match.getMatch(f.proposal.gameId)!; let timeline = createCanonicalPlateAppearanceTimeline(current.matchState, current.nextWorld!.tick);
  for (let i = 0; i < 3; i++) timeline = recordCountedPitch(timeline, timeline.lastEventTick + 10, { kind: 'called_strike' });
  const next = applyStrikeoutPlateAppearanceToMatchState(current.matchState, timeline);
  let ledger = createPlayAdjudicationLedger({ playId: current.matchState.playId, ruleProfileId: current.matchState.ruleProfileId, playEnd: null });
  ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'later-rule', snapshotId: 'later-rule', evidenceRevision: 1,
    tick: timeline.lastEventTick + 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
  ledger = closeOfficialPlay(ledger, 1, { eventId: 'later-close', closureId: 'later-close', tick: timeline.lastEventTick + 2 });
  f.match.applyAndActivate({ kind: 'non_live', matchId: f.proposal.gameId, applicationId: 'later-application',
    expectedDurableRevision: current.durableRevision, match: current.matchState, timeline, adjudication: ledger,
    context: { kind: 'strikeout' }, nextStartedAtTick: timeline.lastEventTick + 3, worldSetup: setup });
  expect(f.match.getMatch(f.proposal.gameId)!.durableRevision).toBe(current.durableRevision + 1);
  expect(json(battedWorldFrameBaseCenters(f.db, flight))).toBe(json(setup.baseCenters));
});
