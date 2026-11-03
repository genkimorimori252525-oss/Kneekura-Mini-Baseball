import { readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const sha = bytes => createHash('sha256').update(bytes).digest('hex'), json = path => JSON.parse(read(path, 'utf8'));
const root = 'docs/verification/spin-trial-v124/', snapshot = json(root + 'source-snapshot-v130-final.json');
for (const [path, expected] of Object.entries(snapshot.inputs)) assert.equal(sha(read(path)), expected, path);
const passes = { components162: 'c7dca1b1775444748183c83c6f693338', typeAfterWitness: '1a45eb847adc46728b5d03eda3c85511',
  annotationEquivalence: '4670fd75c678446e8075f24b171f484e', browserPreservation: '342303a5b66e41dd83b9b8510e92dea3' };
const failures = { modeRed: '53611e89512c405bbb9108ba1f3039de', canonicalReviewRed: 'c02664d05adf4d3e8678d0402456f59c',
  initialType: '0f7bee5f70e848c4bc35f4ae9b8758d0', wrongAnnotationTarget: 'e87ad2c73f254c0bbe10938feef60eec',
  functional900FixtureNamespace: '32919e51867c43e89ea738990f3d24e5' };
for (const [status, entries] of [['PASS', passes], ['FAIL', failures]]) for (const [name, id] of Object.entries(entries)) {
  const receipt = json('docs/ai-continuity/verification-receipts/MB-20261026-TRAITS-SPIN-CONTINUATION-V123_' + id + '.json');
  assert.equal(receipt.result, status, name); assert.equal(sha(read(receipt.output_path)), receipt.output_sha256, name);
  if (status === 'PASS') assert.equal(receipt.exit_code, 0, name);
  if (name === 'components162') assert.match(read(receipt.output_path, 'utf8'), /Tests\s+162 passed \(162\)/);
}
const annotation = json(root + 'canonical-annotations-v130.json');
assert.equal(annotation.pass, true); assert.equal(annotation.behaviorChanged, false);
assert.equal(annotation.currentSourceSha256, sha(read(annotation.path)));
const preserved = json(root + 'preservation-v125.json');
assert.equal(preserved.pass, true); assert.equal(preserved.unchangedBrowserInputs, 195); assert.equal(preserved.protectedArtifacts, 15);
const scope = json('docs/verification/traits-spin-continuation-v123/IMPLEMENTATION-SCOPE.json');
assert.equal(scope.signature.currentScope, 'FOUNDATION_ONLY');
assert.equal(scope.signature.automaticNaming, 'DEFERRED_TO_PENNANT_IMPLEMENTATION');
const report = { pass: true, boundary: 'COMPONENT_COMPATIBILITY_NOT_NATIVE_MATCH_CONTACT_ADOPTION',
  sourceSnapshot: 'source-snapshot-v130-final.json', listedSources: Object.keys(snapshot.inputs).length, passes, retainedFailures: failures,
  behavioralTests: 162, annotationOnlyDifferenceAfterTests: true, normalObservationBudgetMs: 180000, functionalBudgetMs: 1200000,
  nativeMatchAdoptionContactReplay: 'NOT_VERIFIED_RUNNING_SEPARATE_GATE', performancePass: false,
  currentBrowserVersion: 124, protectedArtifacts: 15, unchangedBrowserInputs: 195,
  sourceCommitPushMergeDeploy: false, goalComplete: false };
write(root + 'reader-phase-v130-integrity.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
