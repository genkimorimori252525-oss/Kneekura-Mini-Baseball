import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll } from 'vitest';
import { beginFieldDiagnostic, endFieldDiagnostic } from './BattedFieldDiagnosticTrace.test-support';
import { geometryFileHash } from './ActualLiveBaseGeometryContinuation.test-support';
// Run the exact existing F01 assertion and normal owner call sequence. The
// diagnostic config alone injects observation wrappers at the closed allowlist.
import './BattedEpisodeV2FieldContinuation.acceptance';

let started = false;
beforeAll(() => {
  const manifest = process.env.EPISODE_PARTICIPANT_INPUT; assert(manifest);
  const input = JSON.parse(readFileSync(manifest, 'utf8'));
  assert.equal(input.schema, 'episode_binding_v2_field_input_v1');
  beginFieldDiagnostic(join(tmpdir(), 'field-phase-events.jsonl'), { sourceIdentity: input.sourceIdentity,
    manifestSha256: geometryFileHash(manifest), inputSha256: input.input.sha256, fixtureSha256: input.acceptedField.sha256,
    originalFailedTerminalSha256: '5476a80d50965960ee93857fcfaee85a13bec91ffe076dc164d3a850df9f7ea7',
    originalFailedCredit: 0, correctedFailedTerminalSha256: '94fcb97ba5b7aa32eec7bed7c9306696d2c9fbee4972835ed9c7f14c15e8d33d',
    correctedFailedCredit: 0, observedPhaseTargets: 17, requestedPurpose: 'one existing integration step', requestedThroughTick: 35_472_251,
    productionBehaviorChanged: false, diagnosticOnly: true }, 6000);
  started = true;
});
afterAll(() => { if (started) endFieldDiagnostic(); });
