/** One counter-based draw per secure possession. No shared RNG consumption or
 * redraws when planning/rewinding. Squared uniform has mean max/3 and favours
 * the authored baseline. This distribution is provisional, not an MLB fit. */
export function sampleLiveTransferDelayV101(seed: number, playerId: string, ordinal: number, maximum: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || typeof playerId !== 'string' || !playerId.length
    || !Number.isSafeInteger(ordinal) || ordinal < 0 || !Number.isFinite(maximum) || maximum < 0 || maximum > 2) {
    throw Error('invalid transfer-delay input');
  }
  if (maximum === 0) return 0;
  let h = (2166136261 ^ seed) >>> 0;
  for (const c of 'transfer-v101:' + playerId + ':' + ordinal) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ h >>> 16, 0x7feb352d) >>> 0;
  h = Math.imul(h ^ h >>> 15, 0x846ca68b) >>> 0;
  const u = ((h ^ h >>> 16) >>> 0) / 4294967295;
  return maximum * u * u;
}
