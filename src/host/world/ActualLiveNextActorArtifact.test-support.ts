import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore, type AcceptedPhysicalPlateAppearanceActor } from './SqlitePhysicalPlateAppearanceActorStore';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource, type DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
/** Scheduled real next-actor admission on a separate completely settled artifact.
 * Batter selection is explicit fixture input. The existing host checks original
 * roster/Person/Club/side eligibility; no Native batting-order selection owner exists. */
export const verifyActualLiveNextActorArtifact = async (input: Readonly<{
  sourcePath: string; destinationPath: string; closureSourceId: string; nextBatterPlayerId: string; faultChecks: boolean; executeNextPitch: boolean; nextTake?: Extract<AcceptedPhysicalPitchActionSource['request']['batter'], { action: { kind: 'take' } }>; progress?: (message: string) => void;
}>) => {
  assert.notEqual(input.sourcePath, input.destinationPath); assert.equal(existsSync(input.destinationPath), false);
  mkdirSync(dirname(input.destinationPath), { recursive: true }); const originalHash = fileHash(input.sourcePath);
  const source = new DatabaseSync(input.sourcePath, { readOnly: true }); try { await backup(source, input.destinationPath); } finally { source.close(); }
  const resources: { close(): void }[] = [];
  const track = <T extends { close(): void }>(resource: T): T => { resources.push(resource); return resource; };
  const drain = () => { while (resources.length) resources.pop()!.close(); };
  try {
  const db = track(new DatabaseSync(input.destinationPath)), links = track(openSqlitePlayerPersonLinkStore(input.destinationPath)), official = track(new SqliteOfficialStateStore(input.destinationPath));
  const ready = actualLivePlayReadinessFromSqlite(db).read(input.closureSourceId); assert.equal(ready.kind, 'ready');
  if (ready.kind !== 'ready') throw new Error('actual next-actor fixture must already have complete effects');
  const p = ready.closure.proposal;
  assert('nextWorld' in p.expectedOfficial, 'a final Match cannot activate another actor');
  const first = p.actors[0].binding, game = p.seasonFixture.game;
  const participation = track(new SqliteOfficialParticipationStore(input.destinationPath, { readGame: gameId => gameId !== p.gameId ? null : {
    careerId: first.careerId, competitionEditionId: first.competitionEditionId, gameDay: first.gameDay,
    homeClubId: game.homeClubId, awayClubId: game.awayClubId, fixtureEventId: first.fixtureEventId },
    readRoster: () => null, readPersonLink: (playerId, sourceId) => { const link = links.readLink(sourceId); return link?.playerId === playerId ? { sourceId, personId: link.personId } : null; } }));
  const initialWorlds = track(openSqliteOfficialInitialWorldStore(input.destinationPath, { matches: official, participation }));
  const inputs = new Map<string, AcceptedPhysicalPlateAppearanceActor>();
  const actors = track(openSqlitePhysicalPlateAppearanceActorStore(input.destinationPath, { matches: official, participation, initialWorlds },
    { readAcceptedActor: sourceId => inputs.get(sourceId) ?? null }));
  let result: ReturnType<typeof actors.accept> | null = null, nextPitch: DurablePhysicalPitch | null = null;
  const request: AcceptedPhysicalPlateAppearanceActor = { sourceId: 'fixture-next-actual-batter', sourceVersion: 'fixture-v1', gameId: p.gameId,
    playerId: input.nextBatterPlayerId, activationApplicationId: p.application.applicationId };
  inputs.set(request.sourceId, request);
  try {
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
    assert.equal(db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file, input.destinationPath);
    assert.equal(p.scoring.kind, 'unsupported');
    const before = db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY rowid').all();
    const bad = { ...request, sourceId: 'fixture-wrong-activation', activationApplicationId: 'missing-activation' };
    inputs.set(bad.sourceId, bad); assert.throws(() => actors.accept(bad.sourceId));
    if (input.faultChecks) {
      db.exec("CREATE TRIGGER corrupt_readiness_after_actor AFTER INSERT ON physical_plate_appearance_actors BEGIN UPDATE world_player_workload_heads SET revision=revision+100; END;");
      assert.throws(() => actors.accept(request.sourceId));
      assert.deepEqual(db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY rowid').all(), before);
      db.exec('DROP TRIGGER corrupt_readiness_after_actor');
      assert.equal(actualLivePlayReadinessFromSqlite(db).read(input.closureSourceId).kind, 'ready');
    }
    input.progress?.('admitting the next actual batter from closed gameplay and all original role effects');
    result = actors.accept(request.sourceId); assert.equal(result.match.playId, p.playId + 1);
    assert.equal(result.origin.scoringHash, null); assert.deepEqual(result.origin.actualLiveReadiness, ready.reference);
    assert.deepEqual(result.world, p.expectedOfficial.nextWorld); assert.equal(result.world.runners.length, 0);
    assert.deepEqual(actors.accept(request.sourceId), result);
    assert.equal(Number(db.prepare('SELECT count(*) AS n FROM physical_plate_appearance_actors').get()!.n), before.length + 1);
    if (input.executeNextPitch) {
      const original = readPhysicalPitchProgressFromSqlite(db, p.gameId, p.playId).at(-1); assert(original);
      const workload = track(openSqlitePlayerWorkloadRecoveryStore(input.destinationPath, links));
      const timing = track(openSqlitePlayerPitchTimingStore(input.destinationPath, links));
      const release = track(openSqlitePlayerReleaseGeometryStore(input.destinationPath, links));
      const policies = track(openSqlitePitchFatiguePolicyStore(input.destinationPath));
      const current = workload.readHead(original.frame.workload.careerId, original.frame.workload.playerId); assert(current);
      const nextTake = input.nextTake; assert(nextTake, 'explicit next-take fixture Source required');
      const request: AcceptedPhysicalPitchActionSource = { sourceId: 'fixture-next-actual-pitch', sourceVersion: 'fixture-v1', gameId: p.gameId,
        activationApplicationId: p.application.applicationId, effortPolicy: original.source.effortPolicy,
        request: { ...original.source.request, workloadRevision: current.revision,
          delivery: { ...original.source.request.delivery, readyAtUs: result.world.tick },
          batter: nextTake } };
      const pitches = track(openSqlitePhysicalPitchProgressStore(input.destinationPath, { matches: official, initialWorlds, participation,
        runtime: { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: sourceId =>
          sourceId === original.source.effortPolicy.sourceId ? original.source.effortPolicy : null } } },
        { readAcceptedAction: sourceId => sourceId === request.sourceId ? request : null }));
      input.progress?.('executing one new physical take from the real next-play actor/world and settled pitcher workload');
      nextPitch = pitches.accept(request.sourceId, 0);
      assert.equal(nextPitch.frame.match.playId, p.playId + 1); assert.equal(nextPitch.frame.batterActor!.source.sourceId, result.source.sourceId);
      assert.deepEqual(nextPitch.frame.workload, current); assert.equal(nextPitch.beforeTimeline.startedAtTick, result.world.tick);
      assert(nextPitch.result.pitch.resolution.timeline.events.length > nextPitch.beforeTimeline.events.length);
      assert.deepEqual(pitches.accept(request.sourceId, 0), nextPitch);
    }

  } finally { drain(); }
  const reopened = new DatabaseSync(input.destinationPath);
  try {
    const { readPhysicalPlateAppearanceActorFromSqlite } = await import('./PhysicalPlateAppearanceActorEvidenceFromSqlite');
    assert.equal(json(readPhysicalPlateAppearanceActorFromSqlite(reopened, request.sourceId)), json(result));
    if (nextPitch) assert.equal(json(readPhysicalPitchProgressFromSqlite(reopened, p.gameId, p.playId + 1).at(-1)), json(nextPitch));
  } finally { reopened.close(); }
  assert.equal(fileHash(input.sourcePath), originalHash);
  return { sourceSha256: originalHash, destinationSha256: fileHash(input.destinationPath), sourceUnchanged: true,
    destinationPath: input.destinationPath, realDisk: true, wal: true, allConnectionsClosedReopened: true,
    exactlyOnceActorAdmission: true, scoringStillUnsupported: true, nextBatterSelection: 'explicit_fixture_input' as const, autonomousLineupSelection: false, nextPitchExecuted: nextPitch !== null, faultChecks: input.faultChecks, actor: result, nextPitch };
  } finally { drain(); }
};
