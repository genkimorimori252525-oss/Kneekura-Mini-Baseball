import type {
  BatterHandedness,
} from './model';

export type MiniHandednessRole =
  | 'pitcher'
  | 'batter';

export type MiniHandednessBadge = Readonly<{
  role: MiniHandednessRole;
  handedness: BatterHandedness;
  label: '右投' | '左投' | '右打' | '左打';
  accent: 'red' | 'blue';
}>;

export const buildMiniHandednessBadge = (
  role: MiniHandednessRole,
  handedness: BatterHandedness,
): MiniHandednessBadge => ({
  role,
  handedness,
  label: role === 'pitcher'
    ? handedness === 'R'
      ? '右投'
      : '左投'
    : handedness === 'R'
      ? '右打'
      : '左打',
  accent: handedness === 'R'
    ? 'red'
    : 'blue',
});
