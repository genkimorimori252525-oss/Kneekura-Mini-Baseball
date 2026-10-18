import { expect, it } from 'vitest';
import { buildCanonicalFieldingPlayInputV1 } from './LiveFieldPlayDiagnosticsV1';
import { simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';

const fixture = (velocity: Readonly<{ x: number; y: number; z: number }>) => buildCanonicalFieldingPlayInputV1({
  id: 'physical-catch-window', category: 'outfield_fly', description: 'Shared catch-window motion regression',
  ballPosition: { x: 0, y: .9, z: .3 }, ballVelocity: velocity, ballSpin: { x: -130, y: -40, z: 0 },
  outs: 2, expectedMinOutsWithCompetentAI: 1,
}).input;

it('assigns the easier incoming outfield route when a high fly also permits a long infield chase', () => {
  const input = fixture({ x: -4, y: 28, z: 18 }), result = simulateLiveFieldPlayV1(input);
  expect(result.diagnostics.aiTelemetry.roleTransitions[0].handlerId).toBe('def-LF');
  expect(result.ruleFacts.flyCatch?.fielderId).toBe('def-LF');
  expect(result.ruleFacts.firstGroundContactTick).toBeNull();
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out' });
  for (const frame of result.frames)
    expect(frame.fielders.find(f => f.playerId === 'def-SS')!.intent).not.toBe('intercept');
});

it('allows an infielder to go back on a blooper that it can intercept before an outfielder', () => {
  const input = fixture({ x: -4, y: 15, z: 15 }), result = simulateLiveFieldPlayV1(input);
  expect(result.diagnostics.aiTelemetry.roleTransitions[0].handlerId).toBe('def-SS');
  expect(result.ruleFacts.flyCatch?.fielderId).toBe('def-SS');
  expect(result.ruleFacts.firstGroundContactTick).toBeNull();
  expect(result.end).toMatchObject({ complete: true, reason: 'third_out' });
});
