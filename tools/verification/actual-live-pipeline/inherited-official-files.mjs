import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, fileHash } from './pipeline-common.mjs';

const FILES = ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact'];
const REGRESSIONS = ['recovery', 'stale'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const canonicalPath = (value, absolute) => typeof value === 'string' && value.length > 0
  && !value.includes('\\') && !value.includes('\0') && posix.isAbsolute(value) === absolute
  && posix.normalize(value) === value && value !== '/'
  && value.split('/').every((part, index) => (absolute && index === 0) || (part !== '' && part !== '.' && part !== '..'));
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const gitPaths = (root, ...args) => git(root, ...args).split('\0').filter(Boolean);

// Match the frozen Source census: every tracked file plus generated files under
// src. Census collection never hashes or buffers files and never follows links.
const sourceFilePaths = root => {
  const paths = new Set(gitPaths(root, 'ls-files', '-z'));
  const walk = relative => {
    const full = `${root}/${relative}`, stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('Source symlink');
    if (stat.isDirectory()) for (const name of readdirSync(full)) walk(`${relative}/${name}`);
    else if (stat.isFile()) paths.add(relative);
    else throw new Error('non-file Source');
  };
  walk('src');
  for (const path of paths) {
    if (!canonicalPath(path, false) || !lstatSync(`${root}/${path}`).isFile()) throw new Error('non-file Source');
  }
  return [...paths].sort();
};

export const inheritedFileIO = Object.freeze({
  readBytes: path => readFileSync(path), fileHash,
  walBytes: path => {
    try { return statSync(`${path}-wal`).size; }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  },
  realPath: path => realpathSync(path),
  sourceHead: root => git(root, 'rev-parse', 'HEAD').trim(),
  sourceTree: root => git(root, 'rev-parse', 'HEAD^{tree}').trim(),
  sourceChangedPaths: root => gitPaths(root, 'diff', '--name-only', '-z', 'HEAD'),
  sourceFilePaths,
});

// Shared only by the two inherited-stage file adapters. These checks establish
// byte and filesystem authority; the separate semantic validators still own
// stage/producer meaning. No SQLite connection or domain helper is used here.
export const inheritedFileAdmission = (kind, io) => {
  const check = (condition, reason) => { if (!condition) throw new Error(`inherited ${kind} files: ${reason}`); };
  const observe = (reason, operation) => {
    try { return operation(); }
    catch (cause) { throw new Error(`inherited ${kind} files: ${reason}`, { cause }); }
  };
  const roles = (value, names) => record(value) && isDeepStrictEqual(Object.keys(value).sort(), [...names].sort());
  const bindings = (value, stage) => {
    check(record(value) && value.kind === `checked_${stage}_stage_v1`
      && canonicalPath(value.sourceRoot, true) && commit(value.sourceCommit) && hash(value.sourceManifestSha256)
      && roles(value.files, FILES), 'file bindings');
    if (stage === 'role') check(roles(value.regressionArtifacts, REGRESSIONS), 'file bindings');
    const pins = values => Object.fromEntries(Object.entries(values).map(([name, ref]) => {
      check(record(ref) && canonicalPath(ref.path, true) && hash(ref.sha256), 'file bindings');
      return [name, Object.freeze({ path: ref.path, sha256: ref.sha256 })];
    }));
    const files = pins(value.files), regressionArtifacts = stage === 'role' ? pins(value.regressionArtifacts) : {};
    check(value.sourceManifestSha256 === files.sourceManifest.sha256, 'file bindings');
    return { kind: value.kind, sourceRoot: value.sourceRoot, sourceCommit: value.sourceCommit,
      sourceManifestSha256: value.sourceManifestSha256, files, regressionArtifacts };
  };
  const distinct = refs => check(new Set(refs.map(ref => ref.path)).size === refs.length, 'file bindings');
  const resolved = refs => {
    distinct(refs);
    // Resolve the complete set before any JSON or artifact bytes are read.
    for (const ref of refs) check(observe('file bindings', () => io.realPath(ref.path)) === ref.path, 'file bindings');
  };
  const json = (ref, hashes, name) => {
    const bytes = observe('file bytes', () => io.readBytes(ref.path));
    check(Buffer.isBuffer(bytes), 'file bytes');
    const measured = digest(bytes);
    check(measured === ref.sha256, 'file hash'); hashes[name] = measured;
    return observe('file bytes', () => JSON.parse(bytes.toString('utf8')));
  };
  const artifact = (ref, hashes, name, walReason) => {
    const measured = observe('file hash', () => io.fileHash(ref.path));
    check(measured === ref.sha256, 'file hash'); hashes[name] = measured;
    const wal = observe(walReason, () => io.walBytes(ref.path));
    check(wal === null || wal === 0, walReason);
    return wal;
  };
  const source = (binding, manifest, configuration, receipt) => observe('prior Source', () => {
    check(record(manifest) && manifest.schema === 'actual_artifact_pipeline_source_v1'
      && !Object.hasOwn(manifest, 'publicationProjection') && !Object.hasOwn(manifest, 'originalRawReceiptSha256')
      && canonicalPath(manifest.sourceRoot, true) && commit(manifest.sourceCommit) && commit(manifest.sourceTree)
      && Array.isArray(manifest.files) && manifest.files.length > 0
      && record(configuration) && record(receipt) && record(receipt.sourceIdentity), 'prior Source');
    for (const field of ['sourceRoot', 'sourceCommit']) {
      check(manifest[field] === binding[field] && configuration[field] === binding[field]
        && receipt.sourceIdentity[field] === binding[field], 'prior Source');
    }
    check(configuration.sourceManifestPath === binding.files.sourceManifest.path
      && configuration.sourceManifestSha256 === binding.sourceManifestSha256
      && receipt.sourceIdentity.sourceManifestSha256 === binding.sourceManifestSha256
      && receipt.sourceIdentity.sourceTree === manifest.sourceTree, 'prior Source');
    const paths = new Set();
    // Validate the entire manifest before constructing or traversing any Source
    // child path, including when a later entry is malformed or duplicated.
    for (const entry of manifest.files) {
      check(record(entry) && canonicalPath(entry.path, false) && hash(entry.sha256) && !paths.has(entry.path), 'prior Source');
      paths.add(entry.path);
    }
    const root = manifest.sourceRoot;
    check(io.realPath(root) === root && io.sourceHead(root) === manifest.sourceCommit
      && io.sourceTree(root) === manifest.sourceTree, 'prior Source');
    const changed = io.sourceChangedPaths(root), observedPaths = io.sourceFilePaths(root);
    check(Array.isArray(changed) && changed.length === 0 && Array.isArray(observedPaths)
      && observedPaths.every(path => canonicalPath(path, false)) && new Set(observedPaths).size === observedPaths.length
      && isDeepStrictEqual([...observedPaths].sort(), [...paths].sort()), 'prior Source');
    for (const path of paths) check(io.realPath(`${root}/${path}`) === `${root}/${path}`, 'prior Source');
    for (const entry of manifest.files) {
      const bytes = io.readBytes(`${root}/${entry.path}`);
      check(Buffer.isBuffer(bytes) && digest(bytes) === entry.sha256, 'prior Source');
    }
  });
  return { check, bindings, distinct, resolved, json, artifact, source };
};

/** Load only explicitly pinned inherited evidence. Authentication of its domain
 * meaning remains mandatory through assertInheritedOfficialEvidence. */
export const readInheritedOfficialEvidence = (config, producerReference, currentSourceManifest, io = inheritedFileIO) => {
  const admission = inheritedFileAdmission('official', io), binding = admission.bindings(config?.inheritedOfficial, 'official');
  const files = binding.files, hashes = {};
  admission.resolved(FILES.map(name => files[name]));
  const json = name => admission.json(files[name], hashes, name);
  const officialHandoff = json('handoff'), outerTerminal = json('outerTerminal'), stageTerminal = json('stageTerminal');
  const supervisorTerminal = json('supervisorTerminal'), officialReceipt = json('receipt');
  const priorConfig = json('configuration'), priorSourceManifest = json('sourceManifest');
  const outputWalBytes = admission.artifact(files.artifact, hashes, 'artifact', 'output WAL');
  admission.source(binding, priorSourceManifest, priorConfig, officialReceipt);
  const observed = { hashes, outputWalBytes, priorSourceFilesUnchanged: true };
  const referencedFiles = Object.freeze(FILES.map(name => Object.freeze({ path: files[name].path, sha256: hashes[name] })));
  return { config, producerReference, officialHandoff, officialReceipt, stageTerminal, supervisorTerminal, outerTerminal,
    priorConfig, priorSourceManifest, currentSourceManifest, observed, referencedFiles };
};
