import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';

const fixture = (name: string): LiveFieldPlayInputV1 => JSON.parse(readFileSync('docs/verification/releases/v95-investigation/runners/' + name + '.raw.json', 'utf8')).input;

it('does not borrow a remote catcher arm for an otherwise identical center-field possession', () => {
  const input = fixture('cf-all-arms-8'), strongC = { ...input, fielders: input.fielders.map(f => ({ ...f, throwSpeedMps: f.defensivePosition === 'C' ? 40 : 8 })) },
    a = simulateLiveFieldPlayV1(input), b = simulateLiveFieldPlayV1(strongC);
  expect(a.facts.find(f => f.kind === 'catch_secured')).toEqual(b.facts.find(f => f.kind === 'catch_secured'));
  const first = (r: typeof a) => r.diagnostics.aiTelemetry.runnerDecisions.find(d => d.runnerId === 'runner-2' && d.targetBase === 3 && d.reason !== 'recognizing_departure_cue');
  expect(first(a)?.advance).toBe(first(b)?.advance);
  expect(first(a)?.defenderControlSeconds).toBeCloseTo(first(b)!.defenderControlSeconds!, 6);
}, 60000);

it('bases error-driven replanning on the individual runner observation, not the first batted cue', () => {
  const input = fixture('ss-overthrow'), result = simulateLiveFieldPlayV1(input);
  const telemetry = result.diagnostics.aiTelemetry as unknown as { runnerObservationsV95: { runnerId: string; elapsedSeconds: number; observedAtSeconds: number; reactionSeconds: number }[] };
  expect(telemetry.runnerObservationsV95?.length).toBeGreaterThan(0);
  for (const row of telemetry.runnerObservationsV95) expect(row.observedAtSeconds).toBeLessThanOrEqual(row.elapsedSeconds - row.reactionSeconds + 1e-10);
}, 60000);
