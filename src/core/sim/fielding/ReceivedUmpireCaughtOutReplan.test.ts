import { expect, expectTypeOf, it } from 'vitest';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireCallContent, type ReceivedUmpireCaughtOutContent,
  type ReceivedUmpireDefenderReplanInput } from './ReceivedUmpireDefenderReplan';
import { buildPlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import { quantizeEventTick } from '../ExactEventTime';
import type { ReceivedCommunication } from '../perception/Communication';

it('keeps all occupied bases in caught information through the common defender policy without widening the legacy first-base payload', () => {
  expectTypeOf<ReceivedUmpireCallContent['onFieldCall']['ruling']['basesAfter']['second']>().toEqualTypeOf<null>();
  expectTypeOf<ReceivedUmpireCallContent['onFieldCall']['ruling']['basesAfter']['third']>().toEqualTypeOf<null>();
  const at = (elapsedSeconds:number) => ({originTick:1000,elapsedSeconds,tick:quantizeEventTick(1000,elapsedSeconds,1000)});
  const calledAt=at(0.119),receivedAt=at(0.1202),available=at(0.1204);
  const received:ReceivedCommunication<ReceivedUmpireCaughtOutContent>={event:{sourceId:'umpire',targetScope:{kind:'nearby'},kind:'callout',issuedAt:calledAt.tick,
    content:{callSourceId:'call',call:'out',calledAt,onFieldCall:{callId:'call',tick:calledAt.tick,basisSnapshotId:'original-rule',basisEvidenceRevision:1,
      ruling:{outsAfter:1,basesAfter:{first:'runner-1',second:'runner-2',third:'runner-3'},scoredRunnerIds:[]}}}},receivedAt:receivedAt.tick,confidence:0.8};
  const perceived=buildPlayerPerceivedWorldState<null>({observerId:'defender',observationTime:available.tick,
    attention:{target:{kind:'ball'},focusedSinceTick:1000},ball:null,players:[],communications:[received],knownContext:null});
  const input:ReceivedUmpireDefenderReplanInput<ReceivedUmpireCaughtOutContent>={processSourceId:'response',physicalPitchSourceId:'pitch',playerId:'defender',receiverRole:'defender',
    ticksPerSecond:1000,currentCut:at(0.126),communication:{sourceId:'communication',hash:'communication-hash',originCommunicationSourceId:'origin-call',callSourceId:'call'},
    observation:{sourceId:'observation',hash:'observation-hash',at:available,perceived,reception:{kind:'received',receivedAt,order:null,received}},
    predecessor:{originDecisionSourceId:'decision',originObservationSourceId:'prior-observation',originObservationHash:'prior-observation-hash',
      availability:at(0.1002),informationOrder:null,observationSourceId:'prior-observation',observationHash:'prior-observation-hash',observedThrough:at(0.110),decisionTick:1106,issuedAt:at(0.110),
      command:{sourceId:'command',hash:'command-hash',selected:{intent:{kind:'hold'},localPriority:0.1,evidenceAvailableAt:1100,evidenceKinds:['accepted_contextual_priorities']},target:null},
      motor:{sourceId:'motor',hash:'motor-hash',adoptionSourceId:'adoption',adoptedAt:at(0.110)}},
    model:{sourceId:'model',hash:'model-hash',situationalAwareness:0.5,firstStepAbility:0.5,minimumCueConfidence:0.5,communicationTrust:0.75,
      decisionTimingParameters:{minimumDecisionDelayTicks:2,maximumDecisionDelayTicks:6,fixedProcessingOffsetTicks:1},
      firstStepTimingParameters:{minimumFirstStepDelayTicks:2,maximumFirstStepDelayTicks:4,fixedMotorOffsetTicks:1}},
    contextualPlan:{sourceId:'plan',hash:'plan-hash',priorities:{ballPursuitPriority:0.35,baseCoverPriorities:[],relayPriority:0,backupPriority:0,deepCoveragePriority:0,holdPriority:0.1}},
    policy:{sourceId:'policy',hash:'policy-hash',availableAt:at(0.119),profiles:{out:{ballPursuitPriority:0.1,holdPriority:0.9},safe:null}},previous:null};
  const before=JSON.stringify(input),result=deriveReceivedUmpireDefenderReplan(input),reception=result.originEvidence?.observation.reception;
  expect(result).toMatchObject({trigger:'communication_received',semantic:'ready',selected:{intent:{kind:'hold'}}});
  expect(reception?.kind).toBe('received');
  if(reception?.kind!=='received')throw new Error('original caught reception missing');
  expect(reception.received).toEqual(received);
  expect(reception.received.event.content.onFieldCall.ruling.basesAfter).toEqual({first:'runner-1',second:'runner-2',third:'runner-3'});
  expect(JSON.stringify(input)).toBe(before);
});
