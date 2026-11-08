// xoshiro128** (32bit) + splitmix32 シーディング。
// 32bit整数演算のみ（Math.imul / >>>）なので環境間でビット一致する。
// java.util.Random的なsetSeed露出はしない——シードはコンストラクタでのみ与える。

export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const rotl = (v: number, k: number): number => ((v << k) | (v >>> (32 - k))) >>> 0;

export class DeterministicRng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    let x = seed >>> 0;
    const splitmix32 = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s0 = splitmix32();
    this.s1 = splitmix32();
    this.s2 = splitmix32();
    this.s3 = splitmix32();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s3 = 1;
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  nextInt(bound: number): number {
    if (bound <= 0) throw new Error('bound must be positive');
    return Math.floor(this.nextFloat() * bound);
  }

  nextGaussian(): number {
    // Box-Muller。Math.log/cos は環境間ビット一致保証がない（設計書§2の既知の罠。
    // 同一ブラウザ内の再現はOK。端末跨ぎリプレイ対応時に決定論数学へ差し替え）
    let u1 = this.nextFloat();
    if (u1 < 1e-12) u1 = 1e-12;
    const u2 = this.nextFloat();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  fork(tag: string): DeterministicRng {
    return new DeterministicRng(fmix32((this.nextUint32() ^ fnv1a32(tag)) >>> 0));
  }
}
