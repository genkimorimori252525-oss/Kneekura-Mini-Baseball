import type {
  MiniHudState,
} from './MiniHudState';

export type MiniBaseDiamondMarker = Readonly<{
  base: 1 | 2 | 3;
  label: '一塁' | '二塁' | '三塁';
  occupied: boolean;
  runnerId: string | null;
  accent: 'red' | 'inactive';
}>;

export type MiniBaseDiamondState =
  readonly MiniBaseDiamondMarker[];

export const buildMiniBaseDiamondState = (
  bases: MiniHudState['bases'],
): MiniBaseDiamondState => ([
  {
    base: 1,
    label: '一塁',
    occupied: bases.first.occupied,
    runnerId: bases.first.runnerId,
    accent: bases.first.occupied
      ? 'red'
      : 'inactive',
  },
  {
    base: 2,
    label: '二塁',
    occupied: bases.second.occupied,
    runnerId: bases.second.runnerId,
    accent: bases.second.occupied
      ? 'red'
      : 'inactive',
  },
  {
    base: 3,
    label: '三塁',
    occupied: bases.third.occupied,
    runnerId: bases.third.runnerId,
    accent: bases.third.occupied
      ? 'red'
      : 'inactive',
  },
]);
