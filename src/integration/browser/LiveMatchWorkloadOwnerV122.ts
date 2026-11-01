import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { validatePitchTimingProfile, type PitchTimingProfile } from '../../core/sim/pitch/PitchTimingModel';
import { validatePitchFatigueExecutionPolicy, type PitchFatigueExecutionPolicy } from '../../core/sim/pitch/PitchFatigueExecution';
import { restoreLiveWorkloadV122, advanceLiveWorkloadV122, type LiveWorkloadContextV122, type LiveWorkloadStateV122 } from './LiveWorkloadExecutionV122';

export type LiveMatchWorkloadConfigV122 = Readonly<{
  version: 'live_match_workload_v122'; sessionId: string; matchId: string; managerId: string;
  players: readonly Readonly<{ context: LiveWorkloadContextV122; timingProfile: PitchTimingProfile;
    pitchPolicy: PitchFatigueExecutionPolicy; effortUnitsPerPitch: number }>[];
}>;
export type LiveMatchWorkloadContinuationV122 = Readonly<{
  version: 'live_match_workload_continuation_v122'; authority: 'LOCAL_BROWSER_UNAUTHENTICATED'; nativeAdmission: false;
  configurationBinding: string; sessionId: string; matchId: string; managerId: string; playerIds: readonly string[];
  lastAcceptedPitchNumber: number;
  players: readonly Readonly<{ playerId: string; acceptedPitchCount: number; workload: LiveWorkloadStateV122 }>[];
}>;
export type LiveMatchWorkloadCandidateV122 = Readonly<{ playerId: string; pitchNumber: number; activity: PlayerWorkloadActivity | null }>;
type Row = { initial: LiveWorkloadStateV122; workload: LiveWorkloadStateV122; timingProfile: PitchTimingProfile;
  policy: PitchFatigueExecutionPolicy; effortUnitsPerPitch: number; acceptedPitchCount: number };
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const text = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 200;
const integer = (v: number) => Number.isSafeInteger(v) && v >= 0;
function fail(reason: string): never { throw Error('live match workload owner: ' + reason); }
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
/** Exact canonical JSON, without a lossy numeric/string hash or property-order dependency. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}';
}

/** A local Browser owner only. The continuation binds config/scope and checks
 * structural invariants, but is NOT authenticated physical history or Native
 * proof. A user can alter a plausible saved fatigue value; this boundary does
 * not claim to reconstruct every accepted pitch from compact continuation.
 * The Host must call commit only after its physical pitch is accepted, with no
 * intervening mutation/await between preflight and that atomic adoption. */
