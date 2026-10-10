import { getOwnedLiveAppealRightsAdmissions, getPendingOwnedLiveAppealImports,
  recordCorrectRuleSnapshot, recordOnFieldCall } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveActualFairCatchOccupiedRunnerOutcome } from '../../core/rules/FairCatchRunnerOutcome';
import type { AcceptedActualPostPlayReviewEvent } from './ActualPostPlayReviewSource';
import { originalPostPlayCall, postPlayOpenState, postPlayFairCatchRunnerRuling,
  type ActualPostPlayReviewProjection } from './ActualPostPlayReviewState';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** This bounded judgment explicitly accepts the complete authenticated rule
 * result. It does not model arbitrary erroneous appeal calls or a new umpire.
 * Import and rights admission have already preserved the original occurrences. */
export const acceptPostPlayLiveAppealResult = (previous: ActualPostPlayReviewProjection, source: AcceptedActualPostPlayReviewEvent) => {
  const action = source.action, proof = previous.seed.fairCatchRunnerOutcome;
  if (action.kind !== 'accept_live_appeal_result' || !previous.source.reservedCatchSeed || !proof?.runnerEvidence.appeals?.length
    || previous.events.some(e => e.source.action.kind === 'accept_live_appeal_result')) throw new Error('original unaccepted appeal runner outcome required');
  const appeals = proof.runnerEvidence.appeals, latest = postPlayOpenState(previous.ledger).latestCorrectRule;
  if (action.callId !== originalPostPlayCall(previous.ledger).call.callId || action.basisSnapshotId !== latest.snapshotId
    || action.basisEvidenceRevision !== latest.evidenceRevision || !postPlayFairCatchRunnerRuling(previous.seed, previous.ledger))
    throw new Error('official appeal acceptance requires its current authenticated correct snapshot');
  if (action.executionReferences.length !== appeals.length || appeals.some(a =>
    !action.executionReferences.some(pin => json(pin) === json(a.executionReference))))
    throw new Error('official appeal acceptance must name every original outcome execution');
  const outcome = deriveActualFairCatchOccupiedRunnerOutcome(proof);
  if (outcome.kind === 'pending') throw new Error('official appeal acceptance runner outcome remains unresolved');
  const imports = previous.ledger.events.filter(e => e.kind === 'OwnedLiveAppealImported');
  const admissions = getOwnedLiveAppealRightsAdmissions(previous.ledger);
  if (getPendingOwnedLiveAppealImports(previous.ledger).length || imports.length !== appeals.length || admissions.length !== appeals.length)
    throw new Error('official appeal acceptance requires every original import and admitted right');
  const pinOf = (p: typeof imports[number]['provenance']['execution']) => ({ owner: p.owner, sourceId: p.sourceId,
    sourceHash: p.sourceHash, snapshotHash: p.snapshotHash });
  for (const appeal of appeals) {
    const imported = imports.find(e => json(pinOf(e.provenance.execution)) === json(appeal.executionReference));
    const admitted = admissions.find(e => json(pinOf(e.provenance.originalImport.execution)) === json(appeal.executionReference));
    const resolved = outcome.appeals?.find(e => json(e.executionReference) === json(appeal.executionReference));
    if (!imported || !admitted || !resolved || json(imported.attempt) !== json(appeal.attempt)
      || json(imported.complianceEvidence) !== json(appeal.complianceEvidence)
      || json(imported.provenance.clock) !== json(appeal.clock)
      || imported.provenance.indicatedAtElapsedSeconds !== appeal.indicatedAtElapsedSeconds
      || imported.provenance.executedAtElapsedSeconds !== appeal.executedAtElapsedSeconds
      || json(admitted.provenance.originalImport) !== json(imported.provenance)
      || json(admitted.evidence) !== json(appeal.evidence) || json(admitted.disposition) !== json(resolved.disposition))
      throw new Error('official appeal acceptance original import, rights or result differs');
  }
  // Rights admission invalidated the prior rule snapshot even when gameplay is
  // unchanged. Recompute its successor, then use Core's real on-field-call path.
  const snapshotId = source.sourceId + ':appeal-rule-snapshot', evidenceRevision = latest.evidenceRevision + 1;
  let ledger = recordCorrectRuleSnapshot(previous.ledger, previous.ledger.revision, { eventId: source.sourceId + ':appeal-rule',
    tick: previous.cursor.tick, snapshotId, evidenceRevision, ruling: outcome.correctRuling });
  ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: source.sourceId + ':appeal-call-recorded',
    callId: source.sourceId + ':appeal-call', tick: previous.cursor.tick, basisSnapshotId: snapshotId,
    basisEvidenceRevision: evidenceRevision, ruling: outcome.correctRuling });
  return ledger;
};
