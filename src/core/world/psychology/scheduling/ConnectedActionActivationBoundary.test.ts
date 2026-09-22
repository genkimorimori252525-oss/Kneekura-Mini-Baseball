import assert from 'node:assert/strict';
import { it } from 'vitest';
import { sampleRunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
import { prepareEmotionExecution } from '../execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import { request, runnerSource, value } from '../execution/ExecutionFixtures.test-support';
import { adoptRunnerControlAtTick } from './ConnectedActionAdoption';

const advancingAcceptance = () => {
  const base = request('SUPERIORITY', { runningRiskDelta: 0.3 });
  const input = { ...base, runner: runnerSource(base) };
  const proposal = value(prepareEmotionExecution(input));
  assert.ok(proposal.runner);
  assert.equal(proposal.runner.decision.motionIntent.kind, 'advance');
  return value(acceptEmotionExecution(input, proposal));
};

it('adopts runner control from the pre-activation body state and makes the new drive canonical at the event tick', () => {
  const accepted = advancingAcceptance();
  assert.ok(accepted.proposal.runner);
  assert.ok(accepted.proposal.request.runner);
  const source = accepted.proposal.request.runner;
  const execution = accepted.proposal.runner;
  const due = execution.decision.motionIntent.issuedTick + source.parameters.reactionDelayTicks;
  const postActivation = sampleRunnerMotionTrajectory(execution.trajectory, due);
  assert.equal(postActivation.driveDirection, 1);

  const preActivation = {
    ...postActivation,
    driveDirection: source.body.driveDirection,
    bodyMode: source.body.bodyMode,
  };
  assert.equal(preActivation.driveDirection, 0);

  const result = adoptRunnerControlAtTick({
    accepted,
    currentFrame: {
      ...accepted.expectedFrame,
      snapshotId: 'runtime-pre-activation',
      worldRevision: accepted.afterWorldRevision,
      time: { tick: due, sequence: 0 },
    },
    currentEmotion: accepted.proposal.appraisal.state,
    currentBody: preActivation,
  });

  assert.equal(result.status, 'ADOPTED');
  if (result.status !== 'ADOPTED') return;
  assert.equal(result.event.kind, 'RunnerControlActivated');
  if (result.event.kind !== 'RunnerControlActivated') return;
  assert.equal(result.event.state.driveDirection, 1);
  assert.equal(result.event.state.bodyMode, 'upright');
  assert.equal(result.event.state.routeDistanceMeters, preActivation.routeDistanceMeters);
  assert.equal(result.event.state.speedMps, preActivation.speedMps);
});

it('rejects a caller that claims the new runner control was already canonical before the activation event', () => {
  const accepted = advancingAcceptance();
  assert.ok(accepted.proposal.runner);
  assert.ok(accepted.proposal.request.runner);
  const source = accepted.proposal.request.runner;
  const execution = accepted.proposal.runner;
  const due = execution.decision.motionIntent.issuedTick + source.parameters.reactionDelayTicks;
  const postActivation = sampleRunnerMotionTrajectory(execution.trajectory, due);

  const result = adoptRunnerControlAtTick({
    accepted,
    currentFrame: {
      ...accepted.expectedFrame,
      snapshotId: 'runtime-post-control-too-early',
      worldRevision: accepted.afterWorldRevision,
      time: { tick: due, sequence: 0 },
    },
    currentEmotion: accepted.proposal.appraisal.state,
    currentBody: postActivation,
  });

  assert.equal(result.status, 'INVALIDATED');
  if (result.status !== 'INVALIDATED') return;
  assert.equal(result.reason, 'BODY_REBASED');
});
