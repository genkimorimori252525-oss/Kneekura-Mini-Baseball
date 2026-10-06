import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerPhysicalProfile, type PlayerPhysicalProfile } from '../../core/model/PlayerPhysicalProfile';
import type { DefenderPhysicalReachBaseline, DefenderPhysicalReachCalibration } from '../../core/sim/fielding/DefenderPhysicalProfileCalibration';
import { validBattedWorldActorPrimitives, type AcceptedBattedWorldModel, type MaterializedBattedWorldModel } from './BattedWorldModel';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';

export type BodySourceRef = Readonly<{ sourceId: string; sourceVersion: string }>;
export type BodyPersonScope = Readonly<{ careerId: string; playerId: string; personId: string; personLinkSourceId: string }>;
export type AcceptedBodySource = BodySourceRef & BodyPersonScope & Readonly<{
  acceptedAtDay: number; physicalProfile: PlayerPhysicalProfile; displayLabel?: string;
}>;
export type AcceptedPoseSource = BodySourceRef & BodyPersonScope & Readonly<{
  acceptedAtDay: number; bodyRef: BodySourceRef; primitives: AcceptedBattedWorldModel['actors'][number]['primitives'];
}>;
export type AcceptedReachSource = BodySourceRef & Readonly<{ acceptedAtDay: number; baseline: DefenderPhysicalReachBaseline }>;
export type BodyMaterializationRequest = BodySourceRef & BodyPersonScope & Readonly<{
  atDay: number; role: 'defender' | 'pitcher' | 'batter' | 'runner';
  bodyRef: BodySourceRef | null; poseRef: BodySourceRef | null; reachCalibrationRef: BodySourceRef | null;
  fieldingModelRef: BodySourceRef | null; releaseGeometryRef: (BodySourceRef & Readonly<{ effectiveDay: number }>) | null;
}>;
export type BodyMaterializationReceipt = Readonly<{
  source: BodyMaterializationRequest; person: DurablePlayerPersonLink;
  body: AcceptedBodySource; pose: AcceptedPoseSource; reachCalibration: AcceptedReachSource;
  fieldingModel: DurablePlayerFieldingModel | null; releaseGeometry: PlayerReleaseGeometrySnapshot | null;
  actor: AcceptedBattedWorldModel['actors'][number]; reach: DefenderPhysicalReachCalibration;
}>;
export type BodyMaterializationResult = Readonly<{ kind: 'materialized'; value: BodyMaterializationReceipt }>
  | Readonly<{ kind: 'pending'; missing: readonly ('body' | 'pose' | 'reachCalibration' | 'fieldingModel' | 'releaseGeometry')[] }>;
export type BattedBodyModelAssembly = Omit<AcceptedBattedWorldModel, 'actors' | 'kind' | 'materializationSourceId'> & Readonly<{
  kind: 'body_materialized_batted_model_v1'; atDay: number;
  actors: readonly Readonly<{ playerId: string; personId: string; materializationRef: BodySourceRef }>[];
}>;
export type BodyMaterializationAuthority = Readonly<{
  readAcceptedMaterialization(sourceId: string): BodyMaterializationRequest | null;
  readAcceptedBody(sourceId: string): AcceptedBodySource | null;
  readAcceptedPose(sourceId: string): AcceptedPoseSource | null;
  readAcceptedReachCalibration(sourceId: string): AcceptedReachSource | null;
  readAcceptedModelAssembly?(sourceId: string): BattedBodyModelAssembly | null;
}>;
export type BodyMaterializationStore = Readonly<{
  accept(sourceId: string): BodyMaterializationResult; read(sourceId: string): BodyMaterializationReceipt | null;
  acceptModel(sourceId: string): MaterializedBattedWorldModel; readAcceptedModel(sourceId: string): MaterializedBattedWorldModel | null;
  close(): void;
}>;
export const bodySourceId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
export const bodySourceDay = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export const bodySourceFields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
export const validBodySourceRef = (v: BodySourceRef | null): v is BodySourceRef =>
  bodySourceFields(v, ['sourceId', 'sourceVersion']) && bodySourceId(v?.sourceId) && bodySourceId(v?.sourceVersion);
