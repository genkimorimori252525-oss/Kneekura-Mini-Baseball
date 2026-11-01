import { appendFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { initialQualifiedHeadsV135, prepareInitialQualifiedDecisionV135, readInitialQualifiedDecisionV135 } from './InitialQualifiedPitchV135.test-support';

/** Fresh same-DB actual Owner gate. This one prospective synthetic target is
 * fixed before day1; no empirical athlete calibration or contact is assumed.
 * Stage A is a first-pitch decision, not joint physical adoption/contact. */
it('IQP138-A authenticates a newly practiced contact-aim candidate and its exact first-pitch decision after reopen', () => {
  const start = Date.now(), stage = (name: string) => {
    const record = { name, elapsedMs: Date.now() - start };
    process.stdout.write('IQP138-A-stage ' + name + ' ' + record.elapsedMs + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IQP138-A-stages.jsonl', JSON.stringify(record) + '\n');
  };
  const result = prepareInitialQualifiedDecisionV135(stage, { contactAimV138: {
    version: 'measured_bat_contact_aim_v138', lateralOffsetM: 0, verticalOffsetM: -.01, maximumOffsetM: .02,
  } });
  expect(result.decision.calculation.status).toBe('READY');
  expect(result.decision.calculation.commitment).toMatchObject({ action: 'SWING', trajectory: null });
  expect(result.prefix.modelReference.sourceId).toBe('authored-native-match:measured-batting:model:contact-aim-v138');
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
