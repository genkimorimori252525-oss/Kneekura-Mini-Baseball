import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BattedWorldSurface } from '../../core/sim/ball/BattedBallWorldContacts';
import type { DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';

export type BattedWorldActorShape = Readonly<{ role: DefenderPhysicalPrimitiveRole; radius: number; offset: Vec3 }>;
type ModelGeometry = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; careerId: string; fixtureEventId: string; venueId: string; availableAtDay: number;
  actors: readonly Readonly<{ playerId: string; personId: string; heightMeters: number; bodyOriginHeightMeters: number; primitives: readonly BattedWorldActorShape[] }>[];
  batterGripOffset: Vec3; surfaces: readonly BattedWorldSurface[];
}>;
/** sourceVersion remains opaque; only these additive fields opt into materialization ownership. */
export type AcceptedBattedWorldModel = ModelGeometry & (Readonly<{ kind?: never; materializationSourceId?: never }>
  | Readonly<{ kind: 'body_materialized_batted_model_v1'; materializationSourceId: string }>);
export type MaterializedBattedWorldModel = Extract<AcceptedBattedWorldModel, { kind: 'body_materialized_batted_model_v1' }>;
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: Vec3): boolean => fields(v, ['x', 'y', 'z']) && [v.x, v.y, v.z].every(finite);
export const validBattedWorldActorPrimitives = (p: readonly BattedWorldActorShape[]): boolean =>
  Array.isArray(p) && p.length === roles.length && new Set(p.map(v => v?.role)).size === roles.length
  && p.every(v => roles.includes(v?.role) && fields(v, ['role', 'radius', 'offset'])
    && finite(v.radius) && v.radius > 0 && vector(v.offset));

/** The existing geometry boundary, shared by composition and its physical consumer. */
export const acceptedBattedWorldModelInput = (raw: AcceptedBattedWorldModel, sourceId: string): AcceptedBattedWorldModel => {
  const m = cloneInert(raw), tagged = m !== null && typeof m === 'object' && 'kind' in m;
  if (!fields(m, ['sourceId', 'sourceVersion', 'gameId', 'careerId', 'fixtureEventId', 'venueId', 'availableAtDay', 'actors', 'batterGripOffset', 'surfaces',
      ...(tagged ? ['kind', 'materializationSourceId'] : [])])
    || tagged && (m.kind !== 'body_materialized_batted_model_v1' || m.materializationSourceId !== sourceId)
    || m.sourceId !== sourceId || ![sourceId, m.sourceVersion, m.gameId, m.careerId, m.fixtureEventId, m.venueId].every(id)
    || !integer(m.availableAtDay) || !vector(m.batterGripOffset) || !Array.isArray(m.actors) || m.actors.length < 10
    || new Set(m.actors.map(a => a?.playerId)).size !== m.actors.length || new Set(m.actors.map(a => a?.personId)).size !== m.actors.length
    || m.actors.some(a => !fields(a, ['playerId', 'personId', 'heightMeters', 'bodyOriginHeightMeters', 'primitives'])
      || !id(a.playerId) || !id(a.personId) || !finite(a.heightMeters) || a.heightMeters <= 0
      || !finite(a.bodyOriginHeightMeters) || a.bodyOriginHeightMeters < 0 || a.bodyOriginHeightMeters > a.heightMeters
      || !validBattedWorldActorPrimitives(a.primitives))
    || !Array.isArray(m.surfaces) || m.surfaces.some(s => !fields(s, ['surfaceId', 'start', 'end', 'minimumHeight', 'maximumHeight'])
      || !fields(s.start, ['x', 'z']) || !fields(s.end, ['x', 'z']))) throw new Error('invalid accepted batted World model');
  return m;
};
