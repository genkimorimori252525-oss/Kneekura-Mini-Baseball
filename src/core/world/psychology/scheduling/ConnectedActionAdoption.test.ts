import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sampleRunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
import { sampleDefenderMotionSegment } from '../../../sim/fielding/DefenderMotion';
import { prepareEmotionExecution } from '../execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import { request, runnerSource, value } from '../execution/ExecutionFixtures.test-support';
import { prepareFieldingExecution, acceptFieldingExecution } from '../fielding/FieldingExecution';
import { fixture } from '../fielding/FieldingFixtures.test-support';
import {
  adoptFieldingActionAtTick,
  adoptRunnerControlAtTick,
  projectFieldingActionFrontier,
  projectRunnerActionFrontier,
} from './ConnectedActionAdoption';

const runnerAcceptance = () => {
  const base = request();
  const withRunner = { ...base, runner: runnerSource(base) };
  const proposal = value(prepareEmotionExecution(withRunner));
  return value(acceptEmotionExecution(withRunner, proposal));
};

const runtimeFrame = (
  frame: ReturnType<typeof runnerAcceptance>['expectedFrame'],
  worldRevision: number,
  tick: number,
) => ({
  ...frame,
  snapshotId: `runtime-${tick}`,
  worldRevision,
  time: { tick, sequence: 0 },
});

const fieldingAcceptance = (kind: 'THROW' | 'REPLAN') => {
  const input = fixture(kind);
  const proposal = value(prepareFieldingExecution(input));
  return value(acceptFieldingExecution(input, proposal));
};

describe('runner action frontier and exact activation', () => {
  it('keeps the accepted runner intent pending until its physical reaction tick', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const projected = projectRunnerActionFrontier(accepted, due - 1);
    assert.equal(projected.dueTick, due);
    assert.equal(projected.queue.nextPendingTick, due);
    assert.equal(projected.queue.settledThroughTick, due - 1);
    assert.equal(projected.intents.length, 1);
    assert.equal(projected.intents[0].dueTick, due);
    assert.equal(projected.physical.length, 1);
    assert.equal(projected.physical[0].kind, 'runner_motion');
  });

  it('activates runner control only at the exact reaction tick when current kinematics still match', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const currentBody = sampleRunnerMotionTrajectory(
      accepted.proposal.runner.trajectory,
      due,
    );
    const result = adoptRunnerControlAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due),
      currentEmotion: accepted.proposal.appraisal.state,
      currentBody,
    });
    assert.equal(result.status, 'ADOPTED');
    if (result.status !== 'ADOPTED') return;
    assert.equal(result.event.kind, 'RunnerControlActivated');
    assert.equal(result.event.tick, due);
    assert.equal(result.queueAfter.settledThroughTick, due);
    assert.equal(result.queueAfter.nextPendingTick, null);
  });

  it('does not force an obsolete runner trajectory after a world rebase', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const currentBody = {
      ...sampleRunnerMotionTrajectory(accepted.proposal.runner.trajectory, due),
      routeDistanceMeters: 99,
    };
    const result = adoptRunnerControlAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision + 1, due),
      currentEmotion: accepted.proposal.appraisal.state,
      currentBody,
    });
    assert.deepEqual(result, {
      status: 'INVALIDATED',
      reason: 'BODY_REBASED',
      dueTick: due,
    });
  });

  it('never backdates a runner-control event after the reaction tick was missed', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const currentBody = sampleRunnerMotionTrajectory(accepted.proposal.runner.trajectory, due);
    const result = adoptRunnerControlAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due + 1),
      currentEmotion: accepted.proposal.appraisal.state,
      currentBody: { ...currentBody, tick: due + 1 },
    });
    assert.deepEqual(result, {
      status: 'MISSED_EVENT',
      dueTick: due,
    });
  });
});

