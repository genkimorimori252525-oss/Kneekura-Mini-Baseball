import { expect, it } from 'vitest';
import * as knowledge from './SqliteActualFieldObservationStore';
import { requireOriginalRunnerPublicKnowledgeStore } from './OriginalRunnerPublicKnowledgeContracts.test-support';
import { originalPublicProgressFixture, missingOriginalPublicCurrentFrameGuard } from './OriginalRunnerPublicKnowledgeReview.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';

it('admits the same runner in the next lawful play beside historical knowledge and refuses fresh ownership of the closed activation', () => {
  const x = originalPublicProgressFixture(), source = x.source('baseline'), sources = new Map([[source.sourceId, source]]);
  const store = requireOriginalRunnerPublicKnowledgeStore(knowledge)(x.f.path, { readAcceptedKnowledge: id => sources.get(id) ?? null });
  try {
    const saved = store.accept(source.sourceId), third = x.pitch(2, x.second.result.pitch.resolution.timeline.lastEventTick);
    expect(third.result.pitch.resolution.timeline.status.kind).toBe('strikeout');
    const close = { ...x.closeInput(third.result.pitch.resolution.timeline.lastEventTick, third.source.sourceId), sourceId: 'close-2',
      applicationId: 'application-2', scoringApplicationId: 'scoring-2', snapshotId: 'rule-2' };
    x.closes.set(close.sourceId, close); x.closure.submit(close.sourceId);
    const current = x.f.official.getMatch(x.actor.source.gameId)!;
    expect(current.matchState.playId).toBeGreaterThan(x.actor.match.playId); expect(current.durableRevision).toBeGreaterThan(x.actor.officialRevision);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(x.f.db, x.first.source.sourceId).at(-1)).toEqual(x.first);
    expect(store.read(source.sourceId)).toEqual(saved); expect(store.accept(source.sourceId)).toEqual(saved);
    const next = x.nextPlay(); sources.set(next.source.sourceId, next.source);
    const currentBaseline = store.accept(next.source.sourceId);
    expect(currentBaseline.recipient.gameId).toBe(saved.recipient.gameId);
    expect(currentBaseline.recipient.playerId).toBe(saved.recipient.playerId); expect(currentBaseline.recipient.personId).toBe(saved.recipient.personId);
    expect(currentBaseline.recipient.playId).toBeGreaterThan(saved.recipient.playId);
    expect(currentBaseline.original.physicalActorSourceId).not.toBe(saved.original.physicalActorSourceId);
    expect(currentBaseline.original.prePitchRunnerSourceId).not.toBe(saved.original.prePitchRunnerSourceId);
    expect(currentBaseline.known).toMatchObject({ outs: 1, startingBase: 1 }); expect(saved.known.outs).toBe(0);
    expect(currentBaseline.availableAtTick).toBeGreaterThan(saved.availableAtTick);
    expect(store.read(source.sourceId)).toEqual(saved); expect(store.accept(source.sourceId)).toEqual(saved);
    expect(store.read(next.source.sourceId)).toEqual(currentBaseline); expect(store.accept(next.source.sourceId)).toEqual(currentBaseline);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_runner_public_knowledge').get()!.n).toBe(2);
    const currentRows = x.f.db.prepare('SELECT * FROM actual_runner_public_knowledge WHERE source_id=?').all(next.source.sourceId);
    // Remove only this test owner's old row to isolate fresh stale admission.
    // The lawful new baseline and all original owner histories remain intact.
    x.f.db.prepare('DELETE FROM actual_runner_public_knowledge WHERE source_id=?').run(source.sourceId);
    let error: unknown; try { store.accept(source.sourceId); } catch (caught) { error = caught; }
    if (error === undefined) missingOriginalPublicCurrentFrameGuard();
    expect(String(error)).toMatch(/current|frame|advanced|changed/);
    expect(x.f.db.prepare('SELECT * FROM actual_runner_public_knowledge').all()).toEqual(currentRows);
    expect(store.read(next.source.sourceId)).toEqual(currentBaseline);
    expect(x.f.official.getMatch(x.actor.source.gameId)).toEqual(current);
  } finally { store.close(); x.close(); }
}, 180_000);
