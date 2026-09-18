import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import {
  buildMiniCommandOptionBandState,
} from './MiniCommandOptionBandState';

const command = createPlateAppearanceCommand({
  pitcher: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
  batter: {
    approach: 'aggressive',
    swingBias: 'early',
  },
  runners: {
    posture: 'balanced',
  },
});

describe('MiniCommandOptionBandState', () => {
  it('exposes horizontal option groups from the actual P7 command schema', () => {
    const result = buildMiniCommandOptionBandState(
      command,
    );

    expect(result.scrollAxis).toBe('horizontal');
    expect(result.groups.map(
      (group) => group.kind,
    )).toEqual([
      'pitcher_attack_zone',
      'pitcher_vertical_plan',
      'pitcher_aggression',
      'batter_approach',
      'batter_swing_bias',
      'runner_posture',
    ]);
  });

  it('marks the currently accepted command value without changing the command', () => {
    const before = structuredClone(command);
    const result = buildMiniCommandOptionBandState(
      command,
    );

    const attack = result.groups.find(
      (group) => (
        group.kind === 'pitcher_attack_zone'
      ),
    );

    expect(
      attack?.options.find(
        (option) => option.selected,
      ),
    ).toEqual({
      value: 'outside',
      label: '外角',
      selected: true,
    });

    const runner = result.groups.find(
      (group) => group.kind === 'runner_posture',
    );
    expect(
      runner?.options.find(
        (option) => option.selected,
      )?.label,
    ).toBe('標準');

    expect(command).toEqual(before);
  });
});
