import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { digest, fileHash } from './pipeline-common.mjs';
import { assertRawKnownProfileProducerJson, assertRawKnownProfileProducerTerminal } from './known-profile-producer-evidence.mjs';

const FILES = ['admission', 'results', 'artifactAudit', 'inputManifest', 'sourceBeforeManifest', 'sourceAfterManifest', 'runtime', 'originalInput'];
const CONTROLS = ['audit-artifact.mjs', 'run-known-profile-acceptance.py', 'worker-memory-telemetry.cjs', 'worker-resource-probe-exact-node26.cjs'];
const WITNESS = 'seal-insert-rollback.json';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, field) => { if (!condition) throw new Error(`known-profile producer: ${field}`); };
const keys = (value, names) => record(value) && Object.keys(value).sort().join('\n') === [...names].sort().join('\n');
const reference = value => record(value) && typeof value.path === 'string' && isAbsolute(value.path) && resolve(value.path) === value.path
  && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);
const defaults = { readBytes: path => readFileSync(path), fileHash,
  walBytes: path => existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : null };

/** Explicit bounded file boundary. Injected I/O exists for JSON-only tests;
 * production hashes files independently and never opens SQLite/domain helpers.
 * The returned bundle still requires assertKnownProfileProducerEvidence. */
export const readKnownProfileProducerEvidence = (config, io = defaults) => {
  check(record(config), 'fileBindings');
  const proof = { path: config.physicalEvidencePath, sha256: config.physicalEvidenceSha256 };
  check(reference(proof), 'fileBindings');
  const checkedBytes = ref => {
    const bytes = io.readBytes(ref.path);
    check(Buffer.isBuffer(bytes) && digest(bytes) === ref.sha256, 'fileHash');
    return bytes;
  };
  const json = ref => JSON.parse(checkedBytes(ref).toString('utf8'));
  // A hashed watcher/projection never authorizes access to the artifact.
  const terminal = json(proof);
  assertRawKnownProfileProducerTerminal(terminal);
  const expected = config.physicalProducer, files = expected?.files;
  check(record(expected) && expected.kind === 'first_base_known_profile_producer_v1'
    && keys(files, [...FILES, 'controls', 'negativeEvidence'])
    && keys(files.controls, CONTROLS) && keys(files.negativeEvidence, [WITNESS]), 'fileBindings');
  const output = { path: config.physicalArtifactPath, sha256: config.physicalArtifactSha256 };
  const refs = [proof, output, ...FILES.map(key => files[key]), ...CONTROLS.map(key => files.controls[key]), files.negativeEvidence[WITNESS]];
  check(refs.every(reference) && new Set(refs.map(ref => ref.path)).size === refs.length, 'fileBindings');
  check(CONTROLS.every(name => basename(files.controls[name].path) === name)
    && basename(files.negativeEvidence[WITNESS].path) === WITNESS, 'fileBindings');
  for (const [role, field] of [['sourceBeforeManifest', 'sourceManifestSha256'], ['sourceAfterManifest', 'sourceManifestSha256'],
    ['runtime', 'runtimeSha256'], ['originalInput', 'originalInputSha256'], ['inputManifest', 'inputManifestSha256']]) {
    check(files[role].sha256 === expected[field], 'fileBindings');
  }
  check(files.originalInput.path === expected.originalInputPath && keys(expected.launcherHashes, CONTROLS)
    && keys(expected.negativeEvidenceHashes, [WITNESS]), 'fileBindings');
  for (const name of CONTROLS) check(files.controls[name].sha256 === expected.launcherHashes[name], 'fileBindings');
  check(files.negativeEvidence[WITNESS].sha256 === expected.negativeEvidenceHashes[WITNESS], 'fileBindings');
  const manifest = ref => {
    const text = checkedBytes(ref).toString('utf8'), lines = text.split('\n');
    check(lines.pop() === '' && lines.length > 0, 'sourceManifest');
    const names = lines.map(line => {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      check(match && !isAbsolute(match[2]) && !match[2].split('/').some(part => part === '' || part === '.' || part === '..'), 'sourceManifest');
      return match[2];
    });
    check(new Set(names).size === names.length, 'sourceManifest');
    return { sha256: ref.sha256, count: names.length };
  };
  const before = manifest(files.sourceBeforeManifest), after = manifest(files.sourceAfterManifest);
  check(before.count === after.count, 'sourceManifest');
  const rawJson = ref => { const value = json(ref); assertRawKnownProfileProducerJson(value); return value; };
  const admission = rawJson(files.admission), results = rawJson(files.results), artifactAudit = rawJson(files.artifactAudit), inputManifest = json(files.inputManifest);
  for (const raw of [admission, terminal]) {
    for (const [role, field] of [['runtime', 'runtimePath'], ['originalInput', 'inputPath'], ['inputManifest', 'inputManifestPath']]) {
      check(files[role].path === raw[field], 'fileBindings');
    }
    check(raw.negativeEvidencePath === files.negativeEvidence[WITNESS].path
      && keys(raw.launcherHashes, CONTROLS.map(name => files.controls[name].path)), 'fileBindings');
    for (const name of CONTROLS) check(raw.launcherHashes[files.controls[name].path] === files.controls[name].sha256, 'fileBindings');
  }
  const negativeEvidence = json(files.negativeEvidence[WITNESS]);
  const measured = ref => { const value = io.fileHash(ref.path); check(value === ref.sha256, 'fileHash'); return value; };
  const observed = { physicalEvidenceSha256: proof.sha256, physicalArtifactSha256: measured(output),
    sourceBeforeManifestSha256: before.sha256, sourceAfterManifestSha256: after.sha256, sourceFiles: before.count,
    runtimeSha256: measured(files.runtime), originalInputSha256: measured(files.originalInput), inputManifestSha256: files.inputManifest.sha256,
    launcherHashes: Object.fromEntries(CONTROLS.map(name => [name, measured(files.controls[name])])),
    negativeEvidenceHashes: { [WITNESS]: files.negativeEvidence[WITNESS].sha256 },
    inputWalBytes: io.walBytes(files.originalInput.path), outputWalBytes: io.walBytes(output.path) };
  return { config, terminal, admission, results, artifactAudit, inputManifest, negativeEvidence, observed,
    referencedFiles: Object.freeze(refs.map(ref => Object.freeze({ path: ref.path, sha256: ref.sha256 }))) };
};
