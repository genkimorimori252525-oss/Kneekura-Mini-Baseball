import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerWorkloadRecovery, advancePlayerWorkloadRecovery, type PlayerWorkloadBaseline,
  type PlayerWorkloadActivity, type PlayerWorkloadRecoveryState, PLAYER_WORKLOAD_RECOVERY_VERSION } from '../../core/world/development/PlayerWorkloadRecovery';
import { applyPitchFatigueToExecution, type PitchFatigueExecutionPolicy } from '../../core/sim/pitch/PitchFatigueExecution';
import type { PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import type { Vec3 } from '../../core/model/geometry';

export type LiveWorkloadContextV122 = Readonly<{
  sourceId: string; sourceVersion: string;
  scope: Readonly<{ sessionId: string; matchId: string; careerId: string; playerId: string; gameDay: number }>;
  baseline: PlayerWorkloadBaseline;
  activities: readonly Readonly<{ expectedRevision: number; activity: PlayerWorkloadActivity }>[];
  expectedRevision: number;
}>;
export type LiveWorkloadStateV122 = Readonly<{
  version: 'live_workload_v122'; nativeAdmission: false; sourceId: string; sourceVersion: string;
  scope: LiveWorkloadContextV122['scope']; state: PlayerWorkloadRecoveryState;
  batterExecutionStatus: 'NOT_CONNECTED_NO_RESPONSE_CALIBRATION';
}>;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;
const day = (v: number) => Number.isSafeInteger(v) && v >= 0;
const fail = (): never => { throw Error('live workload: explicit source, scope, activity chronology or revision differs'); };
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const validScope = (s: LiveWorkloadContextV122['scope']) => fields(s, ['sessionId', 'matchId', 'careerId', 'playerId', 'gameDay'])
  && [s.sessionId, s.matchId, s.careerId, s.playerId].every(text) && day(s.gameDay);
const snapshot = (basis: Pick<LiveWorkloadStateV122, 'sourceId' | 'sourceVersion' | 'scope'>, state: PlayerWorkloadRecoveryState): LiveWorkloadStateV122 =>
  freeze({ version: 'live_workload_v122', nativeAdmission: false, sourceId: basis.sourceId, sourceVersion: basis.sourceVersion, scope: basis.scope, state,
    batterExecutionStatus: 'NOT_CONNECTED_NO_RESPONSE_CALIBRATION' });
/** Structural validation of a Host-owned current snapshot, not an assertion
 * that its history was accepted by Native. Full history is replayed at restore. */
function readSnapshot(raw: LiveWorkloadStateV122): LiveWorkloadStateV122 {
  const current = cloneInert(raw), s = current.state;
  if (!fields(current, ['version', 'nativeAdmission', 'sourceId', 'sourceVersion', 'scope', 'state', 'batterExecutionStatus'])
    || current.version !== 'live_workload_v122' || current.nativeAdmission !== false
    || current.batterExecutionStatus !== 'NOT_CONNECTED_NO_RESPONSE_CALIBRATION'
    || ![current.sourceId, current.sourceVersion].every(text) || !validScope(current.scope)
    || !fields(s, ['careerId', 'playerId', 'createdAtDay', 'fatigue', 'recoveryCapacity', 'policy', 'modelVersion', 'effectiveDay', 'revision'])
    || s.modelVersion !== PLAYER_WORKLOAD_RECOVERY_VERSION || !day(s.revision) || !day(s.effectiveDay)
    || s.effectiveDay < s.createdAtDay || s.effectiveDay > current.scope.gameDay
    || s.careerId !== current.scope.careerId || s.playerId !== current.scope.playerId) fail();
  // Reuse the existing policy and physical-state validator without inventing
  // an activity or advancing the revision just to validate the snapshot.
  createPlayerWorkloadRecovery({ careerId: s.careerId, playerId: s.playerId, createdAtDay: s.createdAtDay,
    fatigue: s.fatigue, recoveryCapacity: s.recoveryCapacity, policy: s.policy });
  return snapshot(current, s);
}

/** Replays supplied evidence only. Host owns activity admission, identity and
 * subsequent revision; there is no synthetic per-pitch effort or elapsed-day
 * recovery, no persisted base-SI edit and no Native ownership claim. */
export function restoreLiveWorkloadV122(raw: LiveWorkloadContextV122) {
  const context = cloneInert(raw), s = context.scope;
  if (!fields(context, ['sourceId', 'sourceVersion', 'scope', 'baseline', 'activities', 'expectedRevision'])
    || ![context.sourceId, context.sourceVersion].every(text)
    || !validScope(s)
    || !Array.isArray(context.activities) || !day(context.expectedRevision)) fail();
  let state = createPlayerWorkloadRecovery(context.baseline);
  if (state.careerId !== s.careerId || state.playerId !== s.playerId || state.effectiveDay > s.gameDay) fail();
  const events = new Set<string>(), evidence = new Set<string>();
  for (const entry of context.activities) {
    if (!fields(entry, ['expectedRevision', 'activity']) || !day(entry.expectedRevision) || !entry.activity
      || entry.activity.atDay > s.gameDay || events.has(entry.activity.sourceEventId) || evidence.has(entry.activity.evidenceId)) fail();
    state = advancePlayerWorkloadRecovery(state, entry.expectedRevision, entry.activity);
    events.add(entry.activity.sourceEventId); evidence.add(entry.activity.evidenceId);
  }
  if (state.revision !== context.expectedRevision) fail();
  return snapshot(context, state);
}

/** Constant-space state transition. Host owns the append-only activity ledger
 * and rejects repeated source/evidence IDs before calling this boundary. */
export function advanceLiveWorkloadV122(raw: Readonly<{ workload: LiveWorkloadStateV122; activity: PlayerWorkloadActivity; expectedRevision: number }>) {
  const input = cloneInert(raw);
  if (!fields(input, ['workload', 'activity', 'expectedRevision']) || !day(input.expectedRevision)) fail();
  const current = readSnapshot(input.workload);
  if (!input.activity || input.activity.atDay > current.scope.gameDay) fail();
  return snapshot(current, advancePlayerWorkloadRecovery(current.state, input.expectedRevision, input.activity));
}

export type LivePitchWorkloadExecutionInputV122 = Readonly<{
  timingProfile: PitchTimingProfile; physics: Readonly<{ velocity: Vec3; spin: Vec3 }>; policy: PitchFatigueExecutionPolicy;
} & ({ context: LiveWorkloadContextV122; workload?: never } | { workload: LiveWorkloadStateV122; context?: never })>;

/** The existing pitch law is applied once to fresh nominal values. The caller
 * must not feed the returned effective values back as nominal base ability. */
export function resolveLivePitchWorkloadExecutionV122(raw: LivePitchWorkloadExecutionInputV122) {
  const input = cloneInert(raw);
  const hasWorkload = Object.hasOwn(input, 'workload');
  if (!fields(input, [hasWorkload ? 'workload' : 'context', 'timingProfile', 'physics', 'policy'])) fail();
  const workload = hasWorkload ? readSnapshot(input.workload!) : restoreLiveWorkloadV122(input.context!),
    execution = applyPitchFatigueToExecution(input.timingProfile, input.physics, workload.state.fatigue, input.policy, workload.scope.gameDay);
  return freeze({ version: 'live_pitch_workload_execution_v122' as const, nativeAdmission: false as const, workload,
    policy: input.policy, nominal: { timingProfile: input.timingProfile, physics: input.physics }, execution });
}
