import type { ClubResult, ClubManagerAppointment, ClubWorldState, ClubTransitionEvent } from './ClubTypes';
import { commandReader } from './ClubCommands';
import { financeReader, institutionalReader, managerReader, planReader, readState } from './ClubSchemas';
import { managerFromReferences } from './ClubSeed';
import { applyClubCommand } from './ClubLifecycle';
import { attempt, enumeration, fail, ids, integer, list, nullable, object, same, text, type Reader } from './ClubValidation';

const signedInteger: Reader<number> = (input, path) => {
  if (typeof input !== 'number' || !Number.isSafeInteger(input)) fail('INVALID_INPUT', path); return input;
};
const bucketTotals = object({ payroll: signedInteger, transfers: signedInteger, academy: signedInteger,
  scouting: signedInteger, coaching: signedInteger, medical: signedInteger, facilities: signedInteger });
const summaryReader = object({ scope: enumeration(['ACCOUNTING_ONLY']), careerId: text, clubId: text, season: integer,
  revision: integer, currency: text, cash: integer, debt: integer, receivedRevenue: integer, paidOperatingCosts: integer,
  outstandingCommitments: integer, cashAfterReserve: signedInteger, budgetAllocated: bucketTotals, budgetHeadroom: bucketTotals });
const snapshotReader = object({ snapshotId: text, careerId: text, clubId: text, season: integer, effectiveDay: integer,
  plan: planReader, finance: financeReader, financeSummary: summaryReader, institutional: institutionalReader,
  resultRefs: object({ domesticResultRef: text, continentalResultRef: nullable(text), rosterSummaryRef: text,
    fanbaseSummaryRef: text, derivedSummaryRef: nullable(text) }),
  openingManager: nullable(managerReader), closingManager: nullable(managerReader), managerAppointmentEventIds: ids });
const eventReader: Reader<ClubTransitionEvent> = object({ kind: enumeration(['CLUB_CHANGED']), command: commandReader,
  afterRevision: integer, historySnapshots: list(snapshotReader, x => x.snapshotId) });

export const getCurrentClubManager = (input: ClubWorldState): ClubResult<ClubManagerAppointment | null> =>
  attempt(() => managerFromReferences(readState(input).live.references));
/** Checkpoint + accepted events only. Returns no intermediate state when any event fails verification. */
export function replayClubEvents(checkpoint: ClubWorldState, input: unknown): ClubResult<ClubWorldState> {
  return attempt(() => {
    let state = readState(checkpoint);
    const events = list(eventReader, x => x.command.eventId)(input, 'events');
    for (const event of events) {
      const result = applyClubCommand(state, event.command);
      if (!result.ok) fail(result.reason.code, result.reason.path);
      if (!same(event, result.event)) fail('EVENT_MISMATCH');
      state = result.state;
    }
    return state;
  });
}
