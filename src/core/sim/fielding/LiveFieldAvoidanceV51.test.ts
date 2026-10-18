import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import slowRoller from './__fixtures__/v51-low-slow_roller_3B.json';
import firstBase from './__fixtures__/v51-default-1B_routine.json';
import tagAtSecond from './__fixtures__/v51-default-fast_grounder_CF_wall.json';
import type { LiveFieldPlayInputV1, simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';

const cases = [
  ['low-slow_roller_3B', slowRoller],
  ['default-1B_routine', firstBase],
  ['default-fast_grounder_CF_wall', tagAtSecond],
] as const;
const norm = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

/** These are actual v50 inputs, not a desired-outcome script. Sampled spacing
 * is a regression check; it cannot certify the interval between frames. A
 * baseline replay can apply the identical assertions to preserved raw results
 * without silently loading a concurrently changing implementation. */
it.each(cases)('keeps fielders separated with continuous acceleration-limited movement: %s', async (name, raw) => {
  const input = raw as LiveFieldPlayInputV1;
  const result: ReturnType<typeof simulateLiveFieldPlayV1> = process.env.LIVE_FIELD_BASELINE_RESULTS_DIR
    ? JSON.parse(readFileSync(resolve(process.env.LIVE_FIELD_BASELINE_RESULTS_DIR, name + '.json'), 'utf8')).result
    : (await import('./LiveFieldPlayV1')).simulateLiveFieldPlayV1(input);
  let minimum = Infinity;
  for (const [index, frame] of result.frames.entries()) {
    for (let i = 0; i < frame.fielders.length; i++) {
      const actor = frame.fielders[i], spec = input.fielders.find(f => f.playerId === actor.playerId)!;
      expect(norm(actor.velocity), `${actor.playerId} speed at ${frame.elapsedSeconds}`).toBeLessThanOrEqual(spec.topSpeedMps + 1e-7);
      for (const other of frame.fielders.slice(i + 1))
        minimum = Math.min(minimum, Math.hypot(actor.position.x - other.position.x, actor.position.z - other.position.z));
      if (index === 0) {
        expect(actor.position).toEqual(spec.position);
        continue;
      }
      const previousFrame = result.frames[index - 1], previous = previousFrame.fielders.find(f => f.playerId === actor.playerId)!,
        dt = frame.elapsedSeconds - previousFrame.elapsedSeconds;
      if (dt === 0) { expect(actor.position).toEqual(previous.position); expect(actor.velocity).toEqual(previous.velocity); continue; }
      const dv = Math.hypot(actor.velocity.x - previous.velocity.x, actor.velocity.z - previous.velocity.z),
        displacementResidual = Math.hypot(actor.position.x - previous.position.x - previous.velocity.x * dt,
          actor.position.z - previous.position.z - previous.velocity.z * dt);
      expect(dv, `${actor.playerId} acceleration at ${frame.elapsedSeconds}`).toBeLessThanOrEqual(spec.accelerationMps2 * dt + 1e-7);
      expect(displacementResidual, `${actor.playerId} continuous motor at ${frame.elapsedSeconds}`)
        .toBeLessThanOrEqual(.5 * spec.accelerationMps2 * dt * dt + 1e-7);
    }
  }
  expect.soft(result.end.complete).toBe(true);
  expect.soft(minimum, 'observed body centers must not penetrate each other').toBeGreaterThanOrEqual(result.model.bodyRadiusMeters * 2);
});
