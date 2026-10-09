import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall, openOfficialStateWindow,
  closeOfficialStateWindow, closeOfficialPlay, getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveClosedNonLiveMatchState } from '../../core/adjudication/NonLiveOfficialApplication';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaTerminalEndpoint } from './SamePlateAppearanceTerminalEndpoint';

/** The authenticated endpoint retains the real dead-ball end. As in the
 * original foul-terminal owner, only the official application uses a distinct
 * non-live ledger. No event, assigned judgment, count or physical fact changes. */
export const deriveSamePaTerminalFoulApplication = (endpoint: Pick<SamePaTerminalEndpoint,
  'actor' | 'timeline' | 'officialLedger' | 'context' | 'physicalCompletedAtTick' | 'fairCatch'>) => {
  const { timeline, officialLedger: original, context } = endpoint, physicalEnd = original.playEnd;
  const foul = timeline.events.at(-1), originalClosure = getOfficialPlayClosure(original);
  if (endpoint.fairCatch || context?.kind !== 'strikeout' || timeline.status.kind !== 'strikeout'
    || foul?.kind !== 'FoulBattedBallResolved' || foul.payload.resolution.kind !== 'uncaught_foul'
    || !foul.payload.resolution.ballDead || foul.payload.resolution.countResult.kind !== 'strikeout'
    || foul.payload.resolution.countResult.cause !== 'foul_bunt'
    || json(timeline.status.terminalCount) !== json(foul.payload.resolution.countResult.terminalCount)
    || !physicalEnd || physicalEnd.reason !== 'dead_ball' || physicalEnd.tick !== foul.tick
    || physicalEnd.tick !== timeline.lastEventTick || physicalEnd.tick !== endpoint.physicalCompletedAtTick
    || !originalClosure || originalClosure.finalRuling.source !== 'on_field_call'
    || original.playId !== timeline.playId || original.playId !== endpoint.actor.match.playId
    || original.ruleProfileId !== endpoint.actor.match.ruleProfileId) {
    throw new Error('reserved terminal foul requires its original dead-ball bunt strikeout and assigned closure');
  }
  let adjudication = createPlayAdjudicationLedger({ playId: original.playId, ruleProfileId: original.ruleProfileId, playEnd: null });
  for (const event of original.events) {
    const common = { eventId: event.eventId, tick: event.tick };
    if (event.kind === 'CorrectRuleSnapshotRecorded') adjudication = recordCorrectRuleSnapshot(adjudication, adjudication.revision, { ...common, ...event.snapshot });
    else if (event.kind === 'OnFieldCallRecorded') adjudication = recordOnFieldCall(adjudication, adjudication.revision, { ...common, ...event.call });
    else if (event.kind === 'OfficialStateWindowOpened') adjudication = openOfficialStateWindow(adjudication, adjudication.revision,
      { ...common, windowId: event.windowId, windowKind: event.windowKind });
    else if (event.kind === 'OfficialStateWindowClosed') adjudication = closeOfficialStateWindow(adjudication, adjudication.revision,
      { ...common, windowId: event.windowId, reason: event.reason });
    else if (event.kind === 'OfficialPlayClosed') adjudication = closeOfficialPlay(adjudication, adjudication.revision,
      { ...common, closureId: event.closureId });
    else throw new Error('reserved terminal foul has an unsupported original official event');
  }
  const closure = getOfficialPlayClosure(adjudication);
  if (json(adjudication.events) !== json(original.events) || !closure
    || json({ ...closure, playEnd: physicalEnd }) !== json(originalClosure)) throw new Error('reserved terminal foul application changed its original official journal');
  // The existing strikeout application validates the canonical out/base/score
  // consequence, including occupied bases and third-out inning progression.
  deriveClosedNonLiveMatchState({ match: endpoint.actor.match, timeline, context, adjudication });
  return freeze({ adjudication, proof: { kind: 'same_pa_terminal_foul_application_v1' as const, physicalEnd,
    originalLedgerHash: hash(original), applicationLedgerHash: hash(adjudication) } });
};
