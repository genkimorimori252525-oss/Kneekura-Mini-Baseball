import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import type { NextNonLivePlateAppearanceActivation } from '../../core/adjudication/NonLiveOfficialApplication';
import type { PersistOfficialPendingNonLiveResult } from '../OfficialPendingPostPlay';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import type { AcceptedFoulTerminalApplication, FoulTerminalApplicationProposal,
  FoulTerminalAcknowledgedResult } from './ActualFoulTerminalApplication';
import type { AcceptedFoulTerminalPostPlaySetup, FoulTerminalPostPlayReference } from './ActualFoulTerminalPostPlaySetup';

/** Archive contracts only. These types grant no parser, writer or readiness
 * capability; each stored value needs its database-bound owner authentication. */
export type FoulTerminalControllerRetirement = Readonly<{
  version:'actual_foul_terminal_controller_retirement_v1'; kind:'rule_system_retire_original_play'; sourceId:string;
  previousPlayId:number; nextPlayId:number; atTick:number;
  physicalEndReference:AcceptedFoulTerminalApplication['physicalEndReference'];
  retired:readonly Readonly<{ playerId:string; personId:string; activeCommand:ActualPlayerKinematics['activeCommand'];
    ownedMotionCoverage:NonNullable<ActualPlayerKinematics['ownedMotionCoverage']>|null }>[];
  retainedOriginalFutureWork:FoulEndedEvidence['futureWork'];
}>;
export type FoulTerminalCompletedWorkloadEffect = Readonly<{
  playerId:string; activitySourceId:string; beforeRevision:number; afterRevision:number; activityHash:string; afterHash:string;
}>;
export type FoulTerminalPostPlayCompletionPayload = Readonly<{
  version:'actual_foul_terminal_post_play_completion_v1'; completionId:string;
  source:AcceptedFoulTerminalPostPlaySetup; sourceHash:string; terminalReference:FoulTerminalPostPlayReference;
  officialReference:Readonly<{ applicationId:string; receiptHash:string; pendingPostPlayHash:string; acknowledgementHash:string }>;
  scoringReference:Readonly<{ scoringApplicationId:string; rowHash:string }>;
  workloadReference:Readonly<{ terminalSourceId:string; planHash:string; participantEffects:readonly FoulTerminalCompletedWorkloadEffect[] }>;
  controllerRetirement:FoulTerminalControllerRetirement; activation:NextNonLivePlateAppearanceActivation; nextWorld:CanonicalWorldSnapshot;
}>;
export type FoulTerminalPostPlayCompletion = FoulTerminalPostPlayCompletionPayload & Readonly<{ snapshotHash:string }>;
export type FoulTerminalPostPlayCompletionReference = Readonly<{
  version:'actual_foul_terminal_post_play_completion_v1'; completionId:string; terminalSourceId:string;
  setupSourceId:string; sourceHash:string; snapshotHash:string;
}>;
export type PersistOfficialCompletedTerminalResult = PersistOfficialPendingNonLiveResult & Readonly<{
  completion:FoulTerminalPostPlayCompletionReference; activation:NextNonLivePlateAppearanceActivation; nextWorld:CanonicalWorldSnapshot;
}>;
export type FoulTerminalCompletedResult = FoulTerminalAcknowledgedResult & Readonly<{ completion:FoulTerminalPostPlayCompletion }>;
export type DurableFoulTerminalCompletedApplication = Readonly<{
  source:AcceptedFoulTerminalApplication; proposal:FoulTerminalApplicationProposal;
  status:'POST_PLAY_COMPLETED_CONTINUING'; officialApplied:true; result:FoulTerminalCompletedResult;
}>;
export type FoulTerminalReadinessReference = Readonly<{
  version:'actual_foul_terminal_next_play_readiness_v1'; terminalSourceId:string; setupSourceId:string;
  completionId:string; snapshotHash:string; applicationId:string; gameId:string; previousPlayId:number;
}>;
/** Internal authenticated effect view for readiness; the settlement wire stays
 * owned by the existing workload owner, rather than being duplicated here. */
export type FoulTerminalCompletionEvidence = Readonly<{
  archive:DurableFoulTerminalCompletedApplication;
  settlement:Readonly<{ kind:'complete'; careerId:string; gameId:string; playId:number; gameDay:number;
    participants:readonly Readonly<{ playerId:string; personId:string; clubId:string;
      after:import('../../core/world/development/PlayerWorkloadRecovery').PlayerWorkloadRecoveryState; applied:boolean }>[] }>;
}>;
export type FoulTerminalPostPlayCompletionEvidenceReader = Readonly<{
  read(terminalSourceId:string):DurableFoulTerminalCompletedApplication|null;
  readWithEffects(terminalSourceId:string):FoulTerminalCompletionEvidence|null;
}>;
