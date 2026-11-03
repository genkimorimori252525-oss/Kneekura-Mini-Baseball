import { appendFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert';
import { expect, it } from 'vitest';
import { initialQualifiedHeadsV135, prepareInitialQualifiedDecisionV135, readInitialQualifiedDecisionV135 } from './InitialQualifiedPitchV135.test-support';

/** Same V138 prospective motor, pitch and AUTO decision. Only the separately
 * identified day1 synthetic observer has the predeclared narrower uncertainty.
 * This is Stage A; actual joint control/contact remains a separate Gate. */
it('IQP139-A authenticates the original qualified candidate and a first-pitch SWING using its separately owned controlled observer', () => {
  const start = Date.now(), stage = (name: string) => {
    const record = { name, elapsedMs: Date.now() - start };
    process.stdout.write('IQP139-A-stage ' + name + ' ' + record.elapsedMs + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IQP139-A-stages.jsonl', JSON.stringify(record) + '\n');
  };
  const result = prepareInitialQualifiedDecisionV135(stage, { controlledObservationV139: true, contactAimV138: {
    version: 'measured_bat_contact_aim_v138', lateralOffsetM: 0, verticalOffsetM: -.01, maximumOffsetM: .02,
  } });
  expect(result.decision.calculation.status).toBe('READY');
  expect(result.decision.calculation.commitment).toMatchObject({ action: 'SWING', trajectory: null });
  expect(result.prefix.modelReference.sourceId).toBe('authored-native-match:measured-batting:model:contact-aim-v138:controlled-observer-v139');
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
