import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall, closeOfficialPlay,
  getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { openRuleProfileOfficialStateWindow, advanceRuleProfileOfficialWindows } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { RuleProfile } from '../../core/rules/RuleProfile';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import type { DurableActualFoulRuleConsumption } from './ActualFoulRuleConsumption';
import type { AcceptedFoulOfficialSession, AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent,
  FoulOfficialProjection, FoulOfficialHandoff } from './ActualFoulOfficial';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Internal, freshly owner-authenticated input. A projection is never a durable
 * acknowledgement and no public writer accepts these facts from its caller. */
export type FoulOfficialFacts = Readonly<{
  source: AcceptedFoulOfficialSession; end: FoulEndedEvidence; count: DurableActualFoulRuleConsumption;
  match: CanonicalMatchState; ruleProfile: RuleProfile; cursor: FoulOfficialProjection['cursor'];
}>;
const rule = (f: FoulOfficialFacts) => ({ outsAfter: f.match.outs + (f.count.disposition.kind === 'terminal_strikeout' ? 1 : 0),
  basesAfter: f.match.bases, scoredRunnerIds: [] as string[] });
const snapshotId = (f: FoulOfficialFacts) => `actual_foul_count_rule:${f.count.source.sourceId}`;
type Body = Omit<FoulOfficialProjection,'headHash'|'kind'|'pendingReasons'>;
const finish = (f: FoulOfficialFacts, body: Body): FoulOfficialProjection => {
  const reasons: string[] = [];
  if (body.callIntent === null) reasons.push('accepted_official_call_missing');
  else if (body.callIntent.judgment === 'fair') reasons.push('fair_judgment_consequence_unimplemented');
  for (const kind of ['review','challenge'] as const) {
    const policy = f.ruleProfile.officialWindows?.[kind];
    if (!policy) reasons.push(`official_window_policy_unconfigured:${kind}`);
    else if (policy.available) reasons.push(`foul_window_owner_unimplemented:${kind}`);
  }
  for (const window of getOfficialStateWindows(body.ledger)) {
    if (window.closedAtTick === null) reasons.push(`official_window_open:${window.windowId}`);
  }
  if (body.officialCount?.kind === 'terminal_strikeout') reasons.push('terminal_official_application_unimplemented');
  const kind = body.handoff !== null ? 'ordinary_foul_handoff_ready' as const
    : body.officialCount?.kind === 'terminal_strikeout' ? 'terminal_foul_application_pending' as const : 'official_pending' as const;
  const value = { ...body, kind, pendingReasons: reasons };
  return freeze({ ...value, headHash: hash(value) });
};
export const initializeFoulOfficialProjection = (f: FoulOfficialFacts): FoulOfficialProjection => {
  const c = f.count, s = f.source, tick = f.cursor.tick;
  if (c.disposition.kind === 'pending_original_intent' || c.disposition.timeline === null) throw new Error('original foul intent is unavailable');
  let ledger = createPlayAdjudicationLedger({ playId:c.playId,ruleProfileId:f.ruleProfile.id,playEnd:f.end.playEnd });
  ledger = recordCorrectRuleSnapshot(ledger,ledger.revision,{ eventId:s.sourceId+':rule',tick,
    snapshotId:snapshotId(f),evidenceRevision:c.revision,ruling:rule(f) });
  for (const kind of ['appeal','review','challenge'] as const) if (f.ruleProfile.officialWindows?.[kind]?.available) {
    ledger = openRuleProfileOfficialStateWindow(ledger,ledger.revision,{ profile:f.ruleProfile,
      eventId:s.sourceId+':'+kind+'-open',tick,windowId:s.sourceId+':'+kind,windowKind:kind });
  }
  return finish(f,{ source:s,revision:0,headSourceId:s.sourceId,gameId:c.gameId,playId:c.playId,
    firstPhysicalPitchSourceId:c.firstPhysicalPitchSourceId,physicalPitchSourceId:c.physicalPitchSourceId,
    consumptionReference:{ owner:'actual_foul_rule_consumptions',sourceId:c.source.sourceId,sourceHash:hash(c.source),snapshotHash:hash(c) },
    officialObligation:f.end.dispositionObligations.official,cursor:f.cursor,ledger,callIntent:null,officialCount:null,handoff:null });
};
export const advanceFoulOfficialProjection = (f: FoulOfficialFacts, previous: FoulOfficialProjection,
  source: AcceptedFoulOfficialEvent, intent: AcceptedFoulOfficialIntent | null): FoulOfficialProjection => {
  if (source.sessionSourceId !== previous.source.sourceId || source.expectedRevision !== previous.revision
    || source.parent.sourceId !== previous.headSourceId || source.parent.snapshotHash !== previous.headHash) {
    throw new Error('foul official session parent or revision differs');
  }
  if (previous.revision === Number.MAX_SAFE_INTEGER || previous.handoff !== null) throw new Error('foul official journal is closed or revision overflows');
  const action = source.action;
  let { ledger, cursor, callIntent, officialCount } = previous;
  let handoff: FoulOfficialHandoff | null = null;
  if (action.kind === 'record_call') {
    if (!intent) throw new Error('accepted foul official intent is missing');
    const assignment = previous.source.assignment;
    if (callIntent !== null) throw new Error('foul official original call already has an owner');
    if (intent.sourceId !== action.intentSourceId || intent.sessionSourceId !== source.sessionSourceId
      || intent.gameId !== previous.gameId || intent.playId !== previous.playId || intent.physicalPitchSourceId !== previous.physicalPitchSourceId
      || intent.assignmentSourceId !== assignment.sourceId || !assignment.officialIds.includes(intent.officialId)) {
      throw new Error('foul official intent scope or assignment authority differs');
    }
    callIntent = intent;
    if (intent.judgment === 'foul') {
      ledger = recordOnFieldCall(ledger,ledger.revision,{ eventId:source.sourceId+':call',callId:source.sourceId,tick:cursor.tick,
        basisSnapshotId:snapshotId(f),basisEvidenceRevision:f.count.revision,ruling:rule(f) });
      // Count was already applied once by C. Official authority references that
      // composed result; it does not append a second foul event or rewrite P.
      officialCount = f.count.disposition;
    }
  } else {
    if (intent !== null || action.schedulerId !== previous.source.assignment.schedulerId) throw new Error('foul official scheduler authority differs');
    if (action.kind === 'advance_tick') {
      if (cursor.tick === Number.MAX_SAFE_INTEGER || cursor.offsetTicks === Number.MAX_SAFE_INTEGER) throw new Error('foul official clock overflow');
      cursor = { ...cursor,tick:cursor.tick+1,offsetTicks:cursor.offsetTicks+1 };
    } else {
      if (!callIntent) throw new Error('foul official call is required before the next-pitch fence');
      // Unsupported review/challenge ownership remains an open dependency even
      // if a configured deadline passes. No synthetic review decision is made.
      const unsupported = ['review','challenge'].some(k => f.ruleProfile.officialWindows?.[k as 'review'|'challenge']?.available);
      if (!unsupported) {
        try {
          ledger = advanceRuleProfileOfficialWindows(ledger,ledger.revision,{ profile:f.ruleProfile,boundary:'next_play_fence',
            tick:cursor.tick,eventIdPrefix:source.sourceId,inningEnding:false });
        } catch (error) {
          if (!(error instanceof Error) || !['official-state window remains open under RuleProfile','same-tick appeal boundary is unresolved'].includes(error.message)) throw error;
        }
      }
      if (callIntent.judgment === 'foul' && officialCount?.kind === 'continue_same_pa' && !unsupported
        && !getOfficialStateWindows(ledger).some(w => w.closedAtTick === null)) {
        ledger = closeOfficialPlay(ledger,ledger.revision,{ eventId:source.sourceId+':close',closureId:source.sourceId+':closure',tick:cursor.tick });
        const child = previous.officialObligation;
        handoff = { version:'actual_foul_official_count_handoff_v1',
          acknowledgementId:json(['actual_foul_official_count_handoff_v1',child.obligationKey,source.sourceId]),
          obligationKey:child.obligationKey,originalSuccessorKey:f.count.successor.successorKey,scope:child.scope,status:'consumed',
          consumer:{ owner:'actual_foul_official_handoffs',sourceId:source.sourceId,sourceHash:hash(source) },
          physicalEndReference:previous.source.physicalEndReference,consumptionReference:previous.consumptionReference,
          assignmentSourceHash:hash(previous.source.assignment),intentSourceHash:hash(callIntent),officialLedgerHash:hash(ledger),
          composedTimelineHash:hash(officialCount.timeline),acceptedAtTick:cursor.tick };
      }
    }
  }
  return finish(f,{ source:previous.source,revision:previous.revision+1,headSourceId:source.sourceId,
    gameId:previous.gameId,playId:previous.playId,firstPhysicalPitchSourceId:previous.firstPhysicalPitchSourceId,
    physicalPitchSourceId:previous.physicalPitchSourceId,consumptionReference:previous.consumptionReference,
    officialObligation:previous.officialObligation,cursor,ledger,callIntent,officialCount,handoff });
};
