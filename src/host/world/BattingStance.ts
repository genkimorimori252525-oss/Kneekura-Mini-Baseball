import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattingSource } from '../../core/world/psychology/batting/BattingTypes';
import { bodySourceId as id, bodySourceDay as tick, bodySourceFields as fields, validBodySourceRef,
  type BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedBattingStanceV1 = BodySourceRef & Readonly<{
  careerId: string; playerId: string; personId: string; personLinkSourceId: string; acceptedAtDay: number;
  gameId: string; fixtureEventId: string; playId: number; physicalActorSourceId: string;
  modelRef: BodySourceRef; initialWorldSourceId: string; startedAtTick: number; ticksPerSecond: number;
  handedness: BattingSource['handedness']; centerOfMass: BattingSource['centerOfMass']; eyePosition: BattingSource['centerOfMass'];
  bodyReadyTick: number; latestMotorStartTick: number; validUntilTick: number;
  plateZ: number; strikeZone: BattingSource['strikeZone'];
}>;
export type DurableBattingStanceV1 = Readonly<{
  source: AcceptedBattingStanceV1; model: DurablePlayerBattingModelV1; actor: DurablePhysicalPlateAppearanceActor;
  physicalState: Readonly<{ startTick: number; centerOfMass: BattingSource['centerOfMass']; eyePosition: BattingSource['centerOfMass'] }>;
}>;
export type BattingStanceAuthority = Readonly<{ readAcceptedStance(sourceId: string): AcceptedBattingStanceV1 | null }>;
export type BattingStanceStore = Readonly<{
  accept(sourceId: string): DurableBattingStanceV1;
  read(sourceId: string): DurableBattingStanceV1 | null;
  close(): void;
}>;

/** Explicit inert physical preparation inputs; no pose, eye location or readiness default is inferred. */
export const battingStanceSourceInput = (raw: AcceptedBattingStanceV1, sourceId: string): AcceptedBattingStanceV1 => {
  const source = cloneInert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'careerId', 'playerId', 'personId', 'personLinkSourceId', 'acceptedAtDay',
    'gameId', 'fixtureEventId', 'playId', 'physicalActorSourceId', 'modelRef', 'initialWorldSourceId', 'startedAtTick',
    'ticksPerSecond', 'handedness', 'centerOfMass', 'eyePosition', 'bodyReadyTick', 'latestMotorStartTick', 'validUntilTick', 'plateZ', 'strikeZone'])
    || source.sourceId !== sourceId || ![source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personId,
      source.personLinkSourceId, source.gameId, source.fixtureEventId, source.physicalActorSourceId, source.initialWorldSourceId].every(id)
    || !validBodySourceRef(source.modelRef) || ![source.acceptedAtDay, source.playId, source.startedAtTick, source.bodyReadyTick,
      source.latestMotorStartTick, source.validUntilTick].every(tick)
    || !Number.isSafeInteger(source.ticksPerSecond) || source.ticksPerSecond <= 0 || !['R', 'L'].includes(source.handedness)
    || source.bodyReadyTick < source.startedAtTick || source.latestMotorStartTick < source.bodyReadyTick
    || source.validUntilTick < source.latestMotorStartTick || !Number.isFinite(source.plateZ)) {
    throw new Error('invalid accepted batting stance Source');
  }
  for (const vector of [source.centerOfMass, source.eyePosition]) {
    if (!fields(vector, ['x', 'y', 'z']) || ![vector.x, vector.y, vector.z].every(Number.isFinite)) {
      throw new Error('invalid explicit accepted batting stance position');
    }
  }
  const zone = source.strikeZone;
  if (!fields(zone, ['centerX', 'halfWidth', 'lowerY', 'upperY']) || !Object.values(zone).every(Number.isFinite)
    || zone.halfWidth <= 0 || zone.upperY <= zone.lowerY) throw new Error('invalid accepted batting stance strike zone');
  return source;
};
