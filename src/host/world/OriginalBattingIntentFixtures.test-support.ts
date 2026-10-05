import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { samplePitchTrajectorySegment } from '../../core/sim/pitching/PitchTrajectory';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';
import type { AcceptedOriginalBattingIntent } from './OriginalBattingIntent';

/** Prepares original accepted actors/calibration and a contact action, but does not
 * accept the physical pitch. The bat placement is the existing batted-flight fixture. */
export const originalBattingIntentFixture = (path: string) => {
  const x = physicalPlateAppearanceActorFixture(path, undefined, { ruleProfileId: NPB_2026_RULE_PROFILE.id });
  try {
    const actor = x.actors.accept(x.source.sourceId);
    const preview = resolveContinuousPlayerPitchAgainstBatterFromWorld(x.f.stores, x.f.input);
    const startTick = preview.pitch.trajectory.start.tick + 590_000;
    const ball = samplePitchTrajectorySegment(preview.pitch.trajectory, startTick).position;
    const original = continuousPitchAction(x.f, 0, 0);
    const action = { ...original, request: { ...original.request, batter: { action: { kind: 'swing' as const,
      swing: { startTick, endTick: startTick + 10_000, ticksPerSecond: 1_000_000,
        stateAtStart: { pose: { grip: { ...ball, x: ball.x - 0.4 }, tip: { ...ball, x: ball.x + 0.4 } },
          linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } } } } } } };
    const expected = resolveContinuousPlayerPitchAgainstBatterFromWorld(x.f.stores, { ...x.f.input, batter: action.request.batter });
    if (expected.pitch.resolution.timeline.status.kind !== 'batted_ball_pending') {
      throw new Error('original batting fixture did not derive a real contact before Source acceptance');
    }
    const withIntent = (attempt: AcceptedOriginalBattingIntent['attempt']) => ({ ...action,
      battingIntent: { version: 'original_batting_intent_v1' as const, actorSourceId: actor.source.sourceId, attempt } });
    return { ...x, actor, action, expected, withIntent };
  } catch (error) { x.f.close(); throw error; }
};
