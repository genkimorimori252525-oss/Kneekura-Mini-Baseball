import { appendFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { initialQualifiedHeadsV135, prepareInitialQualifiedDecisionV135, readInitialQualifiedDecisionV135 } from './InitialQualifiedPitchV135.test-support';

/** Stage A is genuine qualification -> first-pitch decision, not joint physical
 * execution. Stage B will consume this SAME database via original Owners. */
it.skipIf(process.env.BASEBALL_INITIAL_QUALIFIED_STAGE_V135 === 'B')('IQP135-A admits an explicitly qualified measured first-pitch SWING and reopens its exact original decision without consuming heads twice', () => {
  const start = Date.now(), stage = (name: string) => {
    const record = { name, elapsedMs: Date.now() - start };
    process.stdout.write('IQP135-A-stage ' + name + ' ' + record.elapsedMs + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IQP135-A-stages.jsonl', JSON.stringify(record) + '\n');
  };
  const result = prepareInitialQualifiedDecisionV135(stage);
  expect(result.decision.calculation.status).toBe('READY');
  expect(result.decision.calculation.commitment).toMatchObject({ action: 'SWING', trajectory: null });
  expect(result.prefix.modelReference.sourceId).toBe('authored-native-match:measured-batting:model:field-v137');
  expect(result.decision.calculation.commitment?.sampledTrajectoryV1).toMatchObject({
    provenance: { clipId: 'obp-123_6' }, transform: { rotation: { x: 0, z: 0 }, scale: 1 },
  });
  expect(result.decision.calculation.commitment?.sampledTrajectoryV1?.frames).toHaveLength(137);
  expect(result.decision.motionIssued).toBe(false);
  const before = initialQualifiedHeadsV135(result.prefix.path);
  stage('provider-free-decision-reopen-start');
  const restored = readInitialQualifiedDecisionV135(result.manifestPath);
  deepStrictEqual(restored.decision, result.decision);
  expect(initialQualifiedHeadsV135(result.prefix.path)).toBe(before);
  expect(restored.prefix.path).toBe(result.prefix.path);
  stage('provider-free-decision-reopen-ready');
}, 180_000);
