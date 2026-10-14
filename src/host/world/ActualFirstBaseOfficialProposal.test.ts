import { expect, it, vi } from 'vitest';
import type { AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

// This exercises fixture proposal composition only. Lower owner and kinematics
// substitutes are explicit; no Native authentication or physical result is claimed.
const observed = vi.hoisted(() => ({ proposals: [] as unknown[], prefixes: [] as unknown[], returned: [] as unknown[], discoveries: 0 }));
vi.mock('./OwnedMotionKnownWorkFromSqlite', () => ({ ownedMotionKnownWorkFromSqlite: () =>
  [{ playerId: 'p1', decisionSourceId: `current-decision-${++observed.discoveries}`, motorSourceId: null }] }));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: (_ids: unknown, prefix: { executions: { source: { sourceId: string } }[] }) => {
  observed.prefixes.push(prefix);
  return [{ playerId: 'p1', activeCommand: { proposalPredecessor: prefix.executions.at(-1)!.source.sourceId } }];
} }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({ read: () => null }) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({ openSqliteBattedWorldFieldExecutionStore: (
  _path: string, _fields: unknown, authority: { readAcceptedExecution(id: string): AcceptedBattedWorldFieldExecution },
) => ({ accept: (id: string) => {
  const source = authority.readAcceptedExecution(id); observed.proposals.push(source);
  const value = { source, execution: { field: { motion: { world: { moment: { ball: { tick: 13 } } } } } } };
  observed.returned.push(value); return value;
} }) }));
vi.mock('./SqliteActualLiveRuleConsumptionStore', () => ({ openSqliteActualLiveRuleConsumptionStore: () => ({ accept: () => ({}) }) }));
vi.mock('./SqliteActualFirstBaseUmpireStore', () => ({ openSqliteActualFirstBaseUmpireStore: () => ({
  acceptSetup: () => undefined, observe: () => ({}), advanceCall: (id: string) => ({ source: { sourceId: id },
    schedule: id === 'scheduled-operative-call' ? { kind: 'scheduled' } : { kind: 'called', call: 'out' } }),
}) }));
vi.mock('./SqliteActualCommunicationStore', () => ({ openSqliteActualCommunicationStore: () => { throw new Error('proposal test stop before communication'); } }));
import { attachActualFirstBaseOfficialFixture, type ActualFirstBaseOfficialRoot } from './ActualFirstBaseOfficialAttachment.test-support';

it('builds the post-call proposal from the returned due execution and still discovers current work', () => {
  const race = { source: { sourceId: 'field-first-base-race' }, execution: { kind: 'first_base_race',
    field: { motion: { world: { moment: { ball: { tick: 10 } } } } } } };
  const baseField = { source: { sourceId: 'field' }, response: { touch: { worldContact: { flight: { source: { execution: { ballFlightParameters: { ticksPerSecond: 1_000_000 } } } } } } },
    geometry: { geometry: { baseGeometry: { bases: { first: { region: { center: { x: 1, y: 0, z: 0 } } } } } } } };
  const originalPrefix = { baseField, fields: [baseField], executions: [race] }, prefixReads: string[] = [];
  const root = { f: { db: {}, track: <T>(value: T) => value }, pitchId: 'pitch', retainedRace: race,
    runtime: { gameId: 'game', membership: { participants: [{ playerId: 'p1' }] } }, baseField,
    captured: { source: { sourceId: 'capture' } }, prefix: (through: string) => {
      prefixReads.push(through);
      if (through !== race.source.sourceId) throw new Error('proposal reread the returned due prefix');
      return originalPrefix;
    } } as unknown as ActualFirstBaseOfficialRoot;
  expect(() => attachActualFirstBaseOfficialFixture('fixture-only', root)).toThrow('proposal test stop before communication');
  expect(prefixReads).toEqual(['field-first-base-race']);
  expect(observed.discoveries).toBe(2);
  const [due, final] = observed.proposals as AcceptedBattedWorldFieldExecution[];
  expect([due.previousExecutionSourceId, final.previousExecutionSourceId]).toEqual(['field-first-base-race', 'actual-call-due-cut']);
  expect(final.action).toMatchObject({ kind: 'owned_motion_v2', knownWork: [{ decisionSourceId: 'current-decision-2' }],
    contributions: [{ kind: 'retained', command: { proposalPredecessor: 'actual-call-due-cut' } }] });
  const second = observed.prefixes[1] as typeof originalPrefix;
  expect(second.baseField).toBe(baseField); expect(second.fields).toBe(originalPrefix.fields);
  expect(second.executions[0]).toBe(race); expect(second.executions[1]).toBe(observed.returned[0]);
  expect(originalPrefix.executions).toEqual([race]);
});
