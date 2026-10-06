import { expect } from 'vitest';
import type { PlayerPhysicalProfile } from '../../core/model/PlayerPhysicalProfile';
import type { DefenderPhysicalReachBaseline, DefenderPhysicalReachCalibration } from '../../core/sim/fielding/DefenderPhysicalProfileCalibration';
import * as runtime from './PlayerMaterializationRuntime';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import type { AcceptedBattedWorldModel } from './SqliteBattedWorldContactStore';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerReleaseGeometryStore, type AcceptedReleaseGeometryBaseline, type PlayerReleaseGeometrySnapshot } from './SqlitePlayerReleaseGeometryStore';

// Proposed contract types are test-only until coordinator-observed RED.
export type BodySourceRef = Readonly<{ sourceId: string; sourceVersion: string }>;
type PersonScope = Readonly<{
  careerId: string; playerId: string; personId: string; personLinkSourceId: string;
}>;
export type AcceptedBodySource = BodySourceRef & PersonScope & Readonly<{
  acceptedAtDay: number; physicalProfile: PlayerPhysicalProfile; displayLabel?: string;
}>;
export type AcceptedPoseSource = BodySourceRef & PersonScope & Readonly<{
  acceptedAtDay: number; bodyRef: BodySourceRef;
  primitives: AcceptedBattedWorldModel['actors'][number]['primitives'];
}>;
export type AcceptedReachSource = BodySourceRef & Readonly<{
  acceptedAtDay: number; baseline: DefenderPhysicalReachBaseline;
}>;
export type BodyMaterializationRequest = BodySourceRef & PersonScope & Readonly<{
  atDay: number; role: 'defender' | 'pitcher' | 'batter' | 'runner';
  bodyRef: BodySourceRef | null; poseRef: BodySourceRef | null;
  reachCalibrationRef: BodySourceRef | null; fieldingModelRef: BodySourceRef | null;
  releaseGeometryRef: (BodySourceRef & Readonly<{ effectiveDay: number }>) | null;
}>;
export type BodyMaterializationReceipt = Readonly<{
  source: BodyMaterializationRequest; person: DurablePlayerPersonLink;
  body: AcceptedBodySource; pose: AcceptedPoseSource; reachCalibration: AcceptedReachSource;
  fieldingModel: DurablePlayerFieldingModel | null;
  releaseGeometry: PlayerReleaseGeometrySnapshot | null;
  actor: AcceptedBattedWorldModel['actors'][number]; reach: DefenderPhysicalReachCalibration;
}>;
export type BodyMaterializationResult = Readonly<{ kind: 'materialized'; value: BodyMaterializationReceipt }>
  | Readonly<{ kind: 'pending'; missing: readonly ('body' | 'pose' | 'reachCalibration' | 'fieldingModel' | 'releaseGeometry')[] }>;
export type MaterializedBattedWorldModel = AcceptedBattedWorldModel & Readonly<{
  kind: 'body_materialized_batted_model_v1'; materializationSourceId: string;
}>;
export type BattedBodyModelAssembly = Omit<AcceptedBattedWorldModel, 'actors' | 'kind' | 'materializationSourceId'> & Readonly<{
  kind: 'body_materialized_batted_model_v1';
  atDay: number;
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
  accept(sourceId: string): BodyMaterializationResult;
  read(sourceId: string): BodyMaterializationReceipt | null;
  acceptModel(sourceId: string): MaterializedBattedWorldModel;
  readAcceptedModel(sourceId: string): MaterializedBattedWorldModel | null;
  close(): void;
}>;
type OpenMaterialization = (path: string, authority?: BodyMaterializationAuthority) => BodyMaterializationStore;

// Do not manufacture an implementation or an import-resolution failure for RED.
export const bodyMaterializationOpener = (): OpenMaterialization => {
  const candidate = (runtime as unknown as { openSqlitePlayerBodyCapabilityMaterializationStore?: OpenMaterialization })
    .openSqlitePlayerBodyCapabilityMaterializationStore;
  expect(typeof candidate, 'the existing Person runtime must expose the body/capability composition owner').toBe('function');
  return candidate!;
};
export const ref = (source: BodySourceRef): BodySourceRef => ({ sourceId: source.sourceId, sourceVersion: source.sourceVersion });

