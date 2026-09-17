import { describe, expect, it } from 'vitest';
import {
  CORE_PROTOCOL_VERSION,
  createLiveBallCatchOutcome,
  createSecuredCatchOutcome,
  evaluateCatchRetentionLoad,
  findBaseTouchTick,
  findFirstTrueTick,
  findGloveBallContactTick,
  findSecureCatchTick,
  findTagContactTick,
  findThrowReleaseTick,
  resolveCatchRetention,
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

  it('exposes exact secure catch timing through the shared Core API', () => {
    expect(typeof findSecureCatchTick).toBe('function');
  });

  it('exposes catch outcomes that preserve secured and live-ball continuations', () => {
    expect(typeof createSecuredCatchOutcome).toBe('function');
    expect(typeof createLiveBallCatchOutcome).toBe('function');
  });

  it('exposes deterministic catch-retention physics through the shared Core API', () => {
    expect(typeof evaluateCatchRetentionLoad).toBe('function');
    expect(typeof resolveCatchRetention).toBe('function');
  });

  it('exposes exact base touch timing through the shared Core API', () => {
    expect(typeof findBaseTouchTick).toBe('function');
  });

  it('exposes exact physical tag contact timing through the shared Core API', () => {
    expect(typeof findTagContactTick).toBe('function');
  });

  it('exposes exact throw release timing through the shared Core API', () => {
    expect(typeof findThrowReleaseTick).toBe('function');
  });
});
