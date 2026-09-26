export const UINT32_RANGE = 0x1_0000_0000;

/** A private career-development stream. The host stores the original seed. */
export const createDevelopmentRandom = (seed: number, salt = 0): (() => number) => {
  if (!Number.isSafeInteger(seed) || seed <= 0 || seed >= UINT32_RANGE) {
    throw new Error('invalid development seed');
  }
  let state = (seed ^ salt) >>> 0;
  state ^= state >>> 16;
  state = Math.imul(state, 0x7feb352d);
  state ^= state >>> 15;
  state = Math.imul(state, 0x846ca68b);
  state ^= state >>> 16;
  state = state >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / UINT32_RANGE;
  };
};