describe('throw release frontier and exact adoption', () => {
  it('keeps release pending in the frontier until the launch tick', () => {
    const accepted = fieldingAcceptance('THROW');
    assert.ok(accepted.proposal.plan?.kind === 'THROW');
    const due = accepted.proposal.plan.launch.releaseTick;
    const projected = projectFieldingActionFrontier(accepted, due - 1);
    assert.equal(projected.kind, 'THROW_RELEASE');
    assert.equal(projected.queue.nextPendingTick, due);
    assert.equal(projected.queue.settledThroughTick, due - 1);
    assert.equal(projected.intents[0].dueTick, due);
    assert.equal(projected.physical[0].kind, 'throw');
  });

  it('releases only when the ball is still held at the saved physical origin', () => {
    const accepted = fieldingAcceptance('THROW');
    assert.ok(accepted.proposal.plan?.kind === 'THROW');
    assert.ok(accepted.proposal.request.source.kind === 'THROW');
    const plan = accepted.proposal.plan;
    const source = accepted.proposal.request.source;
    const due = plan.launch.releaseTick;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'THROW',
        tick: due,
        ballId: source.ballId,
        holderId: source.holderId,
        origin: plan.launch.origin,
        holderVelocity: source.holderVelocity,
      },
    });
    assert.equal(result.status, 'ADOPTED');
    if (result.status !== 'ADOPTED') return;
    assert.equal(result.event.kind, 'ThrowReleased');
    assert.deepEqual(result.event.launch, plan.launch);
    assert.equal(result.queueAfter.settledThroughTick, due);
  });

  it('invalidates release if possession was lost before the scheduled tick', () => {
    const accepted = fieldingAcceptance('THROW');
    assert.ok(accepted.proposal.plan?.kind === 'THROW');
    assert.ok(accepted.proposal.request.source.kind === 'THROW');
    const plan = accepted.proposal.plan;
    const source = accepted.proposal.request.source;
    const due = plan.launch.releaseTick;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision + 1, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'THROW',
        tick: due,
        ballId: source.ballId,
        holderId: null,
        origin: plan.launch.origin,
        holderVelocity: source.holderVelocity,
      },
    });
    assert.deepEqual(result, {
      status: 'INVALIDATED',
      reason: 'POSSESSION_CHANGED',
      dueTick: due,
    });
  });
});

describe('defensive replan frontier and exact activation', () => {
  const expectedAt = (accepted: ReturnType<typeof fieldingAcceptance>, due: number) => {
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    assert.ok(accepted.proposal.request.source.kind === 'REPLAN');
    const segment = [...accepted.proposal.plan.segments]
      .reverse()
      .find((item) => item.startTick <= due && due <= item.endTick);
    return segment
      ? sampleDefenderMotionSegment(segment, due)
      : accepted.proposal.request.source.body;
  };

  it('keeps a committed defensive replan visible to the action frontier before motor onset', () => {
    const accepted = fieldingAcceptance('REPLAN');
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    const due = accepted.proposal.plan.movementStartTick;
    const projected = projectFieldingActionFrontier(accepted, due - 1);
    assert.equal(projected.kind, 'DEFENSE_REPLAN');
    assert.equal(projected.queue.nextPendingTick, due);
    assert.equal(projected.intents[0].dueTick, due);
    assert.equal(projected.physical[0].kind, 'defender_motion');
    assert.equal(projected.physical[0].throughTick, accepted.proposal.plan.endState.tick);
  });

  it('activates the new defensive target only from the exact current position and velocity', () => {
    const accepted = fieldingAcceptance('REPLAN');
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    const due = accepted.proposal.plan.movementStartTick;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'REPLAN',
        body: expectedAt(accepted, due),
      },
    });
    assert.equal(result.status, 'ADOPTED');
    if (result.status !== 'ADOPTED') return;
    assert.equal(result.event.kind, 'DefenderReplanActivated');
    assert.equal(result.event.tick, due);
    assert.deepEqual(result.event.target, accepted.proposal.plan.target);
  });

  it('invalidates the old replan instead of teleporting a defender back onto its saved route', () => {
    const accepted = fieldingAcceptance('REPLAN');
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    const due = accepted.proposal.plan.movementStartTick;
    const body = expectedAt(accepted, due);
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision + 1, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'REPLAN',
        body: {
          ...body,
          position: { x: body.position.x + 1, z: body.position.z },
        },
      },
    });
    assert.deepEqual(result, {
      status: 'INVALIDATED',
      reason: 'BODY_REBASED',
      dueTick: due,
    });
  });

  it('invalidates a queued action when a newer emotion gate supersedes the accepted one', () => {
    const accepted = fieldingAcceptance('REPLAN');
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    const due = accepted.proposal.plan.movementStartTick;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due),
      currentEmotion: {
        ...accepted.proposal.request.currentEmotion,
        revision: accepted.emotionRevision + 1,
      },
      currentPhysical: {
        kind: 'REPLAN',
        body: expectedAt(accepted, due),
      },
    });
    assert.deepEqual(result, {
      status: 'INVALIDATED',
      reason: 'EMOTION_SUPERSEDED',
      dueTick: due,
    });
  });
});


