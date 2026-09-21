import type { ClubChangeResult, ClubSeasonSnapshot, ClubWorldState } from './ClubTypes';
import { commandReader } from './ClubCommands';
import { readState, validateReferences } from './ClubSchemas';
import { reduceFinance } from './ClubFinance';
import { managerFromReferences } from './ClubSeed';
import { closeSeason, openSeason } from './ClubSeasons';
import { attempt, exact, fail, same } from './ClubValidation';

/** Entire command or no change. Persistence, event authenticity and cross-subsystem commits belong to the host. */
export function applyClubCommand(input: ClubWorldState, rawCommand: unknown): ClubChangeResult {
  const result = attempt(() => {
    let state = readState(input); const command = commandReader(rawCommand, 'command');
    if (command.careerId !== state.careerId || command.clubId !== state.identity.clubId) fail('WRONG_CLUB');
    if (command.expectedRevision !== state.revision) fail('STALE_REVISION');
    if (command.effectiveDay < state.effectiveDay) fail('BACKDATED_COMMAND');
    const afterRevision = exact([state.revision, 1], 'revision');
    const historySnapshots: ClubSeasonSnapshot[] = [];
    let changed = false;
    for (const op of command.operations) {
      const beforeOperation = state;
      if ('currency' in op) {
        state = { ...state, live: { ...state.live, finance: reduceFinance(state, op, command) } };
        changed = true;
        continue;
      }
      const institution = state.institutional;
      switch (op.kind) {
        case 'RENAME_CLUB':
          if (institution.brand.displayName !== op.displayName || institution.brand.shortName !== op.shortName) {
            state = { ...state, institutional: { ...institution, brand: { displayName: op.displayName, shortName: op.shortName,
              brandVersion: exact([institution.brand.brandVersion, 1], 'brandVersion') } } };
          }
          break;
        case 'RELOCATE_CLUB': state = { ...state, institutional: { ...institution, homeCityId: op.homeCityId } }; break;
        case 'CHANGE_OWNER': state = { ...state, institutional: { ...institution, owner: op.owner,
          capital: { ...institution.capital, ownershipBackingCapacity: op.ownershipBackingCapacity } } }; break;
        case 'REFORM_GOVERNANCE': state = { ...state, institutional: { ...institution, governanceRef: op.governanceRef } }; break;
        case 'REPLACE_STADIUM': state = { ...state, institutional: { ...institution, stadium: op.stadium } }; break;
        case 'UPDATE_FACILITIES': state = { ...state, institutional: { ...institution, facilities: op.facilities } }; break;
        case 'UPDATE_STRUCTURAL_CAPITAL': state = { ...state, institutional: { ...institution, capital: op.capital,
          structuralRevenueCapacity: op.structuralRevenueCapacity } }; break;
        case 'UPDATE_REFERENCES': {
          validateReferences(op.references, state.identity.clubId);
          for (const next of op.references.staffRoleLinks) {
            const previous = state.live.references.staffRoleLinks.find(x => x.appointmentId === next.appointmentId);
            if (previous && !same(previous, next)) fail('STATE_INCONSISTENT', 'appointmentId');
          }
          const changed = !same(managerFromReferences(state.live.references), managerFromReferences(op.references));
          const ids = state.live.managerAppointmentEventIds;
          state = { ...state, live: { ...state.live, references: op.references,
            managerAppointmentEventIds: changed && !ids.includes(command.eventId) ? [...ids, command.eventId] : ids } };
          break;
        }
        case 'CLOSE_SEASON': {
          if (historySnapshots.some(s => s.snapshotId === op.snapshotId)) fail('DUPLICATE_ID', 'snapshotId');
          const closed = closeSeason(state, op, command, afterRevision);
          state = closed.state; historySnapshots.push(closed.snapshot); break;
        }
        case 'OPEN_SEASON': state = openSeason(state, op, command); break;
        default: { const unreachable: never = op; return unreachable; }
      }
      changed = changed || !same(beforeOperation, state);
    }
    if (!changed) fail('NO_CHANGE');
    state = readState({ ...state, revision: afterRevision, effectiveDay: command.effectiveDay });
    return { state, event: { kind: 'CLUB_CHANGED' as const, command, afterRevision, historySnapshots } };
  });
  return result.ok ? Object.freeze({ ok: true, ...result.value }) : Object.freeze({ ok: false, state: input, reason: result.reason });
}
