import type {
  PlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';

export type MiniCommandOption = Readonly<{
  value: string;
  label: string;
  selected: boolean;
}>;

export type MiniCommandOptionGroupKind =
  | 'pitcher_attack_zone'
  | 'pitcher_vertical_plan'
  | 'pitcher_aggression'
  | 'batter_approach'
  | 'batter_swing_bias'
  | 'runner_posture';

export type MiniCommandOptionGroup = Readonly<{
  kind: MiniCommandOptionGroupKind;
  options: readonly MiniCommandOption[];
}>;

export type MiniCommandOptionBandState = Readonly<{
  scrollAxis: 'horizontal';
  groups: readonly MiniCommandOptionGroup[];
}>;

const options = (
  selected: string,
  values: readonly Readonly<{
    value: string;
    label: string;
  }>[],
): readonly MiniCommandOption[] => (
  values.map((entry) => ({
    value: entry.value,
    label: entry.label,
    selected: entry.value === selected,
  }))
);

export const buildMiniCommandOptionBandState = (
  command: PlateAppearanceCommand,
): MiniCommandOptionBandState => ({
  scrollAxis: 'horizontal',
  groups: [
    {
      kind: 'pitcher_attack_zone',
      options: options(
        command.pitcher.attackZone,
        [
          { value: 'inside', label: '内角' },
          { value: 'middle', label: '真ん中' },
          { value: 'outside', label: '外角' },
        ],
      ),
    },
    {
      kind: 'pitcher_vertical_plan',
      options: options(
        command.pitcher.verticalPlan,
        [
          { value: 'low', label: '低め' },
          { value: 'middle', label: '中段' },
          { value: 'high', label: '高め' },
        ],
      ),
    },
    {
      kind: 'pitcher_aggression',
      options: options(
        command.pitcher.aggression,
        [
          { value: 'challenge', label: '勝負' },
          {
            value: 'balanced',
            label: 'バランス',
          },
          { value: 'waste', label: '外す' },
        ],
      ),
    },
    {
      kind: 'batter_approach',
      options: options(
        command.batter.approach,
        [
          { value: 'take', label: '見送り' },
          { value: 'balanced', label: '標準' },
          { value: 'aggressive', label: '積極' },
        ],
      ),
    },
    {
      kind: 'batter_swing_bias',
      options: options(
        command.batter.swingBias,
        [
          { value: 'early', label: '早め' },
          { value: 'neutral', label: '標準' },
          { value: 'late', label: '遅め' },
        ],
      ),
    },
    {
      kind: 'runner_posture',
      options: options(
        command.runners.posture,
        [
          {
            value: 'conservative',
            label: '慎重',
          },
          { value: 'balanced', label: '標準' },
          { value: 'aggressive', label: '積極' },
        ],
      ),
    },
  ],
});
