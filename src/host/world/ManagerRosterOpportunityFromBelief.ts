import type { IssueRosterOpportunityInput,
  DurableRosterOpportunity, SqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import type { SqliteManagerBeliefHistoryStore } from
  './SqliteManagerBeliefHistoryStore';

export type ManagerRosterOpportunityFromBeliefInput = Omit<
  IssueRosterOpportunityInput, 'selectionAgent' | 'managerBeliefRevision'> & Readonly<{
    managerId: string;
    appointmentId: string;
  }>;

/** Issues from the durable Manager Person belief, never a caller's agent state. */
export const issueManagerRosterOpportunityFromBelief = (
  rosterStore: SqliteManagerRosterDecisionStore,
  historyStore: SqliteManagerBeliefHistoryStore,
  input: ManagerRosterOpportunityFromBeliefInput,
  expectedBeliefRevision?: number,
): DurableRosterOpportunity => {
  const { managerId, appointmentId, ...opportunity } = input;
  const person = expectedBeliefRevision === undefined ? historyStore.readHead(input.careerId, managerId)
    : historyStore.readAtRevision(input.careerId, managerId, expectedBeliefRevision);
  if (!person) {
    throw new Error('Manager Person belief head is absent; bootstrap from an issued opportunity');
  }
  return rosterStore.issueOpportunity({ ...opportunity,
    ...(expectedBeliefRevision === undefined ? {} : { managerBeliefRevision: expectedBeliefRevision }),
    selectionAgent: { managerId, appointmentId,
      state: person.agent } });
};