const scope = ['careerId', 'playerId', 'personId', 'personLinkSourceId'] as const;
const scopeMatches = (v: BodyPersonScope, s: BodyPersonScope) => scope.every(key => v[key] === s[key]);
const sourceMatches = (v: BodySourceRef, pin: BodySourceRef) => v.sourceId === pin.sourceId && v.sourceVersion === pin.sourceVersion;
export const bodyMaterializationSourceInput = (raw: BodyMaterializationRequest, sourceId: string): BodyMaterializationRequest => {
  const s = cloneInert(raw);
  if (!bodySourceFields(s, ['sourceId', 'sourceVersion', ...scope, 'atDay', 'role', 'bodyRef', 'poseRef', 'reachCalibrationRef', 'fieldingModelRef', 'releaseGeometryRef'])
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, ...scope.map(key => s[key])].every(bodySourceId) || !bodySourceDay(s.atDay)
    || !['defender', 'pitcher', 'batter', 'runner'].includes(s.role)
    || [s.bodyRef, s.poseRef, s.reachCalibrationRef, s.fieldingModelRef].some(pin => pin !== null && !validBodySourceRef(pin))
    || s.releaseGeometryRef !== null && (!bodySourceFields(s.releaseGeometryRef, ['sourceId', 'sourceVersion', 'effectiveDay'])
      || !bodySourceId(s.releaseGeometryRef.sourceId) || !bodySourceId(s.releaseGeometryRef.sourceVersion) || !bodySourceDay(s.releaseGeometryRef.effectiveDay))
    || ['batter', 'runner'].includes(s.role) && s.fieldingModelRef !== null
    || s.role !== 'pitcher' && s.releaseGeometryRef !== null) throw new Error('invalid accepted body materialization Source');
  return s;
};
const acceptedScope = (v: BodyPersonScope & BodySourceRef & { acceptedAtDay: number }, pin: BodySourceRef,
  s: BodyMaterializationRequest, person: DurablePlayerPersonLink) =>
  sourceMatches(v, pin) && scopeMatches(v, s) && bodySourceDay(v.acceptedAtDay)
    && v.acceptedAtDay >= person.acceptedAtDay && v.acceptedAtDay <= s.atDay;
export const acceptedBodyMaterializationInput = (raw: AcceptedBodySource, pin: BodySourceRef,
  s: BodyMaterializationRequest, person: DurablePlayerPersonLink): AcceptedBodySource => {
  const v = cloneInert(raw);
  if (!bodySourceFields(v, ['sourceId', 'sourceVersion', ...scope, 'acceptedAtDay', 'physicalProfile', ...('displayLabel' in v ? ['displayLabel'] : [])])
    || !acceptedScope(v, pin, s, person) || !bodySourceFields(v.physicalProfile, ['heightMeters'])
    || 'displayLabel' in v && typeof v.displayLabel !== 'string') throw new Error('invalid accepted body evidence');
  createPlayerPhysicalProfile(v.physicalProfile.heightMeters); return v;
};
export const acceptedPoseMaterializationInput = (raw: AcceptedPoseSource, pin: BodySourceRef,
  s: BodyMaterializationRequest, person: DurablePlayerPersonLink): AcceptedPoseSource => {
  const v = cloneInert(raw);
  if (!bodySourceFields(v, ['sourceId', 'sourceVersion', ...scope, 'acceptedAtDay', 'bodyRef', 'primitives'])
    || !acceptedScope(v, pin, s, person) || !validBodySourceRef(v.bodyRef)
    || s.bodyRef !== null && !sourceMatches(v.bodyRef, s.bodyRef) || !validBattedWorldActorPrimitives(v.primitives)) {
    throw new Error('invalid accepted pose evidence');
  }
  return v;
};
export const acceptedReachMaterializationInput = (raw: AcceptedReachSource, pin: BodySourceRef,
  s: BodyMaterializationRequest): AcceptedReachSource => {
  const v = cloneInert(raw);
  if (!bodySourceFields(v, ['sourceId', 'sourceVersion', 'acceptedAtDay', 'baseline']) || !sourceMatches(v, pin)
    || !bodySourceDay(v.acceptedAtDay) || v.acceptedAtDay > s.atDay
    || !bodySourceFields(v.baseline, ['bodyOriginHeightMeters', 'maximumLegReachMeters', 'maximumGloveReachMeters', 'maximumTagReachMeters'])
    || !Object.values(v.baseline).every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) {
    throw new Error('invalid accepted reach calibration');
  }
  return v;
};
