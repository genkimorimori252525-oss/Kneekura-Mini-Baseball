import type {
  PlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';

export type MiniCommandBandState = Readonly<{
  pitcher: readonly string[];
  batter: readonly string[];
  runners: readonly string[];
}>;

const pitcherAttackLabel = (
  value: PlateAppearanceCommand['pitcher']['attackZone'],
): string => {
  switch (value) {
    case 'inside':
      return '内角';
    case 'middle':
      return '真ん中';
    case 'outside':
      return '外角';
  }
};

const pitcherVerticalLabel = (
  value: PlateAppearanceCommand['pitcher']['verticalPlan'],
): string => {
  switch (value) {
    case 'low':
      return '低め';
    case 'middle':
      return '中段';
    case 'high':
      return '高め';
  }
};

const pitcherAggressionLabel = (
  value: PlateAppearanceCommand['pitcher']['aggression'],
): string => {
  switch (value) {
    case 'challenge':
      return '勝負';
    case 'balanced':
      return 'バランス';
    case 'waste':
      return '外す';
  }
};

const batterApproachLabel = (
  value: PlateAppearanceCommand['batter']['approach'],
): string => {
  switch (value) {
    case 'take':
      return '見送り';
    case 'balanced':
      return '標準';
    case 'aggressive':
      return '積極';
  }
};

const batterSwingBiasLabel = (
  value: PlateAppearanceCommand['batter']['swingBias'],
): string => {
  switch (value) {
    case 'early':
      return '早め';
    case 'neutral':
      return '標準';
    case 'late':
      return '遅め';
  }
};

const runnerPostureLabel = (
  value: PlateAppearanceCommand['runners']['posture'],
): string => {
  switch (value) {
    case 'conservative':
      return '慎重';
    case 'balanced':
      return '標準';
    case 'aggressive':
      return '積極';
  }
};

export const buildMiniCommandBandState = (
  command: PlateAppearanceCommand,
): MiniCommandBandState => ({
  pitcher: [
    pitcherAttackLabel(command.pitcher.attackZone),
    pitcherVerticalLabel(command.pitcher.verticalPlan),
    pitcherAggressionLabel(command.pitcher.aggression),
  ],
  batter: [
    batterApproachLabel(command.batter.approach),
    batterSwingBiasLabel(command.batter.swingBias),
  ],
  runners: [
    runnerPostureLabel(command.runners.posture),
  ],
});
