import type { DurableFoulTerminalCompletedApplication } from './ActualFoulTerminalPostPlayCompletion';
import type { OfficialPendingOrigin, PersistOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import type { NonLiveOfficialContext } from '../../core/adjudication/NonLiveOfficialApplication';
import type { derivePhysicalNonLiveClosure } from '../../core/adjudication/PhysicalNonLiveClosure';
import type { GameCompletionPolicy, OfficialGameProgression, OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { AcceptedFoulOfficialSession, AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent, FoulOfficialEndReference } from './ActualFoulOfficial';
import type { FoulEndedEvidence, FoulOwnerReference } from './ActualFoulPlayEnd';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { foulOfficialRevision as revision, foulOfficialDigest as digest } from './ActualFoulOfficialSource';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type AcceptedFoulTerminalApplication = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_foul_terminal_non_live_application_v1';
  physicalEndReference: FoulOfficialEndReference;
  officialReference: Readonly<{ sessionSourceId: string; revision: number; headSourceId: string; headHash: string }>;
  applicationId: string; legalGamePolicy: GameCompletionPolicy | null;
}>;
export type FoulTerminalPhysicalPitchReference = FoulOwnerReference & Readonly<{
  owner: 'physical_pitch_progress_actions'; sourceVersion: string; progressRevision: number;
}>;
type Actor = NonNullable<DurablePhysicalPitch['frame']['batterActor']>;
export type FoulTerminalParticipant = Readonly<{
  binding: Actor['binding']; person: Actor['person']; role: 'batter' | 'defender';
  registeredPosition: DurablePhysicalPitch['frame']['world']['defenders'][number]['registeredPosition'] | null;
}>;
export type FoulTerminalBoundGamePolicy = Readonly<{
  seasonId: string; homeClubId: string; awayClubId: string; policy: GameCompletionPolicy; venueBinding: OfficialGameVenueBinding;
}>;
/** Immutable prepared data. The terminal owner adds its authenticated origin
 * only when applying this body; it never grants a next-play execution right. */
export type FoulTerminalApplicationBody = Readonly<{
  mode: 'non_live_pending_post_play_v1'; kind: 'non_live'; matchId: string; applicationId: string;
  expectedDurableRevision: number; match: CanonicalMatchState; timeline: CanonicalPlateAppearanceTimeline;
  adjudication: PlayAdjudicationLedger; context: NonLiveOfficialContext; game: FoulTerminalBoundGamePolicy | null;
}>;
export type FoulTerminalApplicationProposal = Readonly<{
  kind: 'terminal_non_live_projected'; officialApplied: false; source: AcceptedFoulTerminalApplication;
  gameId: string; playId: number; physicalPitchSourceId: string; firstPhysicalPitchSourceId: string;
  runtimeSourceId: string; scopeId: string; physicalEndReference: FoulOfficialEndReference; physicalEndArchiveHash: string;
  consumptionReference: FoulOwnerReference; physicalPitchReference: FoulTerminalPhysicalPitchReference;
  originalPhysicalPitchPrefix: readonly FoulTerminalPhysicalPitchReference[];
  originalPhysicalTimeline: CanonicalPlateAppearanceTimeline; composedTimelineHash: string;
  officialObligation: FoulEndedEvidence['dispositionObligations']['official']; originalSuccessorKey: string;
  officialReference: AcceptedFoulTerminalApplication['officialReference']; originalOfficialRevision: number;
  originalActivationJson: string | null; sessionSource: AcceptedFoulOfficialSession;
  callSource: AcceptedFoulOfficialEvent; callIntent: AcceptedFoulOfficialIntent;
  assignmentSourceHash: string; intentSourceHash: string; acceptedOfficialPolicyHash: string;
  originalOfficialJournalHash: string; originalOfficialLedger: PlayAdjudicationLedger;
  originalOfficialLedgerHash: string; applicationLedgerHash: string;
  fixture: OfficialGameVenueBinding; seasonFixture: Actor['worldFixture']; participants: readonly FoulTerminalParticipant[];
  clock: Readonly<{ originTick: number; ticksPerSecond: number; openingTick: number; openingElapsedSeconds: number;
    ruleTick: number; closureTick: number }>;
  applicationBody: FoulTerminalApplicationBody; nextMatch: CanonicalMatchState;
  scoring: ReturnType<typeof derivePhysicalNonLiveClosure>['scoring'];
  projectedGameProgression: OfficialGameProgression | Readonly<{ kind: 'same_half_no_game_boundary' }>;
}>;
export type FoulTerminalApplicationPending = Readonly<{
  kind: 'pending'; source: AcceptedFoulTerminalApplication; pendingReasons: readonly string[];
}>;
export type FoulTerminalApplicationEvaluation = FoulTerminalApplicationProposal | FoulTerminalApplicationPending;
export type FoulTerminalApplicationAuthority = Readonly<{
  readAcceptedApplication(sourceId: string): unknown;
}>;
export type DurableFoulTerminalApplicationQueue = Readonly<{
  source: AcceptedFoulTerminalApplication; proposal: FoulTerminalApplicationProposal;
  status: 'QUEUED'; officialApplied: false; result: null;
}>;
export type FoulTerminalAppliedResult = Readonly<{
  sourceId: string; official: PersistOfficialPendingNonLiveResult; acknowledgement: null;
}>;
export type DurableFoulTerminalAppliedPending = Readonly<{
  source: AcceptedFoulTerminalApplication; proposal: FoulTerminalApplicationProposal;
  status: 'OFFICIAL_APPLIED_PENDING_POST_PLAY'; officialApplied: true; result: FoulTerminalAppliedResult;
}>;
export type FoulTerminalOfficialAcknowledgement = Readonly<{
  version: 'actual_foul_terminal_official_acknowledgement_v1'; acknowledgementId: string;
  obligationKey: string; originalSuccessorKey: string; scope: FoulTerminalApplicationProposal['officialObligation']['scope'];
  status: 'consumed'; consumer: OfficialPendingOrigin;
  physicalEndReference: FoulOfficialEndReference; consumptionReference: FoulOwnerReference;
  officialReference: AcceptedFoulTerminalApplication['officialReference'];
  applicationReference: Readonly<{ owner: 'applications'; matchId: string; applicationId: string; closureId: string;
    previousPlayId: number; durableRevision: number; requestHash: string; receiptHash: string }>;
}>;
export type FoulTerminalAcknowledgedResult = Readonly<{
  sourceId: string; official: PersistOfficialPendingNonLiveResult; acknowledgement: FoulTerminalOfficialAcknowledgement;
}>;
export type DurableFoulTerminalAcknowledgedApplication = Readonly<{
  source: AcceptedFoulTerminalApplication; proposal: FoulTerminalApplicationProposal;
  status: 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY'; officialApplied: true; result: FoulTerminalAcknowledgedResult;
}>;
export type DurableFoulTerminalApplication = DurableFoulTerminalApplicationQueue | DurableFoulTerminalAppliedPending
  | DurableFoulTerminalAcknowledgedApplication | DurableFoulTerminalCompletedApplication;
export type SqliteActualFoulTerminalApplicationStore = Readonly<{
  evaluate(sourceId: string): FoulTerminalApplicationEvaluation;
  enqueue(sourceId: string): FoulTerminalApplicationPending | DurableFoulTerminalApplication;
  read(sourceId: string): DurableFoulTerminalApplication | null;
  close(): void;
}>;

/** Capture inert bytes before inspecting fields. Policy validity matches the
 * existing GameCompletionPolicy; an omitted maximum remains omitted. */
export const actualFoulTerminalApplicationInput = (raw: unknown, sourceId: string): AcceptedFoulTerminalApplication => {
  const s = cloneInert(raw) as AcceptedFoulTerminalApplication;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'physicalEndReference', 'officialReference', 'applicationId', 'legalGamePolicy'])
    || s.sourceId !== sourceId || ![sourceId, s.sourceVersion, s.applicationId].every(id)
    || s.capability !== 'actual_foul_terminal_non_live_application_v1') throw new Error('invalid accepted foul terminal application Source');
  const end = s.physicalEndReference, official = s.officialReference;
  if (!fields(end, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash']) || end.owner !== 'actual_foul_play_ends'
    || ![end.sourceId, end.sourceVersion].every(id) || ![end.sourceHash, end.snapshotHash].every(digest)) {
    throw new Error('invalid foul terminal physical end reference');
  }
  if (!fields(official, ['sessionSourceId', 'revision', 'headSourceId', 'headHash'])
    || ![official.sessionSourceId, official.headSourceId].every(id) || !revision(official.revision) || !digest(official.headHash)) {
    throw new Error('invalid foul terminal official reference');
  }
  const p = s.legalGamePolicy;
  if (p !== null && (!fields(p, ['version', 'minimumInnings', 'tiesAllowed',
    ...(p && Object.hasOwn(p, 'maximumInnings') ? ['maximumInnings'] : [])])
    || !id(p.version) || !Number.isSafeInteger(p.minimumInnings) || p.minimumInnings <= 0 || typeof p.tiesAllowed !== 'boolean'
    || p.maximumInnings !== undefined && (!Number.isSafeInteger(p.maximumInnings) || p.maximumInnings < p.minimumInnings || !p.tiesAllowed))) {
    throw new Error('invalid accepted foul terminal game policy');
  }
  return freeze(s);
};

export { actualFoulTerminalPostPlaySetupInput, type AcceptedFoulTerminalPostPlaySetup,
  type FoulTerminalPostPlayReference, type FoulTerminalPostPlaySetupAuthority } from './ActualFoulTerminalPostPlaySetup';

export {actualFoulTerminalPostPlayBoundaryInput,actualFoulTerminalPostPlayInput,type AcceptedFoulTerminalPostPlayBoundary,type AcceptedFoulTerminalPostPlayInput} from './ActualFoulTerminalPostPlayBoundary';
