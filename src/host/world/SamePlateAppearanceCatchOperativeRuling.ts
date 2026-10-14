import { validateActualFairCatchStationaryRunners, type ActualFairCatchStationaryOccupiedRunners } from '../../core/adjudication/ActualFairCatchScoring';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { validateActualFairCatchOccupiedRunnerEvidence, type ActualFairCatchOccupiedRunnerEvidence } from '../../core/rules/FairCatchRunnerOutcome';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordUnresolvedCorrectRuleSnapshot, recordOnFieldCall } from '../../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { ReceivedUmpireCaughtOutReception } from '../../core/sim/fielding/ReceivedUmpireDefenderReplanTypes';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaCatchActionInput, type AcceptedSamePaCatchAction } from './SamePlateAppearanceCatchCommunicationSource';
import type { deriveSamePaFairCatchRuleBasis } from './SamePlateAppearanceFairCatchRuleBasis';
import type { samePaCatchCommunicationObservationAt } from './SamePlateAppearanceCatchCommunication';

/** Native supplies the separately authenticated original action and its own
 * historical rule view. The catch ruling follows the
 * accepted judgment; the correct snapshot is never used to select that action. */
export const deriveSamePaCatchOperativeRuling = (raw: Readonly<{ action: AcceptedSamePaCatchAction; originalMatch: CanonicalMatchState;
  batterRunnerId: string; basisTick: number; basisEvidenceRevision: number; fairCatch: ReturnType<typeof deriveSamePaFairCatchRuleBasis>;
  occupiedRunners?: ActualFairCatchStationaryOccupiedRunners; occupiedRunnerEvidence?: ActualFairCatchOccupiedRunnerEvidence }>) => {
  const { action, originalMatch: match, batterRunnerId, basisTick, basisEvidenceRevision, fairCatch, occupiedRunners, occupiedRunnerEvidence } = cloneInert(raw);
  samePaCatchActionInput(action, action.sourceId);
  if (!batterRunnerId || !Number.isInteger(match.outs) || match.outs < 0 || match.outs > 2
    || !Number.isSafeInteger(basisTick) || basisTick < 0 || basisTick > action.calledAt.tick
    || !Number.isSafeInteger(basisEvidenceRevision) || basisEvidenceRevision < 0) throw new Error('catch operative ruling requires original scope');
  if (action.judgment === 'not_caught') return freeze({ kind: 'active' as const, runnerId: batterRunnerId,
    causeActionSourceId: action.sourceId, onFieldCall: null, ledger: null });
  if (Object.values(match.bases).some(id => id !== null)) {
    const history = occupiedRunnerEvidence?.runners[0]?.bases[0]?.history ?? occupiedRunners?.runners[0]?.history;
    if (!history || quantizeEventTick(history.originTick, history.endElapsedSeconds, history.ticksPerSecond) !== basisTick)
      throw new Error('occupied caught action requires original stationary runner rule ownership');
    if (occupiedRunnerEvidence) validateActualFairCatchOccupiedRunnerEvidence({ originalMatch: match, batterRunnerId,
      originTick: history.originTick, ticksPerSecond: history.ticksPerSecond, endElapsedSeconds: history.endElapsedSeconds,
      runnerEvidence: occupiedRunnerEvidence });
    else validateActualFairCatchStationaryRunners({ originalMatch: match, batterRunnerId, originTick: history.originTick,
      ticksPerSecond: history.ticksPerSecond, endElapsedSeconds: history.endElapsedSeconds, occupiedRunners });
  } else if (occupiedRunners || occupiedRunnerEvidence) throw new Error('empty caught action has unexpected occupied proof');
  let ledger = createPlayAdjudicationLedger({ playId: match.playId, ruleProfileId: match.ruleProfileId, playEnd: null });
  const basis = { eventId: action.sourceId + ':rule-evidence', tick: basisTick, snapshotId: action.sourceId + ':rule-snapshot', evidenceRevision: basisEvidenceRevision };
  ledger = fairCatch.kind === 'same_pa_fair_catch_rule_basis_v1'
    ? recordCorrectRuleSnapshot(ledger, ledger.revision, { ...basis, ruling: fairCatch.correctRuling })
    : recordUnresolvedCorrectRuleSnapshot(ledger, ledger.revision, { ...basis, reason: 'insufficient_evidence' });
  // This is the legal content of the independently accepted caught action.
  // It is not physical proof that the judgment was correct or a runner stopped.
  const ruling = { outsAfter: match.outs + 1, basesAfter: { ...match.bases }, scoredRunnerIds: [] as readonly [] };
  const onFieldCall = { callId: action.sourceId, tick: action.calledAt.tick, basisSnapshotId: basis.snapshotId,
    basisEvidenceRevision, ruling };
  ledger = recordOnFieldCall(ledger, ledger.revision, { ...onFieldCall, eventId: action.sourceId + ':on-field-call' });
  return freeze({ kind: 'retired' as const, runnerId: batterRunnerId, causeActionSourceId: action.sourceId,
    at: action.calledAt, onFieldCall, ledger });
};
export type SamePaCatchOperativeRuling = ReturnType<typeof deriveSamePaCatchOperativeRuling>;
/** The out-profile adapter carries the real call's legal meaning only after its
 * genuine receipt. A not-caught message cannot become a SAFE-at-first payload. */
export const samePaCaughtOutReception = (operative: SamePaCatchOperativeRuling,
  result: ReturnType<typeof samePaCatchCommunicationObservationAt>): ReceivedUmpireCaughtOutReception | null => {
  if (operative.kind !== 'retired' || result.kind !== 'received') return null;
  const received = result.received, content = received.event.content;
  if (content.judgment !== 'caught' || content.actionSourceId !== operative.causeActionSourceId
    || content.calledAt.tick !== operative.onFieldCall.tick || content.calledAt.originTick !== operative.at.originTick
    || content.calledAt.elapsedSeconds !== operative.at.elapsedSeconds) throw new Error('received catch and original operative OUT differ');
  return freeze({ kind: 'received', receivedAt: result.receivedAt, order: null,
    received: { ...received, event: { ...received.event, content: { callSourceId: content.actionSourceId, call: 'out',
      calledAt: content.calledAt, onFieldCall: operative.onFieldCall } } } });
};
