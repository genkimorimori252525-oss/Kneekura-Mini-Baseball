export type AppealWindowCloseReason =
  | 'next_pitch_or_play'
  | 'defense_left_field';

export type AppealWindowState = Readonly<{
  openedAtTick: number;
  closedAtTick: number | null;
  closeReason: AppealWindowCloseReason | null;
}>;

export type AppealTiming =
  | 'timely'
  | 'expired'
  | 'simultaneous_unresolved';

const validateTick = (name: string, tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

export const createAppealWindow = (
  openedAtTick: number,
): AppealWindowState => {
  validateTick('openedAtTick', openedAtTick);

  return {
    openedAtTick,
    closedAtTick: null,
    closeReason: null,
  };
};

export const closeAppealWindow = (
  state: AppealWindowState,
  closedAtTick: number,
  closeReason: AppealWindowCloseReason,
): AppealWindowState => {
  validateTick('closedAtTick', closedAtTick);
  if (state.closedAtTick !== null) {
    throw new Error('appeal window is already closed');
  }
  if (closedAtTick < state.openedAtTick) {
    throw new Error('appeal window cannot close before it opens');
  }

  return {
    openedAtTick: state.openedAtTick,
    closedAtTick,
    closeReason,
  };
};

export const evaluateAppealTiming = (
  state: AppealWindowState,
  appealTick: number,
): AppealTiming => {
  validateTick('appealTick', appealTick);
  if (appealTick < state.openedAtTick) {
    throw new Error('appealTick cannot precede appeal-window opening');
  }

  if (state.closedAtTick === null) {
    return 'timely';
  }
  if (appealTick < state.closedAtTick) {
    return 'timely';
  }
  if (appealTick > state.closedAtTick) {
    return 'expired';
  }
  return 'simultaneous_unresolved';
};
