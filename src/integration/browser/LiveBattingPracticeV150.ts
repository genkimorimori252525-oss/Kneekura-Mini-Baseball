import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import {
  cloneMatchInputWithMeasuredCatalogV68, createLiveBaseballMatchWorkerV116,
  type LiveIssuedPitchV1, type LiveMatchContinuationV116, type LiveMatchInputV1, type LivePitchCommandV1,
} from './LiveBaseballMatchV1';

/** Only the current offense is managed. Opponent pitch selection remains AUTO. */
export type LiveBattingPracticeRequestV150 = Readonly<Pick<LivePitchCommandV1, 'batting'> &
  Pick<LivePitchCommandV1, 'swingInstructionV121'|'battingDirectionRequestV149'|'observedSpinTrialV236'|'managerCommunicationV122'|'batterEvidenceV122'|'baserunning'|'randomnessV152'>>;
export type LiveBattingPracticeCandidateV150 = Readonly<{
  version:'live_batting_practice_candidate_v150';revision:number;acceptedPitchCount:number;
  record:LiveIssuedPitchV1;beforeContinuation:LiveMatchContinuationV116;afterContinuation:LiveMatchContinuationV116;
}>;
/** Local debug data, not Native authentication. Observer history is saved separately. */
export type LiveBattingPracticeCaptureV150 = Readonly<{
  version:'live_batting_practice_capture_v150';configuration:LiveMatchInputV1;continuation:LiveMatchContinuationV116;revision:number;
}>;
type HostInspection = ReturnType<ReturnType<typeof createLiveBaseballMatchWorkerV116>['inspect']>;
type CandidateOwner = Readonly<{
  session:object;revision:number;record:LiveIssuedPitchV1;continuation:LiveMatchContinuationV116;inspection:HostInspection;
}>;
const candidates = new WeakMap<LiveBattingPracticeCandidateV150, CandidateOwner>();
const frozen = <T>(value:T):T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen);Object.freeze(value);
  }
  return value;
};
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw new Error('live batting practice v150: ' + message);
}
/** Both trees have already crossed the inert boundary; compare every field,
 * including the full measured catalog, without depending on property order. */
function sameConfiguration(one:unknown, two:unknown):boolean {
  if (Object.is(one, two)) return true;
  if (!one || !two || typeof one !== 'object' || typeof two !== 'object' || Array.isArray(one) !== Array.isArray(two)) return false;
  const left = Object.keys(one), right = Object.keys(two);
  return left.length === right.length && left.every(key => Object.hasOwn(two, key) &&
    sameConfiguration((one as Record<string, unknown>)[key], (two as Record<string, unknown>)[key]));
}
function readCapture(raw:unknown):LiveBattingPracticeCaptureV150 {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(raw)), 'inert capture required');
  const configuration = Object.getOwnPropertyDescriptor(raw, 'configuration'), rest = {};
  assert(configuration?.enumerable && 'value' in configuration, 'inert capture configuration required');
  for (const key of Reflect.ownKeys(raw)) if (key !== 'configuration') Object.defineProperty(rest, key, Object.getOwnPropertyDescriptor(raw, key)!);
  const header = cloneInert(rest) as Omit<LiveBattingPracticeCaptureV150, 'configuration'>;
  assert(Object.keys(header).sort().join('|') === 'continuation|revision|version' &&
    header.version === 'live_batting_practice_capture_v150' && Number.isSafeInteger(header.revision) && header.revision >= 0,
  'invalid capture');
  return { ...header, configuration:cloneMatchInputWithMeasuredCatalogV68(configuration.value) };
}
const requestFields = ['batting', 'swingInstructionV121', 'battingDirectionRequestV149', 'observedSpinTrialV236', 'managerCommunicationV122', 'batterEvidenceV122', 'baserunning', 'randomnessV152'];
function commandFor(raw:LiveBattingPracticeRequestV150, offense:0|1):LivePitchCommandV1 {
  const request = cloneInert(raw);
  assert(request && typeof request === 'object' && !Array.isArray(request) &&
    Object.keys(request).every(key => requestFields.includes(key)), 'offense-only request required');
  return { ...request, managedTeam:offense, pitchType:'auto', location:'auto' };
}

/** A speculative worker owns each preview. Only accepting its authentic,
 * current-revision candidate installs the Host-captured continuation.
 * acceptedRecords/history cover this instance only; capture does not restore them. */
export function createLiveBattingPracticeV150(rawInput:LiveMatchInputV1, rawResume?:unknown) {
  const configuration = frozen(cloneMatchInputWithMeasuredCatalogV68(rawInput)), session = {},
    resume = rawResume === undefined ? undefined : readCapture(rawResume);
  assert(resume === undefined || sameConfiguration(configuration, resume.configuration), 'resume configuration differs');
  const initialHost = createLiveBaseballMatchWorkerV116(configuration, resume?.continuation);
  let continuation = initialHost.captureContinuationV116(), inspection = initialHost.inspect(), revision = resume?.revision ?? 0,
    acceptedRecords:readonly LiveIssuedPitchV1[] = Object.freeze([]);
  assert(revision === continuation.pitchCount, 'capture revision differs from accepted pitch count');

  function preview(request:LiveBattingPracticeRequestV150):LiveBattingPracticeCandidateV150 {
    const command = commandFor(request, continuation.match.half === 'top' ? 0 : 1),
      worker = createLiveBaseballMatchWorkerV116(configuration, continuation), record = worker.issuePitch(command),
      afterContinuation = worker.captureContinuationV116(), afterInspection = worker.inspect(),
      candidate:LiveBattingPracticeCandidateV150 = Object.freeze({ version:'live_batting_practice_candidate_v150', revision,
        acceptedPitchCount:continuation.pitchCount, record, beforeContinuation:continuation, afterContinuation });
    candidates.set(candidate, { session, revision, record, continuation:afterContinuation, inspection:afterInspection });
    return candidate;
  }
  function accept(candidate:LiveBattingPracticeCandidateV150):LiveIssuedPitchV1 {
    const owned = candidates.get(candidate);
    assert(owned?.session === session && owned.revision === revision, 'candidate is foreign, stale or already accepted');
    const nextRecords = Object.freeze([...acceptedRecords, owned.record]);
    // All throwing simulation/validation work completed in preview. Publish together.
    continuation = owned.continuation;inspection = owned.inspection;acceptedRecords = nextRecords;revision++;
    return owned.record;
  }
  function capture():LiveBattingPracticeCaptureV150 {
    return Object.freeze({ version:'live_batting_practice_capture_v150', configuration, continuation, revision });
  }
  function inspect() {
    return Object.freeze({ ...inspection, practiceVersion:'live_batting_practice_v150' as const, configuration, continuation,
      revision, acceptedRecords, history:acceptedRecords });
  }
  const issuePitch = (request:LiveBattingPracticeRequestV150) => accept(preview(request));
  return Object.freeze({ preview, accept, issuePitch, inspect, capture });
}
