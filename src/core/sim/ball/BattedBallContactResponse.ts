import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import { resolveCatchRetention, type CatchRetentionParameters, type CatchRetentionResolution } from '../fielding/CatchRetention';
import { respondToBallContact, type BallContactMaterial } from './BallContactResponse';
import type { BallFlightParameters } from './BallFlight';
import { deriveFirstBattedWorldContactGeometry, type BattedWorldContactGeometry, type BattedWorldContactInput,
  type BattedWorldContactResult } from './BattedBallWorldContacts';

export type BattedActorResponseProfile = Readonly<{
  role: Exclude<DefenderPhysicalPrimitiveRole, 'glove'>; material: BallContactMaterial;
}> | Readonly<{
  role: 'glove'; pocketCenterOffset: Vec3; bodyStability: number; parameters: CatchRetentionParameters;
}>;
export type BattedBallContactResponseInput = Readonly<{
  world: BattedWorldContactInput;
  actors: readonly Readonly<{ playerId: string; profile: BattedActorResponseProfile }>[];
  surfaces: readonly Readonly<{ surfaceId: string; material: BallContactMaterial }>[];
}>;
export type BattedBallContactResponse = Readonly<{ kind: 'airborne' | 'ground'; world: BattedWorldContactResult; ball: BattedBallInitialState }>
  | Readonly<{ kind: 'unresolved'; reason: 'simultaneous' | 'degenerate_normal'; world: BattedWorldContactResult }>
  | Readonly<{ kind: 'rebound'; world: BattedWorldContactResult; geometry: BattedWorldContactGeometry;
    ball: BattedBallInitialState; retention?: CatchRetentionResolution }>
  | Readonly<{ kind: 'capture_candidate'; world: BattedWorldContactResult; geometry: BattedWorldContactGeometry; retention: CatchRetentionResolution }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const unit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
const positive = (v: number) => Number.isFinite(v) && v > 0;
const vector = (v: Vec3) => v && [v.x, v.y, v.z].every(Number.isFinite);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const materialValid = (m: BallContactMaterial) => m && [m.restitution, m.tangentialDamping, m.spinDamping].every(unit);

export const assertBattedActorResponseProfile = (p: BattedActorResponseProfile, parameters: BallFlightParameters): void => {
  if (!p || !['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'].includes(p.role)) throw new Error('invalid batted actor response role');
  if (p.role === 'glove') {
    const c = p.parameters;
    if (!vector(p.pocketCenterOffset) || !unit(p.bodyStability) || !c
      || c.ticksPerSecond !== parameters.ticksPerSecond || c.ballRadiusMeters !== parameters.ballRadius
      || ![c.ballMassKg, c.ballRadiusMeters, c.pocketRadiusMeters, c.centerRetentionCapacityJ, c.captureDissipationPowerW].every(positive)
      || ![c.failedContactRestitution, c.failedTangentialDamping, c.failedSpinDamping].every(unit)) throw new Error('invalid batted glove response profile');
  } else if (!materialValid(p.material)) throw new Error('invalid batted actor response material');
};

/** Complete explicit calibration is required even for colliders beyond the first physical contact. */
export const assertBattedResponseProfiles = (input: BattedBallContactResponseInput): void => {
  if (!input.world || !Array.isArray(input.world.actors) || !Array.isArray(input.world.surfaces)
    || !Array.isArray(input.actors) || !Array.isArray(input.surfaces)) throw new Error('invalid batted response profiles');
  const actorKeys = new Set<string>(), surfaceIds = new Set<string>();
  for (const a of input.actors) {
    const p = a?.profile, key = JSON.stringify([a?.playerId, p?.role]);
    if (!id(a?.playerId) || !p || actorKeys.has(key) || !input.world.actors.some((w) => w.playerId === a.playerId && w.primitive.role === p.role)) {
      throw new Error('batted response actor profile differs');
    }
    actorKeys.add(key);
    assertBattedActorResponseProfile(p, input.world.parameters);
  }
  for (const s of input.surfaces) {
    if (!id(s?.surfaceId) || surfaceIds.has(s.surfaceId) || !input.world.surfaces.some((w) => w.surfaceId === s.surfaceId)
      || !materialValid(s.material)) throw new Error('batted response surface profile differs');
    surfaceIds.add(s.surfaceId);
  }
  if (actorKeys.size !== input.world.actors.length || surfaceIds.size !== input.world.surfaces.length) throw new Error('incomplete batted response profiles');
};

/** Original geometry drives response. Capture candidates still need an uninterrupted World acquisition interval. */
export const deriveBattedBallContactResponse = (raw: BattedBallContactResponseInput): BattedBallContactResponse => {
  const input = cloneInert(raw); assertBattedResponseProfiles(input);
  const { world, geometry } = deriveFirstBattedWorldContactGeometry(input.world);
  if (world.kind === 'airborne') return freeze({ kind: 'airborne', world, ball: world.ball });
  if (world.contacts.length !== 1) return freeze({ kind: 'unresolved', reason: 'simultaneous', world });
  if (world.contacts[0].kind === 'ground') return freeze({ kind: 'ground', world, ball: world.ball });
  if (!geometry?.normal) return freeze({ kind: 'unresolved', reason: 'degenerate_normal', world });
  const c = geometry.contact;
  if (c.kind === 'actor') {
    const profile = input.actors.find((a) => a.playerId === c.playerId && a.profile.role === c.role)!.profile;
    if (profile.role === 'glove') {
      const pocket = { x: geometry.point.x + profile.pocketCenterOffset.x, y: geometry.point.y + profile.pocketCenterOffset.y,
        z: geometry.point.z + profile.pocketCenterOffset.z };
      const pocketOffsetMeters = Math.hypot(geometry.ball.position.x - pocket.x, geometry.ball.position.y - pocket.y, geometry.ball.position.z - pocket.z);
      const retention = resolveCatchRetention({ contactTick: geometry.ball.tick, ball: geometry.ball,
        glove: { tick: geometry.ball.tick, position: geometry.point, velocity: geometry.surfaceVelocity },
        contactNormal: geometry.normal, pocketOffsetMeters, bodyStability: profile.bodyStability }, profile.parameters);
      return retention.outcome.kind === 'secured' ? freeze({ kind: 'capture_candidate', world, geometry, retention })
        : freeze({ kind: 'rebound', world, geometry, retention, ball: retention.outcome.ball });
    }
    return freeze({ kind: 'rebound', world, geometry, ball: respondToBallContact({ ball: geometry.ball,
      normal: geometry.normal, surfaceVelocity: geometry.surfaceVelocity, material: profile.material }) });
  }
  const material = input.surfaces.find((s) => s.surfaceId === c.surfaceId)!.material;
  return freeze({ kind: 'rebound', world, geometry, ball: respondToBallContact({ ball: geometry.ball,
    normal: geometry.normal, surfaceVelocity: geometry.surfaceVelocity, material }) });
};
