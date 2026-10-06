import { expect, it } from 'vitest';
import * as locomotion from './SqliteActualLocomotionStore';
import { runnerContactWaitProspectiveFixture, requireRunnerContactWaitFactory } from './RunnerNativeContactWaitFixtures.test-support';

it.each(['before', 'after'] as const)
('exposes only saved view ownership for an unsaved Source %s the dependent pitch', timing => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(requireRunnerContactWaitFactory(locomotion)(x.f.path, x.authority));
    store.acceptPolicy(x.policy.sourceId); const saved = store.acceptView(x.view.sourceId);
    if (timing === 'after') {
      const pitch = x.advancePitch(); expect(pitch.frame.batterActor?.source.sourceId).toBe(x.actor.source.sourceId);
      expect(x.f.db.prepare('SELECT count(*) AS n FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=?')
        .get(x.actor.source.gameId, x.actor.match.playId)!.n).toBe(1);
    } else x.noPitch();
    const unsaved = { ...x.view, sourceId: 'wait-unowned-view', validFromTick: x.view.validThroughTick + 1,
      validThroughTick: x.view.validThroughTick + 2 };
    const before = x.allRows(), evidence = locomotion.runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    expect(evidence.readView(saved.source.sourceId)).toEqual(saved);
    expect(evidence.readView(unsaved.sourceId)).toBeNull();
    // The pre-repair helper returns an admission-shaped value despite there being no saved ownership.
    const derive = (evidence as unknown as { deriveView?: (source: typeof unsaved) => unknown }).deriveView;
    const unownedAdmission = typeof derive === 'function' ? derive(unsaved) : null;
    if (unownedAdmission !== null) expect(unownedAdmission).toHaveProperty('admission', 'prospective_before_dependent_pitch');
    expect(x.allRows()).toEqual(before); expect(store.readView(unsaved.sourceId)).toBeNull();
    expect(unownedAdmission === null).toBe(true);
    expect(Object.keys(evidence).sort()).toEqual(['readPolicy', 'readView']);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});
