import { cloneInert, advanceRuleProfileOfficialWindows } from '../../core/adjudication/OfficialWindowPolicy';
import { validateActualFairCatchStationaryRunners, type ActualFairCatchStationaryOccupiedRunners,
  type ActualFairCatchAppealApplicability } from '../../core/adjudication/ActualFairCatchScoring';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordUnresolvedCorrectRuleSnapshot, recordOwnedLiveCallImport,
  closeOfficialPlay, getOfficialStateWindows, getPlayAdjudicationState, type OwnedLiveCallImportProvenance,
  type PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { PlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { actualLiveAdjudicationProfile, type ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import type { ActualObservationMoment } from './ActualFieldObservation';
import type { SamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { samePaFields as fields, samePaText as text } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type SamePaCatchOfficialScheduler = Readonly<{ sourceId: string; sourceVersion: string; schedulerId: string;
  events: readonly Readonly<{ sourceId: string; sourceVersion: string; schedulerId: string; kind: 'advance_tick' | 'next_play_fence' }>[] }>;
export type SamePaCatchOfficialOpeningInput = Readonly<{ sourceId: string; originalMatch: CanonicalMatchState; physicalEnd: PlayEndFact;
  exactEnd: ActualObservationMoment; operative: Extract<SamePaCatchOperativeRuling, { kind: 'retired' }>;
  callProvenance: OwnedLiveCallImportProvenance; policy?: ActualLiveOfficialPolicy | null;
  occupiedRunners?: ActualFairCatchStationaryOccupiedRunners }>;
export type SamePaCatchOfficialInput = SamePaCatchOfficialOpeningInput & Readonly<{ scheduler: SamePaCatchOfficialScheduler;
  reviewed?: import('./ActualPostPlayReviewState').ActualPostPlayReviewProjection }>;
export type SamePaCatchOfficial = Readonly<{ ledger: PlayAdjudicationLedger; evaluationTick: number;
  originalOperativeLedger: PlayAdjudicationLedger; appealApplicability: ActualFairCatchAppealApplicability }> & (
  Readonly<{ kind: 'closed' }> | Readonly<{ kind: 'pending'; pendingReasons: readonly string[] }>);

/** Native supplies an independently proved end and authenticates every original
 * reference. The catch-work row owns an accepted official action, not an
 * autonomous perception measurement. The provenance's perception slot points to
 * that owned accepted-input component; it must never name a fabricated sensor.
 * Post-play recording timestamps cannot overwrite the earlier action or rule
 * snapshot. Original event chronology remains in originalOperativeLedger. */
export const deriveSamePaCatchOfficialOpening = (raw: SamePaCatchOfficialOpeningInput) => {
  const input = cloneInert(raw), { sourceId, originalMatch: match, physicalEnd, exactEnd, operative, callProvenance: provenance } = input;
  if (!text(sourceId) || !operative || operative.kind !== 'retired' || !text(operative.runnerId)
    || !Number.isSafeInteger(match.outs) || match.outs < 0 || match.outs > 2
    || operative.ledger.playId !== match.playId
    || operative.ledger.ruleProfileId !== match.ruleProfileId || operative.ledger.playEnd !== null
    || physicalEnd.kind !== 'play_end' || physicalEnd.reason !== 'live_action_complete' || physicalEnd.tick !== exactEnd.tick
    || provenance.playId !== match.playId || provenance.clock.originTick !== exactEnd.originTick
    || provenance.importedAtElapsedSeconds !== exactEnd.elapsedSeconds || operative.at.originTick !== exactEnd.originTick
    || provenance.calledAtElapsedSeconds !== operative.at.elapsedSeconds || operative.at.tick !== operative.onFieldCall.tick
    || operative.causeActionSourceId !== operative.onFieldCall.callId || operative.at.elapsedSeconds > exactEnd.elapsedSeconds
    || quantizeEventTick(exactEnd.originTick, exactEnd.elapsedSeconds, provenance.clock.ticksPerSecond) !== physicalEnd.tick
    || quantizeEventTick(operative.at.originTick, operative.at.elapsedSeconds, provenance.clock.ticksPerSecond) !== operative.at.tick) {
    throw new Error('same-PA catch official original scope, physical end or call clock differs');
  }
  const appealApplicability = validateActualFairCatchStationaryRunners({ originalMatch: match, batterRunnerId: operative.runnerId,
    originTick: exactEnd.originTick, ticksPerSecond: provenance.clock.ticksPerSecond,
    endElapsedSeconds: exactEnd.elapsedSeconds, occupiedRunners: input.occupiedRunners });
  const expectedRuling = { outsAfter: match.outs + 1, basesAfter: match.bases, scoredRunnerIds: [] };
  if (json(operative.onFieldCall.ruling) !== json(expectedRuling)) throw new Error('same-PA catch official operative retirement differs');
  const original = getPlayAdjudicationState(operative.ledger);
  if (original.kind !== 'official_adjudication_open' || original.calls.length !== 1 || original.reviews.length || original.openWindows.length
    || json(original.calls[0]) !== json(operative.onFieldCall) || operative.ledger.events.some(e => e.tick > exactEnd.tick
      || !['CorrectRuleSnapshotRecorded', 'UnresolvedCorrectRuleSnapshotRecorded', 'OnFieldCallRecorded'].includes(e.kind))) {
    throw new Error('same-PA catch official original operative ledger differs');
  }
  const profile = actualLiveAdjudicationProfile(match.ruleProfileId, input.policy ?? null);
  let ledger = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId, playEnd: physicalEnd });
  for (const [index, event] of operative.ledger.events.entries()) {
    if (event.kind !== 'CorrectRuleSnapshotRecorded' && event.kind !== 'UnresolvedCorrectRuleSnapshotRecorded') continue;
    const snapshot = event.snapshot, common = { eventId: `${sourceId}:rule-import:${index}`, tick: physicalEnd.tick,
      snapshotId: snapshot.snapshotId, evidenceRevision: snapshot.evidenceRevision };
    ledger = 'ruling' in snapshot ? recordCorrectRuleSnapshot(ledger, ledger.revision, { ...common, ruling: snapshot.ruling })
      : recordUnresolvedCorrectRuleSnapshot(ledger, ledger.revision, { ...common, reason: snapshot.reason });
  }
  ledger = recordOwnedLiveCallImport(ledger, ledger.revision, { eventId: sourceId + ':call-import', tick: physicalEnd.tick,
    call: operative.onFieldCall, provenance });
  const reasons: string[] = [];
  if (operative.onFieldCall.basisSnapshotId !== original.latestCorrectRule.snapshotId
    || operative.onFieldCall.basisEvidenceRevision !== original.latestCorrectRule.evidenceRevision) reasons.push('on_field_call_stale');
  for (const kind of ['appeal', 'review', 'challenge'] as const) {
    const policy = profile.officialWindows?.[kind];
    if (!policy) reasons.push('official_window_policy_unconfigured:' + kind);
    else if (kind !== 'appeal' && policy.available) reasons.push('official_window_owner_unavailable:' + kind);
  }
  return freeze({ ledger, evaluationTick: physicalEnd.tick, originalOperativeLedger: operative.ledger,
    appealApplicability, pendingReasons: reasons });
};

/** Reviewed ledgers enter only through the Native pinned-journal consumer. */
export const deriveSamePaCatchOfficial = (raw: SamePaCatchOfficialInput): SamePaCatchOfficial => {
  const input = cloneInert(raw), { sourceId, originalMatch: match, operative, scheduler } = input;
  if (!fields(scheduler, ['sourceId', 'sourceVersion', 'schedulerId', 'events'])
    || ![scheduler.sourceId, scheduler.sourceVersion, scheduler.schedulerId].every(text) || !Array.isArray(scheduler.events)) {
    throw new Error('invalid same-PA catch official scheduler Source');
  }
  const ids = new Set([sourceId, scheduler.sourceId, operative.causeActionSourceId]);
  if (ids.size !== 3) throw new Error('same-PA catch official Source identity collision');
  let fenced = false;
  for (const event of scheduler.events) {
    if (!fields(event, ['sourceId', 'sourceVersion', 'schedulerId', 'kind']) || !text(event.sourceId) || !text(event.sourceVersion) || !text(event.schedulerId)
      || event.schedulerId !== scheduler.schedulerId || typeof event.kind !== 'string' || !['advance_tick', 'next_play_fence'].includes(event.kind)
      || ids.has(event.sourceId) || fenced) throw new Error('same-PA catch official scheduler journal differs');
    ids.add(event.sourceId); fenced = event.kind === 'next_play_fence';
  }
  const opening = deriveSamePaCatchOfficialOpening(input), profile = actualLiveAdjudicationProfile(match.ruleProfileId, input.policy ?? null);
  let ledger = opening.ledger, evaluationTick = opening.evaluationTick;
  const result = () => ({ ledger, evaluationTick, originalOperativeLedger: opening.originalOperativeLedger,
    appealApplicability: opening.appealApplicability });
  const pending = (pendingReasons: readonly string[]): SamePaCatchOfficial => freeze({ ...result(), kind: 'pending' as const, pendingReasons });
  if (input.reviewed) {
    const review = input.reviewed;
    // The recording Source IDs may differ. The exact snapshots and imported
    // original call, including its original clock/provenance, may not.
    const facts = (value: PlayAdjudicationLedger) => value.events.filter(e =>
      ['CorrectRuleSnapshotRecorded', 'UnresolvedCorrectRuleSnapshotRecorded', 'OwnedLiveCallImported'].includes(e.kind))
      .map(({ eventId: _eventId, ...event }) => event);
    if (review.kind !== 'official_ready' || review.pendingReasons.length || json(facts(review.seed.ledger)) !== json(facts(opening.ledger))
      || json(review.ruleProfile) !== json(profile) || review.cursor.tick < evaluationTick) throw new Error('reserved catch reviewed ledger or original seed differs');
    ledger = review.ledger; evaluationTick = review.cursor.tick;
  } else if (opening.pendingReasons.length) return pending(opening.pendingReasons);
  // Empty bases have no original tag-up participant. Independently owned
  // stationary runners never left their original bases. Neither proof creates
  // an appeal window or expires one from a field horizon.
  for (const event of scheduler.events) {
    if (event.kind === 'advance_tick') {
      if (evaluationTick === Number.MAX_SAFE_INTEGER) throw new Error('same-PA catch official scheduler clock overflow');
      evaluationTick++;
    }
    try {
      ledger = advanceRuleProfileOfficialWindows(ledger, ledger.revision, { profile,
        boundary: event.kind === 'advance_tick' ? 'expiration' : 'next_play_fence', tick: evaluationTick,
        eventIdPrefix: event.sourceId, inningEnding: operative.onFieldCall.ruling.outsAfter === 3 });
    } catch (error) {
      if (error instanceof Error && ['official-state window remains open under RuleProfile', 'same-tick appeal boundary is unresolved'].includes(error.message)) return pending([error.message]);
      throw error;
    }
    if (event.kind === 'next_play_fence') {
      if (getOfficialStateWindows(ledger).some(w => w.closedAtTick === null)) return pending(['official_window_open']);
      ledger = closeOfficialPlay(ledger, ledger.revision, { eventId: event.sourceId + ':close', closureId: event.sourceId + ':closure', tick: evaluationTick });
    }
  }
  return fenced ? freeze({ ...result(), kind: 'closed' as const }) : pending(['official_next_play_fence_required']);
};
