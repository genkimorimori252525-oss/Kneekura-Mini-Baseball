import {
  calibratePitchNameRegistry,
  type PitchNameCalibrationSample,
  type PitchNameRegistry,
} from './PitchNameRegistry';

export type StatcastPitchHand = 'L' | 'R';

export type Statcast2025PitchMovementRow = Readonly<{
  pitchType: string;
  pitchName: string;
  throws: StatcastPitchHand;
  pfxZInches: number;
  pfxXInchesCatcherPerspective: number;
}>;

export const MLB_STATCAST_2025_PITCH_NAME_REGISTRY_VERSION =
  'mlb-statcast-2025-arm-side-v1' as const;

export const MLB_STATCAST_2025_SOURCE = Object.freeze({
  season: 2025,
  source:
    'Baseball Savant Statcast-derived grouped pitch movement',
  sourceArtifact:
    'Jakeyv22/mlb-season-pitching-dashboard/statcast_2025_pitch_movement.csv',
  officialFieldReference:
    'Baseball Savant CSV docs: pfx_x/pfx_z',
  sourceHorizontalPerspective:
    'catcher' as const,
  registryHorizontalFrame:
    'pitcher_arm_side_positive' as const,
  notes:
    'The grouped source artifact publishes pfx_x/pfx_z in inches. Left/right horizontal movement is mirrored into one pitcher-relative arm-side-positive frame before calibration.',
});

const INCHES_TO_METERS = 0.0254;

const COMMON_PITCH_TYPES = Object.freeze([
  'FF',
  'SI',
  'FC',
  'SL',
  'ST',
  'CU',
  'KC',
  'CH',
  'FS',
  'SV',
] as const);

type CommonPitchType =
  (typeof COMMON_PITCH_TYPES)[number];

const DISPLAY_NAMES: Readonly<
  Record<CommonPitchType, string>
> = Object.freeze({
  FF: 'フォーシーム',
  SI: 'シンカー',
  FC: 'カッター',
  SL: 'スライダー',
  ST: 'スイーパー',
  CU: 'カーブ',
  KC: 'ナックルカーブ',
  CH: 'チェンジアップ',
  FS: 'スプリット',
  SV: 'スラーブ',
});

/**
 * Exact hand-split 2025 rows from the source artifact.
 *
 * We intentionally keep both throwing hands as separate calibration samples.
 * After mirroring catcher's-view horizontal movement into an arm-side-positive
 * frame, the registry centroid is an equal-hand reference rather than being
 * biased toward whichever throwing hand generated more MLB pitches.
 */
