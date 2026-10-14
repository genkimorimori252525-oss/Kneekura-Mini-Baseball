import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import type { BattedWorldActorPrimitive } from '../../core/sim/ball/BattedBallWorldContacts';
import type { BodyMaterializationReceipt } from './PlayerBodyCapabilityMaterialization';
import { validBattedWorldActorPrimitives } from './BattedWorldModel';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as id, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

/** Original issued input. Official occupancy supplies the root, never intention
 * or a finite future. No route or autonomous decision is manufactured for hold. */
export type AcceptedSamePaOccupiedRunnerHold = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_occupied_runner_hold_v1';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>; playerId: string; personId: string;
  bodyReference: SamePaReference<'world_player_body_materializations'>;
  runnerModelReference: SamePaReference<'world_player_runner_decision_motion_models'>;
  intent: Readonly<{ kind: 'hold'; issuedTick: number }>; coverageThroughTick: number;
  provenance: Readonly<{ sourceRecordId: string; sourceVersion: string }>;
}>;
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const samePaOccupiedRunnerHoldReferencesValid = (v: unknown): v is readonly SamePaReference<'world_same_pa_occupied_runner_holds'>[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every(r => ref(r, 'world_same_pa_occupied_runner_holds'))
  && new Set(v.map(r => r.sourceId)).size === v.length;
export const samePaOccupiedRunnerHoldInput = (raw: unknown, sourceId?: string): AcceptedSamePaOccupiedRunnerHold => {
  const s = cloneInert(raw) as AcceptedSamePaOccupiedRunnerHold;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'enrollmentReference', 'playerId', 'personId', 'bodyReference',
    'runnerModelReference', 'intent', 'coverageThroughTick', 'provenance']) || s.capability !== 'same_pa_occupied_runner_hold_v1'
    || ![s.sourceId, s.sourceVersion, s.playerId, s.personId].every(id) || sourceId !== undefined && s.sourceId !== sourceId
    || !ref(s.enrollmentReference, 'same_pa_enrollments') || !ref(s.bodyReference, 'world_player_body_materializations')
    || !ref(s.runnerModelReference, 'world_player_runner_decision_motion_models')
    || !fields(s.intent, ['kind', 'issuedTick']) || s.intent.kind !== 'hold' || !tick(s.intent.issuedTick)
    || !tick(s.coverageThroughTick) || s.coverageThroughTick <= s.intent.issuedTick
    || !fields(s.provenance, ['sourceRecordId', 'sourceVersion']) || !Object.values(s.provenance).every(id))
    throw new Error('invalid occupied runner original finite hold Source');
  return freeze(s);
};
export type SamePaOccupiedRunnerSetup = Readonly<{ playerId: string; personId: string; tick: number;
  position: Readonly<{ x: number; z: number }>; velocity: Readonly<{ x: number; z: number }> }>;
/** Pure composition only. Native authenticates setup/body/issued input before
 * calling this. The returned finite curves are planned coverage until executed. */
export const samePaOccupiedRunnerHoldCurves = (raw: AcceptedSamePaOccupiedRunnerHold, setup: SamePaOccupiedRunnerSetup,
  body: BodyMaterializationReceipt['actor'], ticksPerSecond: number): readonly BattedWorldActorPrimitive[] => {
  const s = samePaOccupiedRunnerHoldInput(raw);
  if (setup.playerId !== s.playerId || setup.personId !== s.personId || body.playerId !== s.playerId || body.personId !== s.personId
    || !tick(setup.tick) || setup.tick !== s.intent.issuedTick || ticksPerSecond !== 1_000_000
    || ![setup.position.x, setup.position.z, body.bodyOriginHeightMeters].every(Number.isFinite)
    || body.bodyOriginHeightMeters < 0 || setup.velocity.x !== 0 || setup.velocity.z !== 0 || !validBattedWorldActorPrimitives(body.primitives))
    throw new Error('occupied runner original setup, body or stationary issuance differs');
  const zero = { x: 0, y: 0, z: 0 }, interval = { startTick: setup.tick, endTick: s.coverageThroughTick, ticksPerSecond };
  const root = { ...interval, startPosition: { x: setup.position.x, y: body.bodyOriginHeightMeters, z: setup.position.z },
    startVelocity: zero, acceleration: zero };
  return freeze(body.primitives.map(p => ({ playerId: s.playerId, primitive: composeDefenderPhysicalPrimitiveSegment(root,
    { ...interval, role: p.role, radius: p.radius, startOffset: p.offset, offsetVelocity: zero, offsetAcceleration: zero }) })));
};
