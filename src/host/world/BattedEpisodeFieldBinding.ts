import type { BattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { DurableBattedContactResponse } from './SqliteBattedContactResponseStore';
import type { DurableBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';

/** References only. The opaque sourceVersion is never a capability discriminator. */
export type AcceptedBattedEpisodeFieldBinding = Readonly<{
  sourceId: string; sourceVersion: string;
  responseSourceId: string; fieldCalibrationSourceId: string;
}> & (Readonly<{ version: 'batted_episode_field_binding_v1'; physicalActorSourceId?: never }>
  | Readonly<{ version: 'batted_episode_field_binding_v2'; physicalActorSourceId: string }>);
export type DurableBattedEpisodeFieldBinding = Readonly<{
  source: AcceptedBattedEpisodeFieldBinding;
  gameId: string; playId: number; physicalPitchSourceId: string; contactSequence: number; contactTick: number;
  response: DurableBattedContactResponse;
  calibration: DurableBattedWorldFieldGeometry;
  geometry: BattedWorldFieldGeometry;
}>;
export type BattedEpisodeFieldBindingAuthority = Readonly<{
  readAcceptedBinding(sourceId: string): AcceptedBattedEpisodeFieldBinding | null;
}>;
export type SqliteBattedEpisodeFieldBindingStore = Readonly<{
  accept(sourceId: string): DurableBattedEpisodeFieldBinding;
  read(sourceId: string): DurableBattedEpisodeFieldBinding | null;
  close(): void;
}>;
