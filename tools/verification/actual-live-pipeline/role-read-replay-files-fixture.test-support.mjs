import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, CHANGES, digest } from './role-read-replay-fixture.test-support.mjs';
import { replayedRoleInputs } from './replayed-role-fixture.test-support.mjs';
import { clone, hash } from './inherited-files-fixture.test-support.mjs';
import { sourceReplacements } from './role-read-replay-source-fixture.test-support.mjs';

// Invented in-memory files, never SQLite or a successful actual replay. The
// four reviewed Source pairs use real bytes; no production module is imported.
const sourceBytes = new Map(CHANGES.map(change => {
  let historicalText = readFileSync(new URL(`../../../${change.path}`, import.meta.url)).toString();
  if (change.path === 'src/host/world/SqlitePhysicalPitchProgressStore.ts') {
    // Reconstruct the historical fixture bytes on the newer public stack. Only
    // these two type declarations may be removed; the exact frozen hash below
    // still guards every remaining byte. Runtime Source admission is unchanged.
    for (const fragment of ["import type { AcceptedOriginalBattingIntent } from './OriginalBattingIntent';\n",
      '  /** Explicit original actor choice; absence retains unresolved legacy meaning. */\n  battingIntent?: AcceptedOriginalBattingIntent;\n']) {
      assert(historicalText.split(fragment).length <= 2); historicalText = historicalText.replace(fragment, '');
    }
  }
  const after = Buffer.from(historicalText);
  assert.equal(hash(after), change.afterSha256);
  let before = after.toString();
  for (const [current, prior] of sourceReplacements.find(value => value.path === change.path).replacements) {
    assert.equal(before.split(current).length, 2); before = before.replace(current, prior);
  }
  assert.equal(hash(Buffer.from(before)), change.beforeSha256); return [change.path, { before: Buffer.from(before), after }];
}));
export const CONTROLS = { launcher: 'tools/verification/actual-live-pipeline/run-role-read-replay.py',
  runtimeProbe: 'tools/verification/actual-live-pipeline/runtime-probe.cjs', replayRunner: 'tools/verification/actual-live-pipeline/role-read-replay.mjs' };
export const fields = { receipt: 'receipt', stageTerminal: 'stageTerminal', supervisorTerminal: 'supervisorTerminal',
  outerTerminal: 'outerTerminal', configuration: 'replayConfig', sourceManifest: 'replaySourceManifest' };
