import type {
  BatterHandedness,
} from './model';
import {
  buildMiniHandednessBadge,
  type MiniHandednessBadge,
  type MiniHandednessRole,
} from './MiniHandednessBadge';

export type MiniPlayerCardInput = Readonly<{
  role: MiniHandednessRole;
  playerId: string;
  displayName?: string;
  handedness: BatterHandedness;
}>;

export type MiniPlayerCardState = Readonly<{
  role: MiniHandednessRole;
  playerId: string;
  displayName: string | null;
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

  return {
    role: input.role,
    playerId: input.playerId,
    displayName: input.displayName ?? null,
    handedness: buildMiniHandednessBadge(
      input.role,
      input.handedness,
    ),
  };
};
