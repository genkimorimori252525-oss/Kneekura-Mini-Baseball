import { isDeepStrictEqual } from 'node:util';
import { inheritedFileAdmission, inheritedFileIO, readInheritedOfficialEvidence } from './inherited-official-files.mjs';

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