describe('frontier handoff and cancellation settlement', () => {
  it('keeps released throw as physical frontier work until a downstream flight owner replaces it', () => {
    const accepted = fieldingAcceptance('THROW');
    assert.ok(accepted.proposal.plan?.kind === 'THROW');
    assert.ok(accepted.proposal.request.source.kind === 'THROW');
    const plan = accepted.proposal.plan;
    const source = accepted.proposal.request.source;
    const due = plan.launch.releaseTick;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'THROW',
        tick: due,
        ballId: source.ballId,
        holderId: source.holderId,
        origin: plan.launch.origin,
        holderVelocity: source.holderVelocity,
      },
    });
    assert.equal(result.status, 'ADOPTED');
    if (result.status !== 'ADOPTED') return;
    assert.equal(result.physicalAfter.length, 1);
    assert.equal(result.physicalAfter[0].kind, 'throw');
    assert.equal(result.physicalAfter[0].throughTick, due);
    assert.equal(result.physicalAfter[0].actionKey, accepted.actionKey);
  });

  it('returns a closed source watermark when a scheduled action is missed', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const expected = sampleRunnerMotionTrajectory(accepted.proposal.runner.trajectory, due);
    const result = adoptRunnerControlAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision, due + 1),
      currentEmotion: accepted.proposal.appraisal.state,
      currentBody: { ...expected, tick: due + 1 },
    });
    assert.equal(result.status, 'MISSED_EVENT');
    if (result.status !== 'MISSED_EVENT') return;
    assert.equal(result.queueAfter.nextPendingTick, null);
    assert.equal(result.queueAfter.settledThroughTick, due + 1);
  });

  it('returns a closed source watermark when a scheduled action is invalidated at its due tick', () => {
    const accepted = fieldingAcceptance('REPLAN');
    assert.ok(accepted.proposal.plan?.kind === 'REPLAN');
    assert.ok(accepted.proposal.request.source.kind === 'REPLAN');
    const due = accepted.proposal.plan.movementStartTick;
    const segment = [...accepted.proposal.plan.segments]
      .reverse()
      .find((item) => item.startTick <= due && due <= item.endTick);
    const body = segment
      ? sampleDefenderMotionSegment(segment, due)
      : accepted.proposal.request.source.body;
    const result = adoptFieldingActionAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision + 1, due),
      currentEmotion: accepted.proposal.request.currentEmotion,
      currentPhysical: {
        kind: 'REPLAN',
        body: { ...body, position: { x: body.position.x + 1, z: body.position.z } },
      },
    });
    assert.equal(result.status, 'INVALIDATED');
    if (result.status !== 'INVALIDATED') return;
    assert.equal(result.queueAfter.nextPendingTick, null);
    assert.equal(result.queueAfter.settledThroughTick, due);
  });

  it('invalidates runner activation when body control mode changed despite identical position and speed', () => {
    const accepted = runnerAcceptance();
    assert.ok(accepted.proposal.runner);
    assert.ok(accepted.proposal.request.runner);
    const due = accepted.proposal.runner.decision.motionIntent.issuedTick
      + accepted.proposal.request.runner.parameters.reactionDelayTicks;
    const expected = sampleRunnerMotionTrajectory(accepted.proposal.runner.trajectory, due);
    const changed = {
      ...expected,
      driveDirection: 0 as const,
      bodyMode: 'sliding' as const,
    };
    const result = adoptRunnerControlAtTick({
      accepted,
      currentFrame: runtimeFrame(accepted.expectedFrame, accepted.afterWorldRevision + 1, due),
      currentEmotion: accepted.proposal.appraisal.state,
      currentBody: changed,
    });
    assert.deepEqual(result, {
      status: 'INVALIDATED',
      reason: 'BODY_REBASED',
      dueTick: due,
      queueAfter: {
        sourceId: result.status === 'INVALIDATED' ? result.queueAfter.sourceId : '',
        settledThroughTick: due,
        nextPendingTick: null,
      },
    });
  });
});
