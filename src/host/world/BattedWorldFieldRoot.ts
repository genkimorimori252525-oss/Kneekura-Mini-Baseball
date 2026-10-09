import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import type { DurableBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';

export type BattedEpisodeFieldBindingOptIn = Readonly<{ version: 'batted_episode_field_binding_v1' | 'batted_episode_field_binding_v2'
  | 'batted_episode_field_binding_v3' | 'batted_episode_field_binding_v4'; sourceId: string }>;
export type BattedWorldFieldRoot = Readonly<{ response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }> &
  (Readonly<{ rootKind?: never; episodeFieldBinding?: never }>
    | Readonly<{ rootKind: 'episode_field_binding_v1'; episodeFieldBinding: DurableBattedEpisodeFieldBinding }>
    | Readonly<{ rootKind: 'episode_field_binding_v2'; episodeFieldBinding: DurableBattedEpisodeFieldBinding }>
    | Readonly<{ rootKind: 'episode_field_binding_v3'; episodeFieldBinding: DurableBattedEpisodeFieldBinding }>
    | Readonly<{ rootKind: 'episode_field_binding_v4'; episodeFieldBinding: DurableBattedEpisodeFieldBinding }>);
type Source = Readonly<{ responseSourceId: string; geometrySourceId: string; episodeFieldBinding?: BattedEpisodeFieldBindingOptIn; kind?: string }>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
export const battedWorldFieldSourceRootIdentity = (source: Source): string => {
  if (!('episodeFieldBinding' in source)) return 'legacy';
  const binding = source.episodeFieldBinding;
  if ('kind' in source || !binding || typeof binding !== 'object' || Array.isArray(binding)
    || Object.keys(binding).sort().join('|') !== 'sourceId|version'
    || binding.version !== 'batted_episode_field_binding_v1' && binding.version !== 'batted_episode_field_binding_v2'
      && binding.version !== 'batted_episode_field_binding_v3' && binding.version !== 'batted_episode_field_binding_v4'
    || !id(binding.sourceId)) throw new Error('invalid episode field binding opt-in');
  return json([binding.version === 'batted_episode_field_binding_v1' ? 'episode_field_binding_v1'
    : binding.version === 'batted_episode_field_binding_v2' ? 'episode_field_binding_v2'
      : binding.version === 'batted_episode_field_binding_v3' ? 'episode_field_binding_v3' : 'episode_field_binding_v4', binding.sourceId]);
};
export const battedWorldFieldRootIdentity = (root: BattedWorldFieldRoot): string => {
  if (!('rootKind' in root) && !('episodeFieldBinding' in root)) return 'legacy';
  const version = root.rootKind === 'episode_field_binding_v1' ? 'batted_episode_field_binding_v1'
    : root.rootKind === 'episode_field_binding_v2' ? 'batted_episode_field_binding_v2'
      : root.rootKind === 'episode_field_binding_v3' ? 'batted_episode_field_binding_v3'
        : root.rootKind === 'episode_field_binding_v4' ? 'batted_episode_field_binding_v4' : null;
  if (!version || !root.episodeFieldBinding
    || root.episodeFieldBinding.source.version !== version || !id(root.episodeFieldBinding.source.sourceId)) {
    throw new Error('invalid actual field episode root kind or binding receipt');
  }
  if (version === 'batted_episode_field_binding_v3' || version === 'batted_episode_field_binding_v4') {
    const proof = root.episodeFieldBinding.completedOriginProof, source = root.episodeFieldBinding.source, origin = source.completedOrigin;
    if (!id(source.physicalActorSourceId) || !origin || Object.keys(origin).sort().join('|') !== 'kind|sourceId'
      || !['physical_play_closure', 'foul_terminal_completion'].includes(origin.kind) || !id(origin.sourceId)
      || !proof || Object.keys(proof).sort().join('|') !== 'applicationId|completionHash|durableRevision|sourceHash'
      || !id(proof.applicationId) || !Number.isSafeInteger(proof.durableRevision) || proof.durableRevision < 1
      || !/^[a-f0-9]{64}$/.test(proof.sourceHash) || !/^[a-f0-9]{64}$/.test(proof.completionHash)) {
      throw new Error('invalid completed-origin field binding proof');
    }
  } else if ('completedOriginProof' in root.episodeFieldBinding) {
    throw new Error('completed-origin proof requires a completed-origin field binding');
  }
  return json([root.rootKind, root.episodeFieldBinding.source.sourceId]);
};

/** Validate the discriminator before any consumer chooses the bound-root route. */
export const isBattedEpisodeFieldRoot = (root: BattedWorldFieldRoot): root is
  Extract<BattedWorldFieldRoot, { rootKind: 'episode_field_binding_v1' | 'episode_field_binding_v2' | 'episode_field_binding_v3' | 'episode_field_binding_v4' }> =>
  battedWorldFieldRootIdentity(root) !== 'legacy';
export const battedWorldFieldEpisodeBindingHash = (root: BattedWorldFieldRoot): string | undefined =>
  isBattedEpisodeFieldRoot(root) ? hash(root.episodeFieldBinding) : undefined;

/** One physical-geometry selector. The original calibration archive is never relabeled as a new flight. */
export const battedWorldFieldGeometry = (root: BattedWorldFieldRoot & Readonly<{ source?: Source }>) => {
  const identity = battedWorldFieldRootIdentity(root);
  if (root.source && battedWorldFieldSourceRootIdentity(root.source) !== identity) throw new Error('actual field Source and root binding mode differ');
  if (!isBattedEpisodeFieldRoot(root)) return root.geometry.geometry;
  const binding = root.episodeFieldBinding, world = root.response.touch.worldContact, flight = world.flight;
  const pitch = flight.physicalPitch, calibration = root.geometry, original = calibration.baseGeometry;
  assertSupportedBattedWorldConsumer(world, 'episode_field_geometry');
  const appended = pitch.result.pitch.resolution.timeline.events.slice(pitch.beforeTimeline.events.length).filter(event => event.kind === 'BatBallContact');
  const contact = appended[0];
  const baseGeometry = createBattedWorldBaseGeometry({ field: flight.source.execution.field, bases: original.source.bases });
  const geometry = createBattedWorldFieldGeometry({ baseGeometry, baseModels: calibration.source.baseModels });
  if (binding.source.responseSourceId !== root.response.source.sourceId || binding.source.fieldCalibrationSourceId !== calibration.source.sourceId
    || root.source && (root.source.responseSourceId !== binding.source.responseSourceId || root.source.geometrySourceId !== binding.source.fieldCalibrationSourceId)
    || binding.gameId !== pitch.frame.gameId || binding.playId !== pitch.frame.match.playId || binding.physicalPitchSourceId !== pitch.source.sourceId
    || binding.physicalPitchSourceId !== flight.source.physicalPitchSourceId || appended.length !== 1 || !contact
    || binding.contactSequence !== contact.sequence || binding.contactTick !== contact.tick || contact.tick !== flight.flight.initialBall.tick
    || json(binding.response) !== json(root.response) || json(binding.calibration) !== json(calibration)
    || json(binding.geometry) !== json(geometry) || json(calibration.geometry) !== json(geometry)
    || json(flight.source.execution.field) !== json(original.flight.source.execution.field)
    || calibration.source.baseGeometrySourceId !== original.source.sourceId
    || original.fixture.game_id !== root.response.model.gameId) throw new Error('actual field episode binding physical root or geometry differs');
  return binding.geometry;
};
