import { describe, expect, it } from 'vitest';
import { CORE_PROTOCOL_VERSION } from './index';

describe('core package', () => {
  it('exposes the first shared protocol version', () => {
    expect(CORE_PROTOCOL_VERSION).toBe(1);
  });
});
