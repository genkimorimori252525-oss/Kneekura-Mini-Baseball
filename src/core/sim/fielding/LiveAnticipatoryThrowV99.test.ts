import { expect, it } from 'vitest';
import { buildAverageFieldCaseV95 } from '../../../integration/browser/LiveFieldAverageHarnessV95';
import { simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
it('actually releases before a distant cover receiver arrives and earns an out only from actual custody and base contact', () => {
  const { input } = buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 9901, bats: 'R', parkRadiusMeters: 110 });
  // Isolate home-plate anticipation from a valid competing 3-2 double-play
  // route. Separate integration regressions cover zero-out 4-6-3 selection.
  const result = simulateLiveFieldPlayV1({ ...input, outs: 2, maxPlaySeconds: 35,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, .06, 60), velocity: v(0, -.1, 1), spin: v() } },
    fielders: input.fielders.map(f => ({ ...f, reactionSeconds: .01, transferSeconds: .1,
      fieldRelationshipsV99: [{ toPlayerId: 'def-C', trust: 100, coordination: 100 }],
      ...(f.defensivePosition === 'CF' ? { position: v(0, 1, 60), throwSpeedMps: 38 } : {}),
      ...(f.defensivePosition === 'C' ? { position: v(6, 1, 0), topSpeedMps: 4, accelerationMps2: 4 } : {}) })),
    runners: [{ ...input.runners[0], topSpeedMps: 8 }, ...([1, 2, 3] as const).map(initialBase => ({
      runnerId: 'runner-' + initialBase, initialBase, topSpeedMps: initialBase === 3 ? 2.5 : 8, accelerationMps2: 5, reactionSeconds: .1 }))] });
  expect(result.end.complete).toBe(true); expect(result.diagnostics.unresolvedDetail).toBeNull();
  const release = result.facts.find(f => f.kind === 'throw_release' && f.receiverPlayerId === 'def-C');
  expect(release, JSON.stringify({ throws: result.facts.filter(f => f.kind === 'throw_release'), secure: result.facts.filter(f => f.kind === 'catch_secured'),
    plans: result.diagnostics.aiTelemetry.relayPlans.slice(0, 3), decisions: result.diagnostics.throwDecisions.slice(0, 3) })).toBeDefined();
  const frame = [...result.frames].reverse().find(f => f.elapsedSeconds <= release!.elapsedSeconds)!;
  const receiver = frame.fielders.find(f => f.playerId === release!.receiverPlayerId)!;
  expect(Math.hypot(receiver.position.x, receiver.position.z), JSON.stringify({release, timing:result.diagnostics.aiTelemetry.receiveTimingV99.slice(0, 8),prep:result.diagnostics.handPreparationProofs.slice(0,2)})).toBeGreaterThan(3);
  const secure = result.facts.find(f => f.kind === 'catch_secured' && f.playerId === 'def-C');
  expect(secure!.tick).toBeGreaterThan(release!.tick);
  expect(result.ruleFacts.controlledBaseContacts.find(f => f.defenderId === 'def-C' && f.base === 4)!.tick).toBeGreaterThanOrEqual(secure!.tick);
});
it('does not throw ahead to second when the batter is only running through first', () => {
  const { input } = buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 9901, bats: 'R', parkRadiusMeters: 110 });
  const result = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: 30,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(-43, .06, 72), velocity: v(0, -.1, 1), spin: v() } },
    runners: input.runners.map(r => ({ ...r, topSpeedMps: 8, accelerationMps2: 5 })) });
  expect(result.end.complete).toBe(true);
  expect(result.facts.filter(f => f.kind === 'throw_release').some(f => f.base! > 1)).toBe(false);
});
