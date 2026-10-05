import { createHash } from 'node:crypto';
import { roleInputs, clone, hash } from './inherited-files-fixture.test-support.mjs';
import { replayInputs } from './official-read-replay-files-fixture.test-support.mjs';

// Invented byte fixtures only. Reuse the independently tested role and replay
// builders; the artifact buffers contain labeled text, never SQLite databases.
const canonical = value => JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const carry = config => ({ binding: clone(config.officialReadReplay), sourceTransition: clone(config.sourceTransition),
  expectedObservationSha256: config.expectedObservationSha256 ?? null });
export const replayedRoleInputs = (extraSourceFiles = []) => {
  const x = roleInputs(), replay = replayInputs(extraSourceFiles), p = x.proof, r = replay.proof;
  for (const name of ['bytes', 'wals', 'sources', 'realPaths']) for (const [key, value] of replay[name]) x[name].set(key, value);
  Object.assign(p.officialEvidence, clone(r.officialEvidence));
  p.priorSourceManifest = clone(r.currentSourceManifest);
  p.currentSourceManifest = { ...clone(p.priorSourceManifest), sourceRoot: '/fixed/next', sourceCommit: '5'.repeat(40), sourceTree: '6'.repeat(40) };
  x.source(p.currentSourceManifest);
  for (const row of p.currentSourceManifest.files) {
    const bytes = x.bytes.get(`${p.priorSourceManifest.sourceRoot}/${row.path}`);
    x.bytes.set(`${p.currentSourceManifest.sourceRoot}/${row.path}`, bytes); row.sha256 = hash(bytes);
  }
  p.priorConfig = { ...clone(r.config), executionScope: 'role', faultChecks: true, executeNextPitch: true,
    sourceManifestPath: x.files.sourceManifest.path, sourceManifestSha256: x.files.sourceManifest.sha256 };
  const roleBinding = p.config.inheritedRole;
  p.config = { ...clone(p.priorConfig), executionScope: 'next', sourceRoot: p.currentSourceManifest.sourceRoot,
    sourceCommit: p.currentSourceManifest.sourceCommit, sourceManifestPath: '/next/source-manifest.json', inheritedRole: roleBinding };
  Object.assign(roleBinding, { sourceRoot: p.priorSourceManifest.sourceRoot, sourceCommit: p.priorSourceManifest.sourceCommit });
  for (const doc of [p.roleReceipt, p.stageTerminal, p.roleHandoff]) Object.assign(doc.sourceIdentity, {
    sourceRoot: p.priorSourceManifest.sourceRoot, sourceCommit: p.priorSourceManifest.sourceCommit, sourceTree: p.priorSourceManifest.sourceTree });
  p.outerTerminal.sourceCommit = p.priorSourceManifest.sourceCommit;

  const observation = r.receipt.passes[0].observation, settlement = p.roleReceipt.settlement;
  const original = observation.participantReferences[0];
  Object.assign(settlement, { closureProposalHash: observation.closureProposalHash,
    careerId: original.careerId, gameId: original.gameId, playId: original.playId, gameDay: original.gameDay });
  for (const [index, participant] of settlement.participants.entries()) {
    const actor = observation.participantReferences[index], inputs = p.roleReceipt.acceptedInputManifest;
    participant.personId = actor.personId; participant.clubId = actor.clubId;
    inputs.assessments[index].participantReference = { playerId: actor.playerId, bindingHash: actor.bindingHash, personHash: actor.personHash };
    const evidence = inputs.baselineEvidence[index], baseline = evidence.source;
    baseline.careerId = original.careerId;
    if (baseline.playerId !== 'p2') baseline.createdAtDay = original.gameDay;
    evidence.sourceHash = digest(baseline);
    const added = inputs.addedBaselines.find(value => value.playerId === actor.playerId);
    if (added) Object.assign(added, clone(baseline));
    const { sourceId: _id, sourceVersion: _version, personLinkSourceId: _link, ...state } = baseline;
    participant.before = { ...clone(state), modelVersion: 'player-workload-recovery-v1', effectiveDay: baseline.createdAtDay, revision: 0 };
    participant.after = { ...clone(participant.before), effectiveDay: original.gameDay, revision: 1,
      fatigue: Math.max(0, Math.min(1, baseline.fatigue + baseline.policy.workloadFatiguePerUnit * index)) };
    Object.assign(participant.activity, { careerId: original.careerId, atDay: original.gameDay,
      sourceEventId: `actual-total-play-workload:${digest([original.careerId, original.gameId, original.playId, actor.playerId])}` });
  }
  const sealRole = x.reseal;
  const reseal = () => {
    const currentPin = { path: p.config.sourceManifestPath }; x.pinJson(currentPin, p.currentSourceManifest);
    p.config.sourceManifestSha256 = currentPin.sha256;
    for (const doc of [p.roleReceipt, p.stageTerminal, p.roleHandoff, p.supervisorTerminal.sourceInputAndReceiptAudit])
      doc.inheritedReadReplay = carry(p.priorConfig);
    sealRole();
    r.config = clone(p.priorConfig); r.currentSourceManifest = clone(p.priorSourceManifest);
    r.officialEvidence = clone(p.officialEvidence);
    p.readReplayEvidence = clone(r);
  };
  reseal();
  return { ...x, replayFiles: p.config.officialReadReplay.files, replay, reseal };
};
