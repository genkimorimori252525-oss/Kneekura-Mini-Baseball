import { describe, expect, it } from 'vitest';
import {
  activateNextNonLivePlateAppearance,
  confirmDurableClosedNonLiveStateApplication,
  deriveClosedNonLiveMatchState,
} from './index';

describe('non-live official public seam', () => {
  it('exports the non-live official closure/application operations', () => {
    expect(deriveClosedNonLiveMatchState).toBeTypeOf('function');
    expect(confirmDurableClosedNonLiveStateApplication).toBeTypeOf('function');
    expect(activateNextNonLivePlateAppearance).toBeTypeOf('function');
  });
});
