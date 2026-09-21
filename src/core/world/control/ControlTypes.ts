/** Existing baseball capabilities are registered by the host; these IDs are not UI/menu definitions. */
export interface ControlSeed {
  readonly schemaVersion?: 1;
  readonly revision: number;
  readonly controllerId: string;
  readonly controlledClubId: string | null;
  readonly domainIds: readonly string[];
  readonly manualDomainIds: readonly string[];
}
export interface HumanControlState extends ControlSeed { readonly schemaVersion: 1 }
export interface HumanControlChange {
  readonly expectedRevision: number;
  readonly controlledClubId: string | null;
  readonly manualDomainIds: readonly string[];
}
export interface HumanControlChanged {
  readonly kind: 'HUMAN_CONTROL_CHANGED';
  readonly controllerId: string;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly previousClubId: string | null;
  readonly controlledClubId: string | null;
  readonly previousManualDomainIds: readonly string[];
  readonly manualDomainIds: readonly string[];
}
export type DecisionOrigin = 'MANAGER_AUTONOMOUS' | 'MANAGER_DELEGATED' | 'HUMAN_OVERRIDE';
/** An immutable opportunity supplied by the legal-action/world owner, not by an untrusted client. */
export interface DecisionOpportunity {
  readonly decisionId: string;
  readonly contextId: string;
  readonly worldRevision: number;
  readonly clubId: string;
  readonly domainId: string;
  readonly managerId: string;
  readonly appointmentId: string;
  readonly legalActionIds: readonly string[];
}
export type DecisionActor =
  | { readonly kind: 'HUMAN'; readonly controllerId: string }
  | { readonly kind: 'MANAGER'; readonly managerId: string; readonly appointmentId: string; readonly traceId: string };
export interface DecisionSubmission {
  readonly decisionId: string;
  readonly contextId: string;
  readonly expectedControlRevision: number;
  readonly expectedWorldRevision: number;
  readonly actionId: string;
  readonly actor: DecisionActor;
}
export type DecisionAuthority =
  | { readonly kind: 'HUMAN_REQUIRED'; readonly controllerId: string }
  | { readonly kind: 'MANAGER'; readonly origin: Exclude<DecisionOrigin, 'HUMAN_OVERRIDE'>;
      readonly managerId: string; readonly appointmentId: string };
/** Captured at selection time. Action/context/trace IDs must resolve to immutable host-owned data. */
export interface ControlledDecision {
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly contextId: string;
  readonly worldRevision: number;
  readonly clubId: string;
  readonly domainId: string;
  readonly controlRevision: number;
  readonly managerId: string;
  readonly appointmentId: string;
  readonly controlledBy: string | null;
  readonly manualDomain: boolean;
  readonly origin: DecisionOrigin;
  readonly actor: DecisionActor;
  readonly actionId: string;
}
/** Evidence of actual execution; selection itself is not execution. Supplied by the world owner. */
export interface ExecutedDecision {
  readonly executionId: string;
  readonly decisionId: string;
  readonly contextId: string;
  readonly actionId: string;
  readonly worldRevision: number;
  readonly eventIds: readonly string[];
}
export interface DecisionWorldEvidence extends ExecutedDecision {
  readonly clubId: string;
  readonly domainId: string;
  readonly origin: DecisionOrigin;
  readonly managerId: string;
  readonly appointmentId: string;
}
export interface ManagerSelfChosenEvidence extends DecisionWorldEvidence {
  readonly origin: Exclude<DecisionOrigin, 'HUMAN_OVERRIDE'>;
  readonly traceId: string;
}
export interface DecisionEvidenceProjection {
  readonly worldEvidence: DecisionWorldEvidence;
  /** For BOTH self-chosen strategy learning and manager decision-quality/skill attribution. */
  readonly managerSelfChosenEvidence: ManagerSelfChosenEvidence | null;
}
export type ControlRejectionCode =
  | 'INVALID_INPUT' | 'UNKNOWN_DOMAIN' | 'STALE_CONTROL_REVISION' | 'STALE_WORLD_REVISION'
  | 'DECISION_CONTEXT_MISMATCH' | 'REVISION_EXHAUSTED' | 'HUMAN_NOT_AUTHORIZED' | 'HUMAN_INPUT_REQUIRED'
  | 'STALE_MANAGER_APPOINTMENT' | 'ILLEGAL_ACTION'
  | 'EXECUTION_MISMATCH' | 'EXECUTION_PREDATES_DECISION';
export interface ControlRejection { readonly code: ControlRejectionCode; readonly path?: string }
export type ControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ControlRejection };
export type ControlChangeResult =
  | { readonly ok: true; readonly state: HumanControlState; readonly events: readonly HumanControlChanged[] }
  | { readonly ok: false; readonly state: HumanControlState; readonly events: readonly []; readonly reason: ControlRejection };
