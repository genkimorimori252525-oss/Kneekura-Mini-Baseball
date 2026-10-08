import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import type { DurableBattedEpisodeFieldBinding } from './BattedEpisodeFieldBinding';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSupportedBattedWorldConsumer } from './BattedWorldRunnerConsumerBoundary';

export type BattedEpisodeFieldBindingOptIn = Readonly<{ version: 'batted_episode_field_binding_v1'; sourceId: string }>;
export type BattedWorldFieldRoot = Readonly<{ response: DurableBattedContactResponse; geometry: DurableBattedWorldFieldGeometry }> &
  (Readonly<{ rootKind?: never; episodeFieldBinding?: never }>
    | Readonly<{ rootKind: 'episode_field_binding_v1'; episodeFieldBinding: DurableBattedEpisodeFieldBinding }>);
type Source = Readonly<{ responseSourceId: string; geometrySourceId: string; episodeFieldBinding?: BattedEpisodeFieldBindingOptIn; kind?: string }>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
export const battedWorldFieldSourceRootIdentity = (source: Source): string => {
  if (!('episodeFieldBinding' in source)) return 'legacy';
  const binding = source.episodeFieldBinding;
  if ('kind' in source || !binding || typeof binding !== 'object' || Array.isArray(binding)
    || Object.keys(binding).sort().join('|') !== 'sourceId|version'
    || binding.version !== 'batted_episode_field_binding_v1' || !id(binding.sourceId)) throw new Error('invalid episode field binding opt-in');
  return json(['episode_field_binding_v1', binding.sourceId]);
};
export const battedWorldFieldRootIdentity = (root: BattedWorldFieldRoot): string => {
  if (!('rootKind' in root) && !('episodeFieldBinding' in root)) return 'legacy';
  if (root.rootKind !== 'episode_field_binding_v1' || !root.episodeFieldBinding
    || root.episodeFieldBinding.source.version !== 'batted_episode_field_binding_v1' || !id(root.episodeFieldBinding.source.sourceId)) {
    throw new Error('invalid actual field episode root kind or binding receipt');
  }
  return json([root.rootKind, root.episodeFieldBinding.source.sourceId]);
};

/** One physical-geometry selector. The original calibration archive is never relabeled as a new flight. */
export const battedWorldFieldGeometry = (root: BattedWorldFieldRoot & Readonly<{ source?: Source }>) => {
  const identity = battedWorldFieldRootIdentity(root);
  if (root.source && battedWorldFieldSourceRootIdentity(root.source) !== identity) throw new Error('actual field Source and root binding mode differ');
  if (root.rootKind !== 'episode_field_binding_v1') return root.geometry.geometry;
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
