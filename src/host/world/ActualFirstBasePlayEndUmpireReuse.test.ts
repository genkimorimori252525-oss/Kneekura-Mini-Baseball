import { beforeEach, expect, it, vi } from 'vitest';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Narrow PlayEnd wiring only, never a Native physical-completion proof.
// Deterministic upstream projections reach the real operative-call branch.
const state = vi.hoisted(() => ({ prefix: null as any, scope: null as any, call: null as any,
  admissions: [] as any[], pairedReads: 0, graphReads: 0, readCalls: [] as string[], imported: [] as string[],
  queueComplete: false, lateError: null as null | 'call' | 'import' }));
vi.mock('./ActualLivePlayEvidenceFromSqlite', () => ({ actualLivePlayEvidenceFromSqlite: () => ({ derive: () => ({ scope: state.scope }) }) }));
vi.mock('./SqliteActualLivePlayRuntimeStore', () => ({ actualLiveRuntimeEvidenceFromSqlite: () => ({
  read: () => ({ source: { physicalPitchSourceId: 'pitch' }, gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash',
    membership: { scopeId: 'scope', participants: [], producers: [] } }),
  admissions: () => state.admissions,
}) }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({
  read: () => state.prefix.baseField, scope: () => state.prefix.fields,
}) }));
// Physical traversal itself is covered by ActualFirstBasePhysicalReadTraversal.test.ts.
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({ withBattedWorldPhysicalReadTraversal: <T>(_db: unknown, body: () => T) => body(),
  battedWorldFieldExecutionEvidenceFromSqlite: () => ({ scope: () => state.prefix.executions }) }));
vi.mock('./WholePlayPhysicalHistoryFromPrefix', () => ({ wholePlayPhysicalHistoryFromPrefix: () => ({
  origin: { ticksPerSecond: 1000, batterRunnerId: 'batter' }, cursor: {}, carrierPlayerId: 'defender',
}) }));
vi.mock('./BattedWorldFieldPhysicalPrefix', () => ({ battedWorldFieldPhysicalPrefix: () => ({ segments: [] }) }));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: () => [] }));
vi.mock('./ActualLivePlayInventoryFromSqlite', () => ({ actualLiveOwnerInstalled: () => true,
  actualLivePlayInventoryFromSqlite: () => ({ observations: [], decisions: [], motors: [] }),
}));
vi.mock('./ActualLiveRuleConsumptionFromSqlite', () => ({ actualLiveRuleConsumptionEvidenceFromSqlite: () => ({ read: () => ({
  source: { sourceId: 'rule', ruleExecutionSourceId: 'rule-cut' }, physicalPitchSourceId: 'pitch',
  consumption: { availableAt: { elapsedSeconds: 1 }, receiptId: 'rule-receipt' },
}) }) }));
vi.mock('./SqliteActualFirstBaseUmpireStore', async () => {
  const { actualFirstBaseOffensiveDisposition } = await import('./ActualFirstBaseUmpire');
  const available = () => { state.graphReads++; return state.call; };
  return { actualFirstBaseUmpireEvidenceFromSqlite: () => ({
    readAvailableCall: available,
    offensiveDisposition: () => actualFirstBaseOffensiveDisposition(available()),
    readAvailableCallWithDisposition: (_sourceId: string, _at: unknown) => {
      state.pairedReads++; const call = available();
      return { call, disposition: actualFirstBaseOffensiveDisposition(call) };
    },
    readCall: (sourceId: string) => {
      state.readCalls.push(sourceId);
      if (state.lateError === 'call') throw new Error('corrupt late admitted umpire call');
      return state.call;
    },
    importReferences: (sourceId: string) => {
      state.imported.push(sourceId);
      if (state.lateError === 'import') throw new Error('corrupt late umpire import reference');
      throw new Error('this pending-path projection cannot certify PlayEnd');
    },
  }) };
});
vi.mock('./ActualLivePlayQueueConsumersFromSqlite', () => ({ actualLivePlayQueueConsumersFromSqlite: () => ({ derive: () => ({
  successors: state.queueComplete ? [{ original: { kind: 'custody' }, consumption: null }] : [],
  ruleResultSuccessors: state.queueComplete ? [{ basisReceiptId: 'rule-receipt' }] : [],
}) }) }));
vi.mock('./SqliteActualCommunicationStore', () => ({ actualCommunicationEvidenceFromSqlite: () => ({ read: () => ({
  physicalPitchSourceId: 'pitch', source: { callSourceId: 'call', currentExecutionSourceId: 'execution' },
  evaluatedThrough: state.scope.at, recipients: [], emitted: true, pendingReason: null,
}) }) }));
import { actualFirstBasePlayEndEvidenceFromSqlite } from './ActualFirstBasePlayEndEvidenceFromSqlite';
const source = { sourceId: 'end', sourceVersion: 'v1', runtimeSourceId: 'runtime', baseFieldSourceId: 'field', executionSourceId: 'execution',
  ruleConsumptionSourceId: 'rule', umpireCallSourceId: 'call', communicationSourceId: 'communication' };
