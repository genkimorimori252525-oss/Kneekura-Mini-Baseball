import type {
  BatterHandedness,
} from './model';
import {
  buildMiniHandednessBadge,
  type MiniHandednessBadge,
  type MiniHandednessRole,
} from './MiniHandednessBadge';

export type MiniPlayerCardPublicMetric = Readonly<{
  label: string;
  value: string | number;
}>;

export type MiniPlayerCardInput = Readonly<{
  role: MiniHandednessRole;
  playerId: string;
  displayName?: string;
  jerseyNumber?: string | number;
  publicMetrics?: readonly MiniPlayerCardPublicMetric[];
  handedness: BatterHandedness;
}>;

export type MiniPlayerCardState = Readonly<{
  role: MiniHandednessRole;
  playerId: string;
  displayName: string | null;
  jerseyNumber: string | number | null;
  publicMetrics:
    readonly MiniPlayerCardPublicMetric[];
  handedness: MiniHandednessBadge;
}>;

export const buildMiniPlayerCardState = (
  input: MiniPlayerCardInput,
): MiniPlayerCardState => {
  if (input.playerId.length === 0) {
    throw new Error(
      'playerId must not be empty',
    );
  }
  if (
    input.displayName !== undefined
    && input.displayName.length === 0
  ) {
    throw new Error(
      'displayName must not be empty when provided',
    );
  }

  if (
    typeof input.jerseyNumber === 'string'
    && input.jerseyNumber.length === 0
  ) {
    throw new Error(
      'jerseyNumber must not be empty when provided',
    );
  }

  for (const metric of input.publicMetrics ?? []) {
    if (metric.label.length === 0) {
      throw new Error(
        'public metric label must not be empty',
      );
    }
    if (
      typeof metric.value === 'number'
      && !Number.isFinite(metric.value)
    ) {
      throw new Error(
        'public metric numeric value must be finite',
      );
    }
  }

  return {
    role: input.role,
    playerId: input.playerId,
    displayName: input.displayName ?? null,
    jerseyNumber:
      input.jerseyNumber ?? null,
    publicMetrics:
      (input.publicMetrics ?? []).map(
        (metric) => ({ ...metric }),
      ),
    handedness: buildMiniHandednessBadge(
      input.role,
      input.handedness,
    ),
  };
};
