import { describe, expect, it } from 'vitest';
import {
  CORE_PROTOCOL_VERSION,
  findBaseTouchTick,
  findFirstTrueTick,
  findGloveBallContactTick,
} from './index';

describe('core package', () => {
  it('exposes the first shared protocol version', () => {
    expect(CORE_PROTOCOL_VERSION).toBe(1);
  });

  it('exposes exact event time refinement through the shared Core API', () => {
    expect(findFirstTrueTick(4_000, 6_000, (tick) => tick >= 5_237)).toBe(5_237);
  });

  it('exposes exact glove-ball contact timing through the shared Core API', () => {
    expect(typeof findGloveBallContactTick).toBe('function');
  });

  it('exposes exact base touch timing through the shared Core API', () => {
    expect(typeof findBaseTouchTick).toBe('function');
  });
});