const db = { prepare: () => { throw new Error('light wiring test must not read the physical database'); } } as never;
beforeEach(() => {
  state.pairedReads = 0; state.graphReads = 0; state.readCalls = []; state.imported = [];
  state.queueComplete = false; state.lateError = null; state.admissions = [];
  const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: 0, throughTick: 1000, ticksPerSecond: 1000 });
  state.scope = { gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash', scopeId: 'scope', participation: 'supported_empty_base',
    participants: [], producers: [], physicalReferences: [], at: { originTick: 0, tick: 1000, elapsedSeconds: boundary.lastIncludedElapsedSeconds } };
  state.prefix = { baseField: { source: { sourceId: 'field' } }, fields: [], executions: [
    { revision: 1, source: { sourceId: 'rule-cut', action: { kind: 'first_base_race', custodyPolicy: 'release_exclusive_v1' } },
      execution: { kind: 'first_base_race', field: { motion: { world: { moment: { elapsedSeconds: 1 } } } },
        ballEvidence: { kind: 'grounded', territory: 'fair' }, groundRule: {}, pendingContacts: [] } },
    { revision: 2, source: { sourceId: 'execution', action: { kind: 'owned_motion_v2', checkpoint: { kind: 'retained_quantizer_bucket_v1' } } },
      execution: { kind: 'owned_motion_v2', composition: { mode: 'retained', quantizerBoundary: boundary }, operation: null,
        adoption: { status: 'checkpoint_reached' }, field: { motion: { world: { kind: 'moving' } } } } },
  ] };
  state.call = { source: { sourceId: 'call' }, observation: { physicalPitchSourceId: 'pitch', batterRunnerId: 'batter',
    source: { sourceId: 'observation', ruleExecutionSourceId: 'rule-cut' }, clock: { originTick: 0, ticksPerSecond: 1000 } },
    schedule: { kind: 'called', call: 'out', calledAtElapsedSeconds: 1 }, onFieldCall: {} };
});

it.each([
  ['out', 'canonical_successor_consumption_pending'], ['safe', 'offensive_actor_still_active'],
  ['absent', 'operative_call_retirement_pending'],
] as const)('uses one same-operation call/disposition pair and preserves %s pending bytes', (kind, reason) => {
  if (kind === 'absent') state.call = null; else state.call.schedule.call = kind;
  const expected = json({ source, kind: 'pending', playEnd: null, pendingReasons: [reason] });
  const owner = actualFirstBasePlayEndEvidenceFromSqlite(db);
  expect(json(owner.derive(source))).toBe(expected);
  expect([state.pairedReads, state.graphReads]).toEqual([1, 1]);
  expect(json(owner.derive(source))).toBe(expected);
  expect([state.pairedReads, state.graphReads]).toEqual([2, 2]);
});
it('keeps the operative retirement scope guard after the paired read', () => {
  state.call.observation.physicalPitchSourceId = 'other-pitch';
  expect(() => actualFirstBasePlayEndEvidenceFromSqlite(db).derive(source)).toThrow(/retirement scope differs/);
  expect([state.pairedReads, state.graphReads]).toEqual([1, 1]);
});
it.each(['call', 'import'] as const)('still rejects the later raw %s revalidation after pairing', lateError => {
  state.queueComplete = true; state.lateError = lateError;
  state.admissions = [{ owner: 'actual_first_base_umpire_calls', sourceId: 'earlier-scheduled-call' }];
  expect(() => actualFirstBasePlayEndEvidenceFromSqlite(db).derive(source)).toThrow(lateError === 'call'
    ? 'corrupt late admitted umpire call' : 'corrupt late umpire import reference');
  expect(state.readCalls).toEqual(['earlier-scheduled-call']);
  expect(state.imported).toEqual(lateError === 'call' ? [] : ['call']);
  expect([state.pairedReads, state.graphReads]).toEqual([1, 1]);
});
