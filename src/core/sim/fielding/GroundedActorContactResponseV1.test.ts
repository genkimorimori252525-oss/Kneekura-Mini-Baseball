import { expect, it } from 'vitest';
import { respondToBallContact } from '../ball/BallContactResponse';
import { resolveBaseballGroundImpact, type BaseballGroundParameters } from '../ball/BaseballGroundDynamics';
import { resolveGroundedActorContactResponseV1 } from './GroundedActorContactResponseV1';
const ground: BaseballGroundParameters = { ticksPerSecond: 1e6, radiusM: .0366, gravityMps2: 9.81,
  inertiaRatio: .378, restingVerticalSpeedMps: .15,
  material: { restitution: .48, slidingFriction: .3, rollingDecelerationMps2: .9, normalSpinDecayPerSecond: .5 } };
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const incoming = { tick: 12345, position: v(2, .0366, 10), velocity: v(20, 0, 0), spin: v(0, 30, -400) };
const material = { restitution: .2, tangentialDamping: .35, spinDamping: .2 };
it('solves both active normals when ground rebound would immediately re-enter the failed glove', () => {
  const normal = v(-.8, -.6, 0), surfaceVelocity = v(), actorResponse = respondToBallContact({ ball: incoming, normal, surfaceVelocity, material }),
    nominal = resolveBaseballGroundImpact(actorResponse, ground);
  expect(nominal.velocity.x * normal.x + nominal.velocity.y * normal.y).toBeLessThan(0);
  const result = resolveGroundedActorContactResponseV1({ incoming, actorResponse, normal, surfaceVelocity, actorRestitution: .2, ground });
  expect(result.proof.activeSet).toBe('both');
  expect(result.proof.actorNormalSpeed).toBeGreaterThan(0);
  expect(result.proof.groundNormalSpeed).toBe(0);
  expect(result.ball.position).toEqual(incoming.position); expect(result.ball.tick).toBe(incoming.tick);
  expect(result.ball.spin).toEqual(nominal.spin);
  expect(result.proof.actorImpulsePerMass).toBeGreaterThan(0); expect(result.proof.groundImpulsePerMass).toBeGreaterThan(0);
});
it('keeps an already admissible pair unchanged and publishes immutable proof values', () => {
  const normal = v(-1, 0, 0), surfaceVelocity = v(), actorResponse = respondToBallContact({ ball: incoming, normal, surfaceVelocity, material });
  const result = resolveGroundedActorContactResponseV1({ incoming, actorResponse, normal, surfaceVelocity, actorRestitution: .2, ground });
  expect(result.ball).toEqual(actorResponse); expect(result.proof.activeSet).toBe('none');
  expect(() => Object.assign(result.ball.velocity, { x: 99 })).toThrow();
});
it('refuses an opposed moving plane pressing the ball through the floor', () => {
  const normal = v(0, -1, 0), surfaceVelocity = v(0, -1, 0), actorResponse = respondToBallContact({ ball: incoming, normal, surfaceVelocity, material });
  expect(() => resolveGroundedActorContactResponseV1({ incoming, actorResponse, normal, surfaceVelocity, actorRestitution: .2, ground })).toThrow(/parallel|nonclosing/);
});
it('rejects an off-floor or changed-position response instead of relocating the ball', () => {
  const input = { incoming, actorResponse: incoming, normal: v(-1, 0, 0), surfaceVelocity: v(), actorRestitution: .2, ground };
  expect(() => resolveGroundedActorContactResponseV1({ ...input, incoming: { ...incoming, position: v(2, .04, 10) } })).toThrow(/actual/);
  expect(() => resolveGroundedActorContactResponseV1({ ...input, actorResponse: { ...incoming, tick: incoming.tick + 1 } })).toThrow(/actual/);
});
it('closes the recorded moving-glove/ground pair without changing its physical clock or position', () => {
  const normal = v(.4464133100792053, -.5021120481825584, -.7406744545709968),
    elapsed = 2.6197745067927425 - 2.5804556249965365,
    surfaceVelocity = v(7.013248513247392 - .8712147418313609 * elapsed, -.02256043464001369,
      -11.355936976174805 + 5.126498305238747 * elapsed),
    actual = { tick: 1015106908, position: v(-42.56542291653841, .0366, 70.97083744620451),
      velocity: v(-17.939878000965248, 0, 28.79511728386128), spin: v(602.7242274198672, -264.77374087597696, 374.5056978776512) },
    actorResponse = respondToBallContact({ ball: actual, normal, surfaceVelocity, material }),
    result = resolveGroundedActorContactResponseV1({ incoming: actual, actorResponse, normal, surfaceVelocity,
      actorRestitution: .2, ground: { ...ground, material: { ...ground.material, slidingFriction: .24 } } });
  expect(result.proof.activeSet).toBe('both'); expect(result.proof.actorNormalSpeed).toBeGreaterThan(0);
  expect(result.ball.velocity.y).toBe(0); expect(result.ball.position).toEqual(actual.position); expect(result.ball.tick).toBe(actual.tick);
  expect(Object.isFrozen(actual.position)).toBe(false);
});
