import type {
  AcceptedRunnerVisibleContactWaitPolicy,
  AcceptedRunnerEventView,
  RunnerCaptureMoment,
} from '../../core/sim/running/RunnerPartialTagUpWaitContracts.test-support';

/** Stage A only; contact capture/selection require their subsequent reviewed RED. */
export type RunnerContactWaitPolicyAdmission = Readonly<{
  source: AcceptedRunnerVisibleContactWaitPolicy;
  sourceHash: string; observationModelHash: string;
}>;
export type RunnerContactWaitViewAdmission = Readonly<{
  source: AcceptedRunnerEventView; sourceHash: string;
  policyHash: string; observationModelHash: string;
  actorHash: string; recipientBindingHash: string;
  registeredAt: RunnerCaptureMoment;
  admission: 'prospective_before_dependent_pitch';
}>;
export type RunnerContactWaitPolicyViewAuthority = Readonly<{
  readAcceptedPolicy(sourceId: string): AcceptedRunnerVisibleContactWaitPolicy | null;
  readAcceptedView(sourceId: string): AcceptedRunnerEventView | null;
}>;
export type RunnerContactWaitPolicyViewStore = Readonly<{
  acceptPolicy(sourceId: string): RunnerContactWaitPolicyAdmission;
  readPolicy(sourceId: string): RunnerContactWaitPolicyAdmission | null;
  /** Reject distinct overlapping actor/player views before contact; no latest/favorable selection. */
  acceptView(sourceId: string): RunnerContactWaitViewAdmission;
  readView(sourceId: string): RunnerContactWaitViewAdmission | null;
  close(): void;
}>;
export type RunnerContactWaitPolicyViewModule = Readonly<{
  openSqliteRunnerContactWaitStore(
    databasePath: string,
    authority: RunnerContactWaitPolicyViewAuthority,
  ): RunnerContactWaitPolicyViewStore;
}>;
