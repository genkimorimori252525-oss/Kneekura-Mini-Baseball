import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from '../../core/sim/plateAppearance/PlateAppearanceCommand';
import {
  buildMiniCommandBandState,
} from './MiniCommandBandState';

describe('MiniCommandBandState', () => {
  it('projects only the accepted semantic command into compact Japanese labels', () => {
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

    expect(buildMiniCommandBandState(command)).toEqual({
      pitcher: ['外角', '低め', 'バランス'],
      batter: ['積極', '早め'],
      runners: ['標準'],
    });
  });
});
