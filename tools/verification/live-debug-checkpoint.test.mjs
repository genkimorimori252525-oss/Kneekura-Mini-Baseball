import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sealDebugCheckpoint, restoreDebugCheckpoint, verifyDebugCaseRuntime } from './live-debug-checkpoint.mjs';
import { stringifyDebugRecord } from './live-debug-record.mjs';

const scope = { caseId: 'case-a', coreSha256: 'a'.repeat(64),
  configurationText: stringifyDebugRecord({ seed: 3, innings: 9, players: [{ id: 'b', maximumSpeed: 40 }], clips: [{ id: 'same-id', values: [-0, 1] }] }),
  commands: [{ batting: 'take', managedTeam: 0 }] };
const continuation = { version: 'live_match_continuation_v116', pitchCount: 1, nextTick: 200,
  point: { x: -0 }, explicit: undefined, knowledge: [1 + Number.EPSILON] };

test('round trips a checkpoint through disk JSON with its exact local case and command history', () => {
  const envelope = sealDebugCheckpoint({ ...scope, continuation });
  assert.equal(envelope.authority, 'LOCAL_DEBUG_CHECKPOINT_NOT_NATIVE_ADMISSION');
  assert.equal(envelope.nextPitchOrdinal, 2);
  assert.deepEqual(restoreDebugCheckpoint({ ...scope, checkpoint: JSON.parse(JSON.stringify(envelope)) }), continuation);
});

test('rejects a different configuration even when seed, innings and IDs are identical', () => {
  const checkpoint = sealDebugCheckpoint({ ...scope, continuation });
  for (const configuration of [
    { seed: 3, innings: 9, players: [{ id: 'b', maximumSpeed: 41 }], clips: [{ id: 'same-id', values: [-0, 1] }] },
    { seed: 3, innings: 9, players: [{ id: 'b', maximumSpeed: 40 }], clips: [{ id: 'same-id', values: [-0, 2] }] },
  ]) assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint, configurationText: stringifyDebugRecord(configuration) }), /configuration differs/);
});

test('rejects another case, Core or command history and a stale pitch ordinal', () => {
  const checkpoint = sealDebugCheckpoint({ ...scope, continuation });
  assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint, caseId: 'case-b' }), /case differs/);
  assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint, coreSha256: 'b'.repeat(64) }), /Core differs/);
  assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint, commands: [{ batting: 'power', managedTeam: 0 }] }), /command prefix differs/);
  assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint, commands: [] }), /pitch ordinal differs/);
});

test('rejects altered continuation bytes and mismatching underlying Core pitch count', () => {
  const checkpoint = sealDebugCheckpoint({ ...scope, continuation });
  assert.throws(() => restoreDebugCheckpoint({ ...scope, checkpoint: { ...checkpoint, continuationText: '{}' } }), /continuation bytes differ/);
  assert.throws(() => sealDebugCheckpoint({ ...scope, continuation: { ...continuation, pitchCount: 0 } }), /Core pitch count differs/);
});

test('case runtime mismatches are rejected before any physical execution', () => {
  const runtime = { coreSha256: 'a'.repeat(64), backgroundRuntimeSha256: 'b'.repeat(64), browserVersion: '156.0' };
  assert.equal(verifyDebugCaseRuntime(runtime, runtime), undefined);
  for (const key of Object.keys(runtime)) assert.throws(() => verifyDebugCaseRuntime({ ...runtime, [key]: 'different' }, runtime), /debug case .* differs/);
});