export function createLiveMatchWorkloadOwnerV122(raw: Readonly<{ config: LiveMatchWorkloadConfigV122; playerIds: readonly string[];
  pitchCount: number; continuation?: LiveMatchWorkloadContinuationV122 }>) {
  const input = cloneInert(raw), config = input.config;
  if (!fields(input, ['config', 'playerIds', 'pitchCount', ...(Object.hasOwn(input, 'continuation') ? ['continuation'] : [])])
    || !integer(input.pitchCount) || !Array.isArray(input.playerIds) || !input.playerIds.every(text)
    || new Set(input.playerIds).size !== input.playerIds.length
    || !fields(config, ['version', 'sessionId', 'matchId', 'managerId', 'players']) || config.version !== 'live_match_workload_v122'
    || ![config.sessionId, config.matchId, config.managerId].every(text) || !Array.isArray(config.players)) fail('invalid config or real-player inventory');
  const playerIds = Object.freeze([...input.playerIds].sort()), realPlayers = new Set(playerIds), rows = new Map<string, Row>(), existingIds = new Set<string>();
  for (const source of config.players) {
    if (!fields(source, ['context', 'timingProfile', 'pitchPolicy', 'effortUnitsPerPitch'])
      || !Number.isFinite(source.effortUnitsPerPitch) || source.effortUnitsPerPitch < 0) fail('invalid configured workload source');
    const workload = restoreLiveWorkloadV122(source.context), s = workload.scope;
    if (s.sessionId !== config.sessionId || s.matchId !== config.matchId || !realPlayers.has(s.playerId) || rows.has(s.playerId)) fail('configured participant or session scope differs');
    const timingProfile = validatePitchTimingProfile(source.timingProfile), policy = validatePitchFatigueExecutionPolicy(source.pitchPolicy);
    if (policy.availableAtDay > s.gameDay || !Number.isFinite(workload.state.policy.workloadFatiguePerUnit * source.effortUnitsPerPitch)) fail('future or overflowing pitch response');
    for (const { activity } of source.context.activities) { existingIds.add(activity.sourceEventId); existingIds.add(activity.evidenceId); }
    rows.set(s.playerId, { initial: workload, workload, timingProfile, policy, effortUnitsPerPitch: source.effortUnitsPerPitch, acceptedPitchCount: 0 });
  }
  freeze(config);
  const configurationBinding = stable(config);
  let lastAcceptedPitchNumber = 0;
  if (input.continuation !== undefined) {
    const c = input.continuation;
    if (!fields(c, ['version', 'authority', 'nativeAdmission', 'configurationBinding', 'sessionId', 'matchId', 'managerId', 'playerIds', 'lastAcceptedPitchNumber', 'players'])
      || c.version !== 'live_match_workload_continuation_v122' || c.authority !== 'LOCAL_BROWSER_UNAUTHENTICATED' || c.nativeAdmission !== false
      || c.configurationBinding !== configurationBinding || c.sessionId !== config.sessionId || c.matchId !== config.matchId || c.managerId !== config.managerId
      || stable(c.playerIds) !== stable(playerIds) || !integer(c.lastAcceptedPitchNumber) || c.lastAcceptedPitchNumber !== input.pitchCount
      || !Array.isArray(c.players) || c.players.length !== rows.size) fail('continuation config, scope, inventory or pitch count differs');
    const seen = new Set<string>(); let accepted = 0;
    for (const saved of c.players) {
      if (!fields(saved, ['playerId', 'acceptedPitchCount', 'workload']) || !text(saved.playerId) || seen.has(saved.playerId)
        || !integer(saved.acceptedPitchCount) || saved.acceptedPitchCount > c.lastAcceptedPitchNumber) fail('continuation participant counts differ');
      const row = rows.get(saved.playerId); if (!row) fail('continuation has an unconfigured participant');
      const w = saved.workload, s = w?.state, initial = row.initial;
      if (!s || !integer(s.revision) || s.revision !== initial.state.revision + saved.acceptedPitchCount
        || !integer(s.effectiveDay) || s.effectiveDay !== (saved.acceptedPitchCount ? initial.scope.gameDay : initial.state.effectiveDay)
        || !Number.isFinite(s.fatigue) || s.fatigue < initial.state.fatigue || s.fatigue > 1
        || (saved.acceptedPitchCount === 0 || row.effortUnitsPerPitch * initial.state.policy.workloadFatiguePerUnit === 0) && s.fatigue !== initial.state.fatigue
        || stable(w) !== stable({ ...initial, state: { ...initial.state, revision: s.revision, effectiveDay: s.effectiveDay, fatigue: s.fatigue } }))
        fail('continuation workload policy, revision or state differs');
      createPlayerWorkloadRecovery({ careerId: s.careerId, playerId: s.playerId, createdAtDay: s.createdAtDay,
        fatigue: s.fatigue, recoveryCapacity: s.recoveryCapacity, policy: s.policy });
      row.workload = freeze(w); row.acceptedPitchCount = saved.acceptedPitchCount; seen.add(saved.playerId); accepted += saved.acceptedPitchCount;
      if (!integer(accepted) || accepted > c.lastAcceptedPitchNumber) fail('continuation consumes more pitches than the Host accepted');
    }
    lastAcceptedPitchNumber = c.lastAcceptedPitchNumber;
  } else if (input.pitchCount !== 0) fail('nonzero Host pitch count requires a continuation');
  // Per-owner unforgeable candidates. No process-global mutable state or inbox.
  const candidates = new WeakMap<object, { row: Row | undefined; before: LiveWorkloadStateV122 | undefined; after: LiveWorkloadStateV122 | undefined }>();
  function candidateActivity(playerId: string, pitchNumber: number): LiveMatchWorkloadCandidateV122 {
    if (!realPlayers.has(playerId) || !integer(pitchNumber) || pitchNumber !== lastAcceptedPitchNumber + 1) fail('candidate player or consecutive pitch number differs');
    const row = rows.get(playerId), activity: PlayerWorkloadActivity | null = row ? freeze({
      sourceEventId: JSON.stringify(['live_match_workload_v122', 'source', config.sessionId, config.matchId, pitchNumber, playerId]),
      evidenceId: JSON.stringify(['live_match_workload_v122', 'evidence', config.sessionId, config.matchId, pitchNumber, playerId]), sourceVersion: 'v122',
      careerId: row.workload.scope.careerId, playerId, atDay: row.workload.scope.gameDay, kind: 'MATCH', effortUnits: row.effortUnitsPerPitch }) : null;
    if (activity && (existingIds.has(activity.sourceEventId) || existingIds.has(activity.evidenceId))) fail('generated activity collides with an existing Source or evidence ID');
    const after = row && activity ? advanceLiveWorkloadV122({ workload: row.workload, activity, expectedRevision: row.workload.state.revision }) : undefined;
    const token = Object.freeze({ playerId, pitchNumber, activity }); candidates.set(token, { row, before: row?.workload, after }); return token;
  }
  function commitAfterAccepted(candidate: LiveMatchWorkloadCandidateV122): void {
    const pending = candidates.get(candidate);
    if (!pending || candidate.pitchNumber !== lastAcceptedPitchNumber + 1 || pending.row?.workload !== pending.before) fail('foreign, repeated or stale candidate');
    // All throwing calculations and ID checks happened in preflight. Adoption
    // changes only this owner's canonical snapshot and accepted-pitch counters.
    if (pending.row) { pending.row.workload = pending.after!; pending.row.acceptedPitchCount++;
      existingIds.add(candidate.activity!.sourceEventId); existingIds.add(candidate.activity!.evidenceId); }
    lastAcceptedPitchNumber = candidate.pitchNumber; candidates.delete(candidate);
  }
  const readForPitch = (playerId: string) => { if (!realPlayers.has(playerId)) fail('unknown real player'); const row = rows.get(playerId);
    return row ? Object.freeze({ workload: row.workload, timingProfile: row.timingProfile, policy: row.policy }) : undefined; };
  const capture = (): LiveMatchWorkloadContinuationV122 => freeze({ version: 'live_match_workload_continuation_v122', authority: 'LOCAL_BROWSER_UNAUTHENTICATED',
    nativeAdmission: false, configurationBinding, sessionId: config.sessionId, matchId: config.matchId, managerId: config.managerId, playerIds,
    lastAcceptedPitchNumber, players: [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([playerId, row]) => ({ playerId,
      acceptedPitchCount: row.acceptedPitchCount, workload: row.workload })) });
  return Object.freeze({ readForPitch, candidateActivity, commitAfterAccepted, capture });
}
