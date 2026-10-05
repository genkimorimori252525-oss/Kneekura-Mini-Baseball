import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { digest, fileHash } from './pipeline-common.mjs';
import { assertRawPhysicalProducerJson, assertRawPhysicalProducerTerminal } from './physical-producer-evidence.mjs';

const FILES = ['admission', 'results', 'artifactAudit', 'inputManifest', 'sourceBeforeManifest', 'sourceAfterManifest', 'runtime', 'originalInput'];
const CONTROLS = ['audit-artifact.mjs', 'run-minimal-clean-acceptance.py', 'worker-memory-telemetry.cjs', 'worker-resource-probe-exact-node26.cjs'];
const NEGATIVE = ['interruption-terminal.json', 'negative-phase-completed.jsonl', 'negative-phase-evidence.json'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, reason) => { if (!condition) throw new Error(`physical producer: ${reason}`); };
const keys = (value, names) => record(value) && Object.keys(value).sort().join('\n') === [...names].sort().join('\n');
const reference = value => record(value) && typeof value.path === 'string' && isAbsolute(value.path) && resolve(value.path) === value.path
  && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256);
const defaults = {
  readBytes: path => readFileSync(path), fileHash,
  walBytes: path => existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : null,
};

/** Bounded file adapter. The injected I/O is used only by pure tests; production
 * reads actual bytes and hashes. No SQLite API or domain owner is loaded here. */
export const readPhysicalProducerEvidence = (config, io = defaults) => {
  check(record(config), 'fileBindings');
  const proof = { path: config.physicalEvidencePath, sha256: config.physicalEvidenceSha256 };
  check(reference(proof), 'fileBindings');
  const checkedBytes = ref => {
    const bytes = io.readBytes(ref.path);
    check(Buffer.isBuffer(bytes) && digest(bytes) === ref.sha256, 'fileHash');
    return bytes;
  };
  const json = ref => JSON.parse(checkedBytes(ref).toString('utf8'));
  // Never touch a physical artifact merely because a watcher report was hashed.
  const terminal = json(proof);
  assertRawPhysicalProducerTerminal(terminal);
  const expected = config.physicalProducer, files = expected?.files;
  check(record(expected) && expected.kind === 'first_base_clean_producer_v1'
    && keys(files, [...FILES, 'controls', 'negativeEvidence'])
    && keys(files.controls, CONTROLS) && keys(files.negativeEvidence, NEGATIVE), 'fileBindings');
  const output = { path: config.physicalArtifactPath, sha256: config.physicalArtifactSha256 };
  const refs = [proof, output, ...FILES.map(key => files[key]), ...CONTROLS.map(key => files.controls[key]), ...NEGATIVE.map(key => files.negativeEvidence[key])];
  check(refs.every(reference) && new Set(refs.map(ref => ref.path)).size === refs.length, 'fileBindings');
  for (const [key, expectedHash] of [['sourceBeforeManifest', expected.sourceManifestSha256], ['sourceAfterManifest', expected.sourceManifestSha256],
    ['runtime', expected.runtimeSha256], ['originalInput', expected.originalInputSha256], ['inputManifest', expected.inputManifestSha256]]) {
    check(files[key].sha256 === expectedHash, 'fileBindings');
  }
  check(record(expected.launcherHashes) && record(expected.negativeEvidenceHashes), 'fileBindings');
  for (const key of CONTROLS) check(files.controls[key].sha256 === expected.launcherHashes[key], 'fileBindings');
  for (const key of NEGATIVE) check(files.negativeEvidence[key].sha256 === expected.negativeEvidenceHashes[key], 'fileBindings');
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
  const rawJson = ref => { const value = json(ref); assertRawPhysicalProducerJson(value); return value; };
  const admission = rawJson(files.admission), results = rawJson(files.results), artifactAudit = rawJson(files.artifactAudit), inputManifest = json(files.inputManifest);
  const measured = ref => { const value = io.fileHash(ref.path); check(value === ref.sha256, 'fileHash'); return value; };
  const observed = {
    physicalEvidenceSha256: proof.sha256, physicalArtifactSha256: measured(output),
    sourceBeforeManifestSha256: before.sha256, sourceAfterManifestSha256: after.sha256, sourceFiles: before.count,
    runtimeSha256: measured(files.runtime), originalInputSha256: measured(files.originalInput), inputManifestSha256: files.inputManifest.sha256,
    launcherHashes: Object.fromEntries(CONTROLS.map(key => [key, measured(files.controls[key])])),
    negativeEvidenceHashes: Object.fromEntries(NEGATIVE.map(key => [key, measured(files.negativeEvidence[key])])),
    inputWalBytes: io.walBytes(files.originalInput.path), outputWalBytes: io.walBytes(output.path),
  };
  return { config, terminal, admission, results, artifactAudit, inputManifest, observed,
    referencedFiles: Object.freeze(refs.map(ref => Object.freeze({ path: ref.path, sha256: ref.sha256 }))) };
};
