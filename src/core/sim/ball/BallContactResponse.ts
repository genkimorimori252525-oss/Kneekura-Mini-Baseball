import type { Vec3 } from '../../model/geometry';
import type { BattedBallInitialState } from '../contact/BatBallContact';

export type BallContactMaterial = Readonly<{ restitution: number; tangentialDamping: number; spinDamping: number }>;
export type BallContactResponseInput = Readonly<{
  ball: BattedBallInitialState; surfaceVelocity: Vec3; normal: Vec3; material: BallContactMaterial;
}>;
const finiteVector = (v: Vec3) => v && [v.x, v.y, v.z].every(Number.isFinite);
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });

/** A live ball's response to an actual contact; it makes no possession or baseball ruling. */
export const respondToBallContact = (input: BallContactResponseInput): BattedBallInitialState => {
  const { ball, surfaceVelocity, normal, material } = input;
  if (!ball || !Number.isSafeInteger(ball.tick) || ball.tick < 0 || !finiteVector(ball.position)
    || !finiteVector(ball.velocity) || !finiteVector(ball.spin) || !finiteVector(surfaceVelocity) || !finiteVector(normal)
    || !material || ![material.restitution, material.tangentialDamping, material.spinDamping]
      .every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('invalid ball contact response');
  const lengthSquared = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 0) throw new Error('contactNormal must have a finite non-zero length');
  const n = scale(normal, 1 / Math.sqrt(lengthSquared)), relative = subtract(ball.velocity, surfaceVelocity);
  const normalSpeed = relative.x * n.x + relative.y * n.y + relative.z * n.z;
  const normalVelocity = scale(n, normalSpeed), tangent = subtract(relative, normalVelocity);
  const postNormal = normalSpeed < 0 ? scale(n, -material.restitution * normalSpeed) : normalVelocity;
  const velocity = add(surfaceVelocity, add(postNormal, scale(tangent, 1 - material.tangentialDamping)));
  const spin = scale(ball.spin, 1 - material.spinDamping);
  if (!finiteVector(velocity) || !finiteVector(spin)) throw new Error('ball contact response arithmetic overflow');
  return { ...ball, velocity, spin };
};
