import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import { resolveBaseballGroundImpact, type BaseballGroundParameters } from '../ball/BaseballGroundDynamics';

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const finite = (p: Vec3) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('grounded actor contact: ' + message); }

/** Simultaneous ground/actor normal complementarity, following the existing
 * actor material response and one Coulomb-limited ground response. Additional
 * normal impulses pass through the ball center and add no angular impulse.
 * Previously computed tangential friction/spin are retained, never reapplied.
 * This is an explicit reduced rigid-contact law, not a learned glove model. */
export function resolveGroundedActorContactResponseV1(raw: Readonly<{
  incoming: BattedBallInitialState; actorResponse: BattedBallInitialState;
  normal: Vec3; surfaceVelocity: Vec3; actorRestitution: number; ground: BaseballGroundParameters;
}>) {
  const input = cloneInert(raw);
  const { incoming, actorResponse, ground, surfaceVelocity } = input, length = Math.sqrt(dot(input.normal, input.normal));
  assert([incoming?.position, incoming?.velocity, incoming?.spin, actorResponse?.position, actorResponse?.velocity,
    actorResponse?.spin, input.normal, surfaceVelocity].every(finite) && Number.isFinite(length) && length > 0
    && Number.isSafeInteger(incoming.tick) && incoming.tick >= 0 && actorResponse.tick === incoming.tick
    && ['x', 'y', 'z'].every(axis => incoming.position[axis as keyof Vec3] === actorResponse.position[axis as keyof Vec3])
    && incoming.position.y === ground.radiusM && Number.isFinite(input.actorRestitution)
    && input.actorRestitution >= 0 && input.actorRestitution <= 1, 'actual same-position floor/actor contact required');
  const normal = { x: input.normal.x / length, y: input.normal.y / length, z: input.normal.z / length };
  const nominal = actorResponse.velocity.y < 0 ? resolveBaseballGroundImpact(actorResponse, ground) : actorResponse;
  const actorTarget = Math.max(0, -input.actorRestitution * Math.min(0, dot(sub(incoming.velocity, surfaceVelocity), normal))),
    groundTarget = Math.max(0, -ground.material.restitution * Math.min(0, incoming.velocity.y)),
    actorNominal = dot(sub(nominal.velocity, surfaceVelocity), normal),
    actorDeficit = actorTarget - actorNominal, groundDeficit = groundTarget - nominal.velocity.y;
  let actorImpulsePerMass = 0, groundImpulsePerMass = 0, activeSet: 'none' | 'actor' | 'ground' | 'both' = 'none';
  let velocity = nominal.velocity;
  if (actorDeficit > 0 || groundDeficit > 0) {
    const actorOnly = Math.max(0, actorDeficit), groundOnly = Math.max(0, groundDeficit);
    if (nominal.velocity.y + actorOnly * normal.y >= groundTarget) {
      activeSet = 'actor'; actorImpulsePerMass = actorOnly;
      velocity = { x: nominal.velocity.x + actorOnly * normal.x, y: nominal.velocity.y + actorOnly * normal.y,
        z: nominal.velocity.z + actorOnly * normal.z };
    } else if (actorNominal + groundOnly * normal.y >= actorTarget) {
      activeSet = 'ground'; groundImpulsePerMass = groundOnly;
      velocity = { ...nominal.velocity, y: groundTarget };
    } else {
      const horizontalSquared = normal.x * normal.x + normal.z * normal.z;
      assert(horizontalSquared > 0, 'opposed parallel contact normals have no admissible impulse');
      // y is the active ground equality, rather than a rounded cancellation of
      // two large impulses. No position, clock or collision plane is moved.
      actorImpulsePerMass = (actorTarget - normal.x * (nominal.velocity.x - surfaceVelocity.x)
        - normal.z * (nominal.velocity.z - surfaceVelocity.z) - normal.y * (groundTarget - surfaceVelocity.y)) / horizontalSquared;
      groundImpulsePerMass = groundTarget - nominal.velocity.y - actorImpulsePerMass * normal.y;
      assert(actorImpulsePerMass >= 0 && groundImpulsePerMass >= 0, 'contact active-set impulses are tensile');
      activeSet = 'both'; velocity = { x: nominal.velocity.x + actorImpulsePerMass * normal.x,
        y: groundTarget, z: nominal.velocity.z + actorImpulsePerMass * normal.z };
    }
  }
  const actorNormalSpeed = dot(sub(velocity, surfaceVelocity), normal), groundNormalSpeed = velocity.y;
  assert(finite(velocity) && [actorImpulsePerMass, groundImpulsePerMass].every(Number.isFinite)
    && actorNormalSpeed >= 0 && groundNormalSpeed >= 0, 'no finite nonclosing two-contact response');
  return freeze({ ball: { ...nominal, velocity }, proof: {
    basis: 'EXPLICIT_TWO_CONTACT_NORMAL_ACTIVE_SET_V1' as const, activeSet, normal,
    actorImpulsePerMass, groundImpulsePerMass, actorTarget, groundTarget, actorNormalSpeed, groundNormalSpeed,
    groundMaterialResponseApplied: actorResponse.velocity.y < 0, retainedMaterialSpin: nominal.spin,
    sameClockAndPosition: true as const,
  } });
}
