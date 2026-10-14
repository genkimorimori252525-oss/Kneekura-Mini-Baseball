import type { BattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import type { CompletedBattedEpisodeOrigin } from './CompletedBattedEpisodeOrigin';

/** References only. The opaque sourceVersion is never a capability discriminator. */
export type AcceptedBattedEpisodeFieldBinding = Readonly<{
  sourceId: string; sourceVersion: string;
  responseSourceId: string; fieldCalibrationSourceId: string;
}> & (Readonly<{ version: 'batted_episode_field_binding_v1'; physicalActorSourceId?: never; completedOrigin?: never }>
  | Readonly<{ version: 'batted_episode_field_binding_v2'; physicalActorSourceId: string; completedOrigin?: never }>
  | Readonly<{ version: 'batted_episode_field_binding_v3' | 'batted_episode_field_binding_v4'; physicalActorSourceId: string; completedOrigin: CompletedBattedEpisodeOrigin }>);
export type DurableBattedEpisodeFieldBinding = Readonly<{
  source: AcceptedBattedEpisodeFieldBinding;
  gameId: string; playId: number; physicalPitchSourceId: string; contactSequence: number; contactTick: number;
  response: DurableBattedContactResponse;
  calibration: DurableBattedWorldFieldGeometry;
  geometry: BattedWorldFieldGeometry;
  completedOriginProof?: Readonly<{ sourceHash: string; applicationId: string; durableRevision: number; completionHash: string }>;
}>;
export type BattedEpisodeFieldBindingAuthority = Readonly<{
  readAcceptedBinding(sourceId: string): AcceptedBattedEpisodeFieldBinding | null;
}>;
export type SqliteBattedEpisodeFieldBindingStore = Readonly<{
  accept(sourceId: string): DurableBattedEpisodeFieldBinding;
  read(sourceId: string): DurableBattedEpisodeFieldBinding | null;
  close(): void;
}>;
