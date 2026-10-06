import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import type { AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import type { OriginalRunnerPublicKnowledgeSource } from './OriginalRunnerPublicKnowledgeContracts.test-support';

/** Genuine legal walk, then two taken strikes in one original runner/actor
 * activation. All Match and controller inputs are prospective; no saved original
 * is rewritten and no batted-ball closure or general eleven-player End is claimed. */
export const originalPublicProgressFixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-public-progress-')), path = join(directory, 'state.sqlite');
  const x = physicalPlateAppearanceActorFixture(path, undefined, { ruleProfileId: asRuleProfileId('npb-2026') }), { f } = x;
  let closed = false;
  const close = () => { if (!closed) { closed = true; try { f.close(); } finally { rmSync(directory, { recursive: true, force: true }); } } };
  try {
    x.actors.accept(x.source.sourceId); let tick = 0;
    for (let i = 0; i < 4; i++) {
      const action = continuousPitchAction(f, i, tick);
      x.actions.set(action.sourceId, { ...action, request: { ...action.request, delivery: { ...action.request.delivery,
        moundReference: { ...action.request.delivery.moundReference, x: 1 } } } });
      tick = x.pitches.accept(action.sourceId, i).result.pitch.resolution.timeline.lastEventTick;
    }
    const walk = x.closeInput(tick, 'pitch-3', 'away-1'); x.closes.set(walk.sourceId, walk); x.closure.submit(walk.sourceId);
    x.accepted.set('batter-2', { sourceId: 'batter-2', sourceVersion: 'v1', gameId: 'game-1', playerId: 'away-2', activationApplicationId: 'application-1' });
    const actor = x.actors.accept('batter-2'), original = actor.world.runners[0], zero = { x: 0, y: 0, z: 0 };
    if (actor.match.ruleProfileId !== 'npb-2026' || actor.match.bases.first !== 'away-1' || actor.world.runners.length !== 1
      || original.velocity.x !== 0 || original.velocity.z !== 0) throw new Error('original public progression runner prerequisite differs');
    const runner: AcceptedPrePitchRunnerExecution = { kind: 'pre_pitch_upright_runner_v1', sourceId: 'public-progress-runner', sourceVersion: 'synthetic-v1',
      gameId: actor.source.gameId, physicalActorSourceId: actor.source.sourceId, playerId: original.playerId, motionRevision: 0,
      route: { segments: [{ kind: 'line', start: original.position, end: { x: original.position.x + 100, z: original.position.z } }] },
      startMotion: { tick: actor.world.tick, routeDistanceMeters: 0, speedMps: 0, driveDirection: 0, bodyMode: 'upright' },
      intent: { kind: 'hold', issuedTick: actor.world.tick }, parameters: { ticksPerSecond: 1_000_000, reactionDelayTicks: 0,
        accelerationMps2: 2, brakingMps2: 4, slideDecelerationMps2: 4, topSpeedMps: 5 }, coverageThroughTick: actor.world.tick + 100_000_000,
      bodyPose: { bodyOriginHeightMeters: 0, primitiveMotions: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const)
        .map(role => ({ role, startOffset: zero, offsetVelocity: zero, offsetAcceleration: zero })) } };
    const pitch = (index: number, readyAtUs: number) => {
      const initial = continuousPitchAction(f, index, readyAtUs);
      const action: AcceptedPhysicalPitchActionSource = { sourceId: `public-progress-pitch-${index}`, sourceVersion: 'synthetic-v1', gameId: actor.source.gameId,
        activationApplicationId: 'application-1', request: { ...initial.request, workloadRevision: 1 }, effortPolicy: initial.effortPolicy, prePitchRunner: runner };
      x.actions.set(action.sourceId, action); return x.pitches.accept(action.sourceId, index);
    };
    const first = pitch(0, actor.world.tick), second = pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
    if (first.progressRevision !== 1 || second.progressRevision !== 2 || first.frame.batterActor?.source.sourceId !== actor.source.sourceId
      || second.frame.prePitchRunner?.source.sourceId !== runner.sourceId || second.result.pitch.resolution.timeline.status.kind !== 'active') {
      throw new Error('genuine original public pitch progression prerequisite differs');
    }
    const source = (id: string, physicalPitchSourceId = first.source.sourceId): OriginalRunnerPublicKnowledgeSource => ({
      kind: 'original_runner_public_knowledge_v1', sourceId: id, sourceVersion: 'synthetic-v1', physicalPitchSourceId,
      playerId: runner.playerId, physicalActorSourceId: actor.source.sourceId, prePitchRunnerSourceId: runner.sourceId });
    const nextPlay = () => {
      x.accepted.set('batter-3', { sourceId: 'batter-3', sourceVersion: 'v1', gameId: actor.source.gameId, playerId: 'away-3', activationApplicationId: 'application-2' });
      const nextActor = x.actors.accept('batter-3'), nextRunner = nextActor.world.runners[0];
      if (nextActor.match.playId <= actor.match.playId || nextActor.world.runners.length !== 1 || nextRunner.playerId !== runner.playerId
        || nextRunner.velocity.x !== 0 || nextRunner.velocity.z !== 0) throw new Error('lawful next-play runner prerequisite differs');
      const nextMotion: AcceptedPrePitchRunnerExecution = { ...runner, sourceId: 'public-next-play-runner', physicalActorSourceId: nextActor.source.sourceId,
        route: { segments: [{ kind: 'line', start: nextRunner.position, end: { x: nextRunner.position.x + 100, z: nextRunner.position.z } }] },
        startMotion: { ...runner.startMotion, tick: nextActor.world.tick }, intent: { kind: 'hold', issuedTick: nextActor.world.tick },
        coverageThroughTick: nextActor.world.tick + 100_000_000 };
      const initial = continuousPitchAction(f, 0, nextActor.world.tick);
      const action: AcceptedPhysicalPitchActionSource = { sourceId: 'public-next-play-pitch', sourceVersion: 'synthetic-v1', gameId: nextActor.source.gameId,
        activationApplicationId: 'application-2', request: { ...initial.request, workloadRevision: 2 }, effortPolicy: initial.effortPolicy, prePitchRunner: nextMotion };
      x.actions.set(action.sourceId, action); const physical = x.pitches.accept(action.sourceId, 0);
      return { actor: nextActor, runner: nextMotion, physical, source: { kind: 'original_runner_public_knowledge_v1' as const,
        sourceId: 'baseline-next-play', sourceVersion: 'synthetic-v1', physicalPitchSourceId: physical.source.sourceId,
        playerId: nextMotion.playerId, physicalActorSourceId: nextActor.source.sourceId, prePitchRunnerSourceId: nextMotion.sourceId } };
    };
    return { ...x, actor, runner, first, second, source, pitch, nextPlay, close };
  } catch (error) { close(); throw error; }
};

export const missingOriginalPublicIdentityGuard = (): never => { throw new Error('original public baseline stable identity guard is missing'); };
export const missingOriginalPublicCurrentFrameGuard = (): never => { throw new Error('original public baseline admission current-frame guard is missing'); };
