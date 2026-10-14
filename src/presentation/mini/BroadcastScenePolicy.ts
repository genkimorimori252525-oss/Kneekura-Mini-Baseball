/** Visual scheduling only. These decisions never feed back into Match Core. */
export const MINI_REGULAR_VISUAL_SAMPLE_US = 55_000;
export const MINI_BATTED_BALL_VISUAL_SAMPLE_US = 27_500;
/** 1.2x denser visual pitch updates than the current 27.5ms pass. */
export const MINI_PITCH_BALL_VISUAL_SAMPLE_US = MINI_BATTED_BALL_VISUAL_SAMPLE_US / 1.2;
export const MINI_FOUL_WATCH_LIMIT_US = 5_000_000;
export const MINI_FOUL_EARLIEST_SKIP_US = 2_000_000;

export type BroadcastCamera = 'catcher' | 'batter' | 'runner' | 'mound' | 'overhead';

export type SceneObservation = Readonly<{
  chosenCamera: BroadcastCamera;
  autoOverhead: boolean;
  contactOccurred: boolean;
  followThroughComplete: boolean;
  batterHasStartedRunning: boolean;
  uncertainFairFoul: boolean;
  fair: boolean;
}>;

/** Batter POV tracks a batted ball until running starts after the follow-through.
 * A borderline fair/foul also permits a provisional runner camera. */
export function cameraForScene(x: SceneObservation): BroadcastCamera {
  if (x.chosenCamera === 'batter') {
    if (x.contactOccurred && x.followThroughComplete && x.batterHasStartedRunning &&
      (x.fair || x.uncertainFairFoul)) return 'runner';
    return 'batter';
  }
  if (x.chosenCamera === 'runner') return 'runner';
  if (x.autoOverhead && x.contactOccurred && x.fair) return 'overhead';
  return x.chosenCamera;
}

export type SceneCutDecision = Readonly<{
  kind: 'none' | 'foul-watch-expired' | 'foul-user-skip' | 'fair-resolved' | 'runner-user-skip';
  mayCut: boolean;
}>;

export type SceneCutObservation = Readonly<{
  kind: 'foul' | 'fair';
  elapsedSinceContactUs: number;
  tapAtElapsedUs?: number | null;
  ballResolved: boolean;
  playClosed: boolean;
  runnerPerspective: boolean;
  followThroughComplete: boolean;
}>;

/** Foul follow maximum 5s; tap earlier than t=2s queues cut at t=2s, tap later
 * cuts immediately. Fair ball is not cut on an arbitrary animation length:
 * authoritative resolution or voluntary runner-camera skip is required. */
export function sceneCutPolicy(x: SceneCutObservation): SceneCutDecision {
  if (!Number.isFinite(x.elapsedSinceContactUs) || x.elapsedSinceContactUs < 0) {
    throw new Error('Invalid scene observation time.');
  }
  if (x.kind === 'foul') {
    if (x.elapsedSinceContactUs >= MINI_FOUL_WATCH_LIMIT_US)
      return { kind: 'foul-watch-expired', mayCut: true };
    if (x.tapAtElapsedUs != null && Number.isFinite(x.tapAtElapsedUs) &&
      x.tapAtElapsedUs >= 0 && x.tapAtElapsedUs <= x.elapsedSinceContactUs &&
      x.elapsedSinceContactUs >= MINI_FOUL_EARLIEST_SKIP_US)
      return { kind: 'foul-user-skip', mayCut: true };
    return { kind: 'none', mayCut: false };
  }
  if (x.ballResolved || x.playClosed) return { kind: 'fair-resolved', mayCut: true };
  if (x.tapAtElapsedUs != null && x.tapAtElapsedUs >= 0 &&
    x.runnerPerspective && x.followThroughComplete)
    return { kind: 'runner-user-skip', mayCut: true };
  return { kind: 'none', mayCut: false };
}

/** Display-only label ink: runners stay recognizable against defenders. */
export function runnerNameInk(role: 'runner' | 'batter' | 'fielder', camera: BroadcastCamera): string | null {
  return camera === 'overhead' && role === 'runner' ? '#ff7777' : null;
}
