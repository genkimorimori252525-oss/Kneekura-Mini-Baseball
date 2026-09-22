import assert from 'node:assert/strict';
import { it } from 'vitest';
import { prepareEmotionExecution } from '../execution/ExecutionPreparation';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import { request, runnerSource, value } from '../execution/ExecutionFixtures.test-support';
import { sampleRunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
import { prepareFieldingExecution, acceptFieldingExecution } from '../fielding/FieldingExecution';
import { fixture } from '../fielding/FieldingFixtures.test-support';
import { adoptFieldingActionAtTick, adoptRunnerControlAtTick } from './ConnectedActionAdoption';

it('does not invoke a hostile currentFrame getter during runner adoption', () => {
  const base = request();
  const withRunner = { ...base, runner: runnerSource(base) };
  const proposal = value(prepareEmotionExecution(withRunner));
  const accepted = value(acceptEmotionExecution(withRunner, proposal));
  assert.ok(accepted.proposal.runner);
  assert.ok(accepted.proposal.request.runner);
  const due = accepted.proposal.runner.decision.motionIntent.issuedTick
    + accepted.proposal.request.runner.parameters.reactionDelayTicks;
  const expected = sampleRunnerMotionTrajectory(accepted.proposal.runner.trajectory, due);
  const preActivation = {
    ...expected,
    driveDirection: accepted.proposal.request.runner.body.driveDirection,
    bodyMode: accepted.proposal.request.runner.body.bodyMode,
  };
  let called = 0;
  const input: any = {
    accepted,
    currentEmotion: accepted.proposal.appraisal.state,
    currentBody: preActivation,
  };
  Object.defineProperty(input, 'currentFrame', {
    enumerable: true,
    get() {
      called += 1;
      return {
        ...accepted.expectedFrame,
        snapshotId: 'hostile-frame',
        worldRevision: accepted.afterWorldRevision,
        time: { tick: due, sequence: 0 },
      };
    },
  });

  assert.throws(() => adoptRunnerControlAtTick(input));
  assert.equal(called, 0);
});

it('does not invoke a hostile currentPhysical getter during fielding adoption', () => {
  const original = fixture('THROW');
  const proposal = value(prepareFieldingExecution(original));
  const accepted = value(acceptFieldingExecution(original, proposal));
  assert.ok(accepted.proposal.plan?.kind === 'THROW');
  assert.ok(accepted.proposal.request.source.kind === 'THROW');
  const plan = accepted.proposal.plan;
  const source = accepted.proposal.request.source;
  const due = plan.launch.releaseTick;
  let called = 0;
  const input: any = {
    accepted,
    currentFrame: {
      ...accepted.expectedFrame,
      snapshotId: 'runtime-throw',
      worldRevision: accepted.afterWorldRevision,
      time: { tick: due, sequence: 0 },
    },
    currentEmotion: accepted.proposal.request.currentEmotion,
  };
  Object.defineProperty(input, 'currentPhysical', {
    enumerable: true,
    get() {
      called += 1;
      return {
        kind: 'THROW',
        tick: due,
        ballId: source.ballId,
        holderId: source.holderId,
        origin: plan.launch.origin,
        holderVelocity: source.holderVelocity,
      };
    },
  });

  assert.throws(() => adoptFieldingActionAtTick(input));
  assert.equal(called, 0);
});
