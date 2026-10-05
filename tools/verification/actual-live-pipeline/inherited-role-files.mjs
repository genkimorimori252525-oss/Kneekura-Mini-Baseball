import { isDeepStrictEqual } from 'node:util';
import { posix } from 'node:path';
import { inheritedFileAdmission, inheritedFileIO, readInheritedOfficialEvidence } from './inherited-official-files.mjs';
import { readOfficialReadReplayEvidence } from './official-read-replay-files.mjs';

const FILES = ['handoff', 'outerTerminal', 'stageTerminal', 'supervisorTerminal', 'receipt', 'configuration', 'sourceManifest', 'artifact'];
const REGRESSIONS = ['recovery', 'stale'];

/** Load the pinned role stage and its original official stage without opening
 * any database or rerunning either stage. Semantic admission remains separate. */
export const readInheritedRoleEvidence = (config, producerReference, currentSourceManifest, io = inheritedFileIO) => {
  const admission = inheritedFileAdmission('role', io), binding = admission.bindings(config?.inheritedRole, 'role');
  const officialBinding = admission.bindings(config?.inheritedOfficial, 'official');
  const files = binding.files, regressions = binding.regressionArtifacts;
  const hashes = {}, regressionHashes = {}, regressionWalBytes = {};
  // All 18 original pins must be distinct and resolved before reading even the
  // role configuration. Its nested official pins cannot grant new read access.
  admission.resolved([...FILES.map(name => files[name]), ...REGRESSIONS.map(name => regressions[name]),
    ...FILES.map(name => officialBinding.files[name])]);
  const json = name => admission.json(files[name], hashes, name);
  const roleHandoff = json('handoff'), outerTerminal = json('outerTerminal'), stageTerminal = json('stageTerminal');
  const supervisorTerminal = json('supervisorTerminal'), roleReceipt = json('receipt');
  const priorConfig = json('configuration'), priorSourceManifest = json('sourceManifest');
  const nestedOfficialBinding = admission.bindings(priorConfig?.inheritedOfficial, 'official');
  admission.check(isDeepStrictEqual(nestedOfficialBinding, officialBinding), 'file bindings');
  const outputWalBytes = admission.artifact(files.artifact, hashes, 'artifact', 'output WAL');
  for (const name of REGRESSIONS)
    regressionWalBytes[name] = admission.artifact(regressions[name], regressionHashes, name, 'regression WAL');
  admission.source(binding, priorSourceManifest, priorConfig, roleReceipt);
  const officialEvidence = readInheritedOfficialEvidence(priorConfig, producerReference, priorSourceManifest, io);
  const observed = { hashes, outputWalBytes, priorSourceFilesUnchanged: true, regressionHashes, regressionWalBytes };
  const referencedFiles = Object.freeze([
    ...FILES.map(name => Object.freeze({ path: files[name].path, sha256: hashes[name] })),
    ...REGRESSIONS.map(name => Object.freeze({ path: regressions[name].path, sha256: regressionHashes[name] })),
    ...officialEvidence.referencedFiles,
  ]);
  return { config, producerReference, roleHandoff, roleReceipt, stageTerminal, supervisorTerminal, outerTerminal,
    priorConfig, priorSourceManifest, currentSourceManifest, officialEvidence, observed, referencedFiles };
};

/** Resolve the complete authorized set first, then reuse the existing byte and
 * Source readers. The caller must still invoke assertReplayedRoleEvidence. */
export const readReplayedRoleEvidence = (config, producerReference, currentSourceManifest, io = inheritedFileIO) => {
  const a = inheritedFileAdmission('role', io), role = a.bindings(config?.inheritedRole, 'role');
  const official = a.bindings(config?.inheritedOfficial, 'official'), replay = config?.officialReadReplay;
  const replayNames = ['receipt', 'stageTerminal', 'supervisorTerminal', 'outerTerminal', 'configuration', 'sourceManifest'];
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  a.check(record(replay) && replay.kind === 'checked_official_read_replay_v1' && record(replay.files)
    && isDeepStrictEqual(Object.keys(replay.files).sort(), [...replayNames].sort()), 'file bindings');
  const pin = value => {
    a.check(record(value) && typeof value.path === 'string' && value.path !== '/' && posix.isAbsolute(value.path)
      && posix.normalize(value.path) === value.path && !value.path.includes('\\') && !value.path.includes('\0')
      && value.path.split('/').slice(1).every(part => part && part !== '.' && part !== '..')
      && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256), 'file bindings');
    return Object.freeze({ path: value.path, sha256: value.sha256 });
  };
  const replayPins = replayNames.map(name => pin(replay.files[name]));
  const refs = [...Object.values(role.files), ...Object.values(role.regressionArtifacts), ...Object.values(official.files), ...replayPins];
  const currentPin = pin({ path: config.sourceManifestPath, sha256: config.sourceManifestSha256 });
  a.resolved(refs);
  const alias = refs.find(ref => ref.path === currentPin.path);
  if (alias) a.check(alias.sha256 === currentPin.sha256, 'file bindings');
  else a.resolved([currentPin]);
  const bundle = readInheritedRoleEvidence(config, producerReference, currentSourceManifest, io);
  for (const field of ['officialReadReplay', 'sourceTransition'])
    a.check(isDeepStrictEqual(bundle.priorConfig[field], config[field]), 'file bindings');
  a.check((bundle.priorConfig.expectedObservationSha256 ?? null) === (config.expectedObservationSha256 ?? null), 'file bindings');
  const current = a.json(currentPin, {}, 'currentSourceManifest');
  a.check(isDeepStrictEqual(current, currentSourceManifest), 'current Source');
  a.source({ sourceRoot: config.sourceRoot, sourceCommit: config.sourceCommit,
    sourceManifestSha256: currentPin.sha256, files: { sourceManifest: currentPin } }, current, config,
  { sourceIdentity: { sourceRoot: config.sourceRoot, sourceCommit: config.sourceCommit,
    sourceTree: current.sourceTree, sourceManifestSha256: currentPin.sha256 } });
  const readReplayEvidence = readOfficialReadReplayEvidence(bundle.priorConfig, producerReference, bundle.priorSourceManifest, io);
  const referencedFiles = Object.freeze([...bundle.referencedFiles,
    ...readReplayEvidence.referencedFiles.filter(ref => replayPins.some(pin => pin.path === ref.path))]);
  return { ...bundle, readReplayEvidence, referencedFiles };
};
