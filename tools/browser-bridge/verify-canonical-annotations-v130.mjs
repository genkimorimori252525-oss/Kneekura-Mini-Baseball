import { readFileSync as read, writeFileSync as write } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const path = 'src/host/world/CanonicalActorJsonV130.test.ts', current = read(path, 'utf8');
let prior = current;
for (const label of ['undefined', 'bigint', 'cycle', 'array cycle']) {
  const from = `['${label}', (): unknown =>`, to = `['${label}', () =>`;
  assert(prior.includes(from), label); prior = prior.replace(from, to);
}
// This is the exact preserved review-test version used before the four
// annotation-only fixes. A different behavioral edit cannot pass this check.
assert.equal(sha(Buffer.from(prior)), '07d427bccb60a56964e081316a7c7aa91dbb021de790811657369d10f25f3b7a');
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const emitted = source => ts.transpileModule(source, { compilerOptions, fileName: path }).outputText;
assert.equal(emitted(current), emitted(prior));
const report = { pass: true, boundary: 'FOUR_TEST_RETURN_ANNOTATIONS_ONLY_NOT_ENGINE_VERIFICATION', path,
  priorSourceSha256: sha(Buffer.from(prior)), currentSourceSha256: sha(Buffer.from(current)),
  emittedJavaScriptSha256: sha(Buffer.from(emitted(current))), behaviorChanged: false };
write('docs/verification/spin-trial-v124/canonical-annotations-v130.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
