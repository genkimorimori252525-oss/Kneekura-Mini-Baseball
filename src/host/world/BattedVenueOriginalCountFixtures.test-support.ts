import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';

/** Two actually executed taken strikes followed by an actually executed bat contact.
 * The third pitch reuses its original physical frame; count comes from its timeline. */
export const nativeThirdPitchContactFixture = (path: string) => {
  const x = physicalPlateAppearanceActorFixture(path, undefined, { ruleProfileId: NPB_2026_RULE_PROFILE.id });
  try {
    x.actors.accept(x.source.sourceId);
    const first = x.pitch(0, 0), firstTimeline = first.result.pitch.resolution.timeline;
    const second = x.pitch(1, firstTimeline.lastEventTick), before = second.result.pitch.resolution.timeline;
    if (before.status.kind !== 'active' || before.status.count.strikes !== 2) throw new Error('actual taken-pitch fixture did not reach two strikes');
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(x.f.stores, { ...x.f.input,
      timeline: before, effortPolicySourceId: x.f.effort.sourceId,
      delivery: { ...x.f.input.delivery, pitchIndex: 2, readyAtUs: before.lastEventTick } });
    const startTick = preview.pitch.trajectory.start.tick + 590_000;
    const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const action = continuousPitchAction(x.f, 2, before.lastEventTick);
    const contactAction = { ...action, request: { ...action.request, batter: { action: { kind: 'swing' as const,
      swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
        stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
          linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } };
    x.actions.set(contactAction.sourceId, contactAction);
    const third = x.pitches.accept(contactAction.sourceId, 2);
    return { ...x, first, second, third };
  } catch (error) { x.f.close(); throw error; }
};
