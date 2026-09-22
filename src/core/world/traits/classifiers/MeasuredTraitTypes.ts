import type { Vec3 } from '../../../model/geometry';
import type { TraitScope, TraitTime } from '../TraitTypes';
import type { SourceTraitAssessment, TraitSourceSnapshot } from '../sources/SourceTraitTypes';
export type MeasuredFamilyId = 'line_drive' | 'pitcher_contact_distribution' | 'gyro_pitch_shape'
  | 'command_instability' | 'release_miss_pattern';
export type MeasurementEvidence = Readonly<{
  scope: TraitScope; episodeId: string; eventId: string; time: TraitTime;
}>;
/** One actual contact event. Y is up; the supplied population is owned by source.sourceKey. */
export type ContactObservation = MeasurementEvidence & Readonly<{ exitVelocityMps: Vec3 }>;
/** One physical pitch observation; spin is angular velocity in radians/second, not rpm. */
export type SpinObservation = MeasurementEvidence & Readonly<{ velocityMps: Vec3; spinRadPerSecond: Vec3 }>;
/** Both points are at the same plate reference plane and use the same coordinate convention. */
export type PlatePoint = Readonly<{ horizontalM: number; verticalM: number }>;
export type CommandObservation = MeasurementEvidence & Readonly<{ target: PlatePoint; actual: PlatePoint }>;
/** releaseMissM is failure-attributable error, NOT ordinary aerodynamic pitch movement. */
export type ReleaseObservation = MeasurementEvidence & Readonly<{ deliveryFailed: boolean; releaseMissM: PlatePoint }>;
export type MeasurementRule =
  | Readonly<{ familyId: 'line_drive'; lowerAngleDeg: number; upperAngleDeg: number; minimumFraction: number }>
  | Readonly<{ familyId: 'pitcher_contact_distribution'; groundUpperAngleDeg: number; flyLowerAngleDeg: number;
      minimumGroundFraction: number; minimumFlyFraction: number }>
  | Readonly<{ familyId: 'gyro_pitch_shape'; minimumAxisAlignment: number; minimumSpinRpm: number; highSpinRpm: number;
      minimumGyroFraction: number; minimumHighSpinGyroFraction: number }>
  | Readonly<{ familyId: 'command_instability'; minimumDispersionM: number }>
  | Readonly<{ familyId: 'release_miss_pattern'; minimumMissM: number; minimumFailureFraction: number;
      minimumDirectionalConcentration: number; minimumFailedEpisodes: number }>;
/** No default numerical calibration is supplied or silently inferred. */
export type MeasurementModel = Readonly<{
  modelId: string; version: string; minimumEpisodes: number; minimumDays: number;
  windowDays: number; maximumSourceAgeDays: number; rule: MeasurementRule;
}>;
export type MeasuredTraitRequest = Readonly<{
  classificationId: string; scope: TraitScope; time: TraitTime; source: TraitSourceSnapshot;
  model: MeasurementModel; observations: readonly (ContactObservation | SpinObservation | CommandObservation | ReleaseObservation)[];
}>;
export type MeasurementMetric = Readonly<{ key: string; value: number }>;
export type MeasuredTraitClassification = Readonly<{
  boundary: 'MEASURED_TRAIT_CLASSIFICATION_ONLY'; algorithmVersion: 'measured-traits-v1';
  request: MeasuredTraitRequest; sampleCount: number; episodeCount: number; evidenceSpanDays: number;
  metrics: readonly MeasurementMetric[];
}> & (Readonly<{ status: 'READY'; reasons: readonly []; assessment: SourceTraitAssessment }>
  | Readonly<{ status: 'UNAVAILABLE'; reasons: readonly ('STALE_SOURCE' | 'INSUFFICIENT_EVIDENCE' | 'INSUFFICIENT_FAILURE_EPISODES')[]; assessment: null }>);