export const roleReplayInputs = () => {
  // Add the original four Source files before the ancestor builders seal their
  // linked configuration objects. Their default fixture bytes stay unchanged.
  const x = replayedRoleInputs(CHANGES.map(change => ({ path: change.path, bytes: sourceBytes.get(change.path).before }))), role = x.proof;
  const proof = fixture(), files = proof.config.roleReadReplay.files;
  proof.roleEvidence = role;
  proof.replaySourceManifest = { ...clone(role.priorSourceManifest), sourceRoot: '/fixed/role-reader', sourceCommit: '7'.repeat(40), sourceTree: '8'.repeat(40) };
  for (const path of Object.values(CONTROLS)) if (!proof.replaySourceManifest.files.some(row => row.path === path))
    proof.replaySourceManifest.files.push({ path, sha256: '0'.repeat(64) });
  proof.currentSourceManifest = { ...clone(proof.replaySourceManifest), sourceRoot: '/fixed/next-consumer', sourceCommit: '9'.repeat(40), sourceTree: 'a'.repeat(40) };
  for (const manifest of [proof.replaySourceManifest, proof.currentSourceManifest]) {
    x.sources.set(manifest.sourceRoot, { head: manifest.sourceCommit, tree: manifest.sourceTree, changed: [], paths: manifest.files.map(row => row.path).sort() });
    for (const row of manifest.files) {
      const bytes = sourceBytes.get(row.path)?.after ?? x.bytes.get(`${role.priorSourceManifest.sourceRoot}/${row.path}`) ?? Buffer.from(`invented replay control ${row.path}\n`);
      x.bytes.set(`${manifest.sourceRoot}/${row.path}`, bytes); row.sha256 = hash(bytes);
    }
  }
  proof.config.inheritedRole = role.config.inheritedRole;
  role.config = proof.config; role.currentSourceManifest = proof.currentSourceManifest;
  const originalSeal = x.reseal;
  const reseal = () => {
    originalSeal();
    proof.config.officialReadReplay = clone(role.priorConfig.officialReadReplay);
    proof.config.sourceTransition = clone(role.priorConfig.sourceTransition);
    if (Object.hasOwn(role.priorConfig, 'expectedObservationSha256')) proof.config.expectedObservationSha256 = role.priorConfig.expectedObservationSha256;
    else delete proof.config.expectedObservationSha256;
    for (const field of ['inheritedOfficial', 'inheritedRole', 'sourceTransition', 'officialReadReplay', 'expectedObservationSha256']) {
      if (Object.hasOwn(role.config, field)) proof.replayConfig[field] = clone(role.config[field]); else delete proof.replayConfig[field];
    }
    proof.replayConfig.controlHashes = Object.fromEntries(Object.entries(CONTROLS).map(([name, path]) => [name, hash(x.bytes.get(`${proof.replaySourceManifest.sourceRoot}/${path}`))]));
    x.pinJson(files.sourceManifest, proof.replaySourceManifest); proof.replayConfig.sourceManifestSha256 = files.sourceManifest.sha256;
    const identity = { sourceRoot: proof.replaySourceManifest.sourceRoot, sourceCommit: proof.replaySourceManifest.sourceCommit,
      sourceTree: proof.replaySourceManifest.sourceTree, sourceManifestSha256: files.sourceManifest.sha256 };
    const transition = { ...proof.config.roleSourceTransition, fromSourceIdentity: clone(role.roleReceipt.sourceIdentity), toSourceIdentity: clone(identity) };
    proof.config.roleSourceTransition = clone(transition); proof.replayConfig.roleSourceTransition = clone(transition);
    const expected = digest(role.roleReceipt.settlement); proof.config.expectedSettlementSha256 = expected; proof.replayConfig.expectedSettlementSha256 = expected;
    x.pinJson(files.configuration, proof.replayConfig);
    const inherited = [{ stage: '01-official', ...clone(proof.config.inheritedOfficial.files.receipt) }, { stage: '02-role-workload', ...clone(proof.config.inheritedRole.files.receipt) }];
    Object.assign(proof.receipt, { sourceIdentity: clone(identity), inheritedSourceIdentity: clone(role.roleReceipt.sourceIdentity), roleSourceTransition: clone(transition),
      originalRoleBinding: clone(proof.config.inheritedRole), originalOfficialBinding: clone(proof.config.inheritedOfficial),
      originalOfficialReadReplay: clone(role.roleReceipt.inheritedReadReplay), originalRoleReceipt: clone(proof.config.inheritedRole.files.receipt),
      inheritedFaultReceipts: clone(inherited), expectedSettlementSha256: expected });
    for (const pass of proof.receipt.passes) {
      pass.artifactSha256Before = pass.artifactSha256After = role.roleReceipt.output.sha256;
      pass.observation = { settlement: clone(role.roleReceipt.settlement), currentHeads: role.roleReceipt.settlement.participants.map(p => clone(p.after)), artifact: clone(role.roleReceipt.output) };
      pass.observationSha256 = digest(pass.observation);
    }
    x.pinJson(files.receipt, proof.receipt); const sealed = { stage: 'role-read-replay', ...clone(files.receipt) };
    Object.assign(proof.stageTerminal, { sourceIdentity: clone(identity), phaseReceipts: [sealed], inheritedStageReceipts: clone(inherited) }); x.pinJson(files.stageTerminal, proof.stageTerminal);
    proof.supervisorTerminal.controlHashes = clone(proof.replayConfig.controlHashes);
    Object.assign(proof.supervisorTerminal.sourceInputAndReceiptAudit, { preservedPhaseReceipts: [clone(sealed)], inheritedStageReceipts: clone(inherited),
      originalRoleBinding: clone(proof.config.inheritedRole), roleSourceTransition: clone(transition) }); x.pinJson(files.supervisorTerminal, proof.supervisorTerminal);
    Object.assign(proof.outerTerminal, { sourceCommit: identity.sourceCommit, sourceManifestSha256: identity.sourceManifestSha256,
      configSha256: files.configuration.sha256, references: Object.fromEntries(['receipt', 'stageTerminal', 'supervisorTerminal'].map(name => [name, clone(files[name])])) });
    x.pinJson(files.outerTerminal, proof.outerTerminal);
    const currentPin = { path: proof.config.sourceManifestPath }; x.pinJson(currentPin, proof.currentSourceManifest); proof.config.sourceManifestSha256 = currentPin.sha256;
    proof.observed = { hashes: Object.fromEntries(Object.keys(files).map(name => [name, files[name].sha256])), replaySourceFilesUnchanged: true, currentSourceFilesUnchanged: true,
      controlHashes: clone(proof.replayConfig.controlHashes), artifactSha256: role.roleReceipt.output.sha256, artifactWalBytes: 0 };
  };
  reseal(); return { ...x, proof, files, fields, reseal };
};