export const bodyMaterializationFixture = () => {
  const open = bodyMaterializationOpener();
  const f = playerFieldingModelFixture();
  const fielding = f.models.accept(f.source.sourceId);
  const scope: PersonScope = { careerId: f.person.careerId, playerId: f.person.playerId,
    personId: f.person.personId, personLinkSourceId: f.person.sourceId };
  const body: AcceptedBodySource = { sourceId: 'body-a', sourceVersion: 'measurements-v1', ...scope,
    acceptedAtDay: 10, physicalProfile: { heightMeters: 1.8 }, displayLabel: 'reference player' };
  // Explicit fixture measurements only. The production adapter must never create defaults from these.
  const pose: AcceptedPoseSource = { sourceId: 'pose-a', sourceVersion: 'pose-measurements-v1', ...scope,
    acceptedAtDay: 10, bodyRef: ref(body), primitives: [
      { role: 'body', radius: 0.2, offset: { x: 0, y: 0, z: 0 } },
      { role: 'glove', radius: 0.08, offset: { x: 0.3, y: 0.15, z: 0.1 } },
      { role: 'tag_hand', radius: 0.06, offset: { x: -0.3, y: 0.1, z: 0.1 } },
      { role: 'left_foot', radius: 0.07, offset: { x: -0.1, y: -0.88, z: 0 } },
      { role: 'right_foot', radius: 0.07, offset: { x: 0.1, y: -0.88, z: 0 } },
    ] };
  const calibration: AcceptedReachSource = { sourceId: 'reach-calibration-a', sourceVersion: 'explicit-reach-v1', acceptedAtDay: 0,
    baseline: { bodyOriginHeightMeters: 0.95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
  const request: BodyMaterializationRequest = { sourceId: 'materialization-a', sourceVersion: 'body-composition-v1', ...scope,
    atDay: 20, role: 'defender', bodyRef: ref(body), poseRef: ref(pose), reachCalibrationRef: ref(calibration),
    fieldingModelRef: ref(fielding.source), releaseGeometryRef: null };
  const bodies = new Map([[body.sourceId, body]]), poses = new Map([[pose.sourceId, pose]]);
  const calibrations = new Map([[calibration.sourceId, calibration]]), requests = new Map([[request.sourceId, request]]);
  const authority: BodyMaterializationAuthority = {
    readAcceptedMaterialization: (id) => requests.get(id) ?? null,
    readAcceptedBody: (id) => bodies.get(id) ?? null,
    readAcceptedPose: (id) => poses.get(id) ?? null,
    readAcceptedReachCalibration: (id) => calibrations.get(id) ?? null,
  };
  const materializations = f.track(open(f.path, authority));
  return { ...f, open, fielding, body, pose, calibration, request, bodies, poses, calibrations, requests, authority, materializations };
};
export type BodyFixture = ReturnType<typeof bodyMaterializationFixture>;
export const materialized = (f: BodyFixture, sourceId = f.request.sourceId): BodyMaterializationReceipt => {
  const result = f.materializations.accept(sourceId);
  expect(result.kind).toBe('materialized');
  if (result.kind !== 'materialized') throw new Error('expected complete accepted body inputs');
  return result.value;
};
export const materializationCount = (f: BodyFixture) => f.db.prepare('SELECT count(*) AS n FROM world_player_body_materializations').get();

export const installPitcherRelease = (f: BodyFixture, heightMeters = 1.8, changeEffectiveDay = 30) => {
  const baseline: AcceptedReleaseGeometryBaseline = { sourceId: 'release-a', sourceVersion: 'release-v1',
    careerId: f.person.careerId, playerId: f.person.playerId, personLinkSourceId: f.person.sourceId, acceptedAtDay: 10,
    body: { heightMeters, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' },
    profile: { armSlotClass: 'OVERHAND', releaseHeightTier: 'HIGH', releaseHeightRatio: 0.9, releaseLateralRatio: 0.1,
      releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const change = { sourceId: 'release-later', sourceVersion: 'release-v2', careerId: baseline.careerId, playerId: baseline.playerId,
    causeEventId: 'accepted-body-change', causeKind: 'BODY_CHANGE' as const, effectiveDay: changeEffectiveDay,
    body: { ...baseline.body, heightMeters: 1.98 }, profile: baseline.profile };
  const release = f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links, {
    readAcceptedBaseline: (id) => id === baseline.sourceId ? baseline : null,
    readAcceptedChange: (id) => id === change.sourceId ? change : null,
  }));
  release.initialize(baseline.sourceId);
  f.requests.set(f.request.sourceId, { ...f.request, role: 'pitcher',
    releaseGeometryRef: { ...ref(baseline), effectiveDay: baseline.acceptedAtDay } });
  return { release, baseline, change };
};
