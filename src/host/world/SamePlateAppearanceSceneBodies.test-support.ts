import type { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { BodyMaterializationRequest, AcceptedBodySource, AcceptedPoseSource } from './PlayerBodyCapabilityMaterialization';

/** Nine additional explicit synthetic measurement declarations. Numerical body,
 * pose and reach values are the existing NativeBattingModelStanceFixtures values;
 * every new Person/body/model binding is accepted through its real Native owner.
 * No stance archive, physical World, generated default or genuine file is used. */
export const prepareSamePaSceneBodies = (f: ReturnType<typeof directNativeDispatchFixture>) => {
  const bodies = new Map<string, AcceptedBodySource>(), poses = new Map<string, AcceptedPoseSource>(), requests = new Map<string, BodyMaterializationRequest>();
  const parameters = f.actor.defenderBindings.map(binding => {
    const scope = { careerId: binding.careerId, playerId: binding.playerId, personId: binding.personId, personLinkSourceId: binding.personLinkSourceId };
    const body: AcceptedBodySource = { ...f.body, ...scope, sourceId: 'same-pa-scene-body:' + binding.playerId, sourceVersion: 'fixture-only-v1', acceptedAtDay: binding.gameDay };
    const pose: AcceptedPoseSource = { ...f.pose, ...scope, sourceId: 'same-pa-scene-pose:' + binding.playerId, sourceVersion: 'fixture-only-v1', acceptedAtDay: binding.gameDay,
      bodyRef: { sourceId: body.sourceId, sourceVersion: body.sourceVersion } };
    const model = playerFieldingModelEvidenceFromSqlite(f.db).read('native-fielding:' + binding.playerId);
    if (!model) throw new Error('shared Native scene fixture original fielding model missing');
    const pitcher = f.actor.world.defenders.find(d => d.playerId === binding.playerId)?.registeredPosition === 'P';
    const release = pitcher ? f.x.f.release.readHead(binding.careerId, binding.playerId)?.baseline : null;
    if (pitcher && !release) throw new Error('shared Native scene fixture original release missing');
    const request: BodyMaterializationRequest = { sourceId: 'same-pa-scene-materialization:' + binding.playerId, sourceVersion: 'fixture-only-v1', ...scope,
      atDay: binding.gameDay, role: pitcher ? 'pitcher' : 'defender', bodyRef: { sourceId: body.sourceId, sourceVersion: body.sourceVersion },
      poseRef: { sourceId: pose.sourceId, sourceVersion: pose.sourceVersion }, reachCalibrationRef: { sourceId: f.reach.sourceId, sourceVersion: f.reach.sourceVersion },
      fieldingModelRef: { sourceId: model.source.sourceId, sourceVersion: model.source.sourceVersion },
      releaseGeometryRef: release ? { sourceId: release.sourceId, sourceVersion: release.sourceVersion, effectiveDay: release.effectiveDay } : null };
    bodies.set(body.sourceId, body); poses.set(pose.sourceId, pose); requests.set(request.sourceId, request); return request;
  });
  const owner = f.x.f.track(openSqlitePlayerBodyCapabilityMaterializationStore(f.path, { readAcceptedMaterialization: id => requests.get(id) ?? null,
    readAcceptedBody: id => bodies.get(id) ?? null, readAcceptedPose: id => poses.get(id) ?? null, readAcceptedReachCalibration: id => id === f.reach.sourceId ? f.reach : null }));
  return parameters.map(source => {
    const result = owner.accept(source.sourceId); if (result.kind !== 'materialized') throw new Error('shared Native scene fixture materialization is pending');
    return { playerId: source.playerId, bodyReference: reference('world_player_body_materializations', result.value) };
  });
};