export const MLB_STATCAST_2025_COMMON_PITCH_MOVEMENT_ROWS:
  readonly Statcast2025PitchMovementRow[] = Object.freeze([
    {
      pitchType: 'CH',
      pitchName: DISPLAY_NAMES.CH,
      throws: 'L',
      pfxZInches: 5.163879625864173,
      pfxXInchesCatcherPerspective: 14.56601226993865,
    },
    {
      pitchType: 'CH',
      pitchName: DISPLAY_NAMES.CH,
      throws: 'R',
      pfxZInches: 4.150114068441065,
      pfxXInchesCatcherPerspective: -14.765986501027093,
    },
    {
      pitchType: 'CU',
      pitchName: DISPLAY_NAMES.CU,
      throws: 'L',
      pfxZInches: -9.109137271568212,
      pfxXInchesCatcherPerspective: -8.76871794871795,
    },
    {
      pitchType: 'CU',
      pitchName: DISPLAY_NAMES.CU,
      throws: 'R',
      pfxZInches: -9.822505813953487,
      pfxXInchesCatcherPerspective: 10.02261780104712,
    },
    {
      pitchType: 'FC',
      pitchName: DISPLAY_NAMES.FC,
      throws: 'L',
      pfxZInches: 7.915203996669442,
      pfxXInchesCatcherPerspective: -2.212427672955975,
    },
    {
      pitchType: 'FC',
      pitchName: DISPLAY_NAMES.FC,
      throws: 'R',
      pfxZInches: 8.424756600200512,
      pfxXInchesCatcherPerspective: 2.2953592514202965,
    },
    {
      pitchType: 'FF',
      pitchName: DISPLAY_NAMES.FF,
      throws: 'L',
      pfxZInches: 16.222589857213197,
      pfxXInchesCatcherPerspective: 7.995300717762561,
    },
    {
      pitchType: 'FF',
      pitchName: DISPLAY_NAMES.FF,
      throws: 'R',
      pfxZInches: 16.004460927152316,
      pfxXInchesCatcherPerspective: -7.657565632458233,
    },
    {
      pitchType: 'FS',
      pitchName: DISPLAY_NAMES.FS,
      throws: 'L',
      pfxZInches: 6.308604206500956,
      pfxXInchesCatcherPerspective: 10.438164435946463,
    },
    {
      pitchType: 'FS',
      pitchName: DISPLAY_NAMES.FS,
      throws: 'R',
      pfxZInches: 2.790653085680048,
      pfxXInchesCatcherPerspective: -11.401605751947274,
    },
    {
      pitchType: 'KC',
      pitchName: DISPLAY_NAMES.KC,
      throws: 'L',
      pfxZInches: -8.05209549071618,
      pfxXInchesCatcherPerspective: -4.550450928381963,
    },
    {
      pitchType: 'KC',
      pitchName: DISPLAY_NAMES.KC,
      throws: 'R',
      pfxZInches: -9.884583579444772,
      pfxXInchesCatcherPerspective: 8.072179562906083,
    },
    {
      pitchType: 'SI',
      pitchName: DISPLAY_NAMES.SI,
      throws: 'L',
      pfxZInches: 7.657216128533911,
      pfxXInchesCatcherPerspective: 15.47280037111489,
    },
    {
      pitchType: 'SI',
      pitchName: DISPLAY_NAMES.SI,
      throws: 'R',
      pfxZInches: 7.377599396074485,
      pfxXInchesCatcherPerspective: -15.40426824656498,
    },
    {
      pitchType: 'SL',
      pitchName: DISPLAY_NAMES.SL,
      throws: 'L',
      pfxZInches: 1.6586347055758206,
      pfxXInchesCatcherPerspective: -4.559270326615705,
    },
    {
      pitchType: 'SL',
      pitchName: DISPLAY_NAMES.SL,
      throws: 'R',
      pfxZInches: 1.8432072049534054,
      pfxXInchesCatcherPerspective: 4.9600351053159475,
    },
    {
      pitchType: 'ST',
      pitchName: DISPLAY_NAMES.ST,
      throws: 'L',
      pfxZInches: 0.7456937799043062,
      pfxXInchesCatcherPerspective: -13.508771647200968,
    },
    {
      pitchType: 'ST',
      pitchName: DISPLAY_NAMES.ST,
      throws: 'R',
      pfxZInches: 1.5078330697165105,
      pfxXInchesCatcherPerspective: 13.952379096114022,
    },
    {
      pitchType: 'SV',
      pitchName: DISPLAY_NAMES.SV,
      throws: 'L',
      pfxZInches: -6.46118918918919,
      pfxXInchesCatcherPerspective: -13.025333333333332,
    },
    {
      pitchType: 'SV',
      pitchName: DISPLAY_NAMES.SV,
      throws: 'R',
      pfxZInches: -3.4515199999999995,
      pfxXInchesCatcherPerspective: 13.37248,
    },
  ]);

export const statcastCatcherXToArmSidePositiveInches = (
  pfxXInchesCatcherPerspective: number,
  throws: StatcastPitchHand,
): number => {
  if (!Number.isFinite(pfxXInchesCatcherPerspective)) {
    throw new Error(
      'Statcast pfx_x must be finite',
    );
  }
  return throws === 'L'
    ? pfxXInchesCatcherPerspective
    : -pfxXInchesCatcherPerspective;
};

const toCalibrationSample = (
  row: Statcast2025PitchMovementRow,
): PitchNameCalibrationSample => ({
  pitchNameId: row.pitchType,
  displayName: row.pitchName,
  signature: {
    inducedHorizontalM:
      statcastCatcherXToArmSidePositiveInches(
        row.pfxXInchesCatcherPerspective,
        row.throws,
      ) * INCHES_TO_METERS,
    inducedVerticalM:
      row.pfxZInches * INCHES_TO_METERS,
  },
});

export const createMlbStatcast2025PitchNameRegistry = (
): PitchNameRegistry => calibratePitchNameRegistry(
  MLB_STATCAST_2025_PITCH_NAME_REGISTRY_VERSION,
  MLB_STATCAST_2025_COMMON_PITCH_MOVEMENT_ROWS.map(
    toCalibrationSample,
  ),
  0.01,
  'pitcher_arm_side_positive',
);

export const MLB_STATCAST_2025_PITCH_NAME_REGISTRY =
  createMlbStatcast2025PitchNameRegistry();
