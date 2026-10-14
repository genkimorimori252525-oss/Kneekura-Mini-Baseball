import { nationalFoulTotalEffortUnits } from './NationalBattedFixtureDeclaration.test-support';
import assert from 'node:assert/strict';
import type { nationalBattedFieldFixture } from './NationalBattedFieldFixtures.test-support';
import { attachOriginalSettledFoulRuntime } from './ActualSettledFoulStopFixtures.test-support';
import { attachOriginalFoulEnd } from './ActualFoulPlayEndFixtures.test-support';
import { attachTerminalOfficialInputs } from './TerminalContinuationOfficialAttachment.test-support';
import { foulTerminalCompletionTableSql } from './ActualFoulTerminalApplicationStorage';
import { openSqliteActualFoulTerminalApplicationStore } from './SqliteActualFoulTerminalApplicationStore';
import { openSqliteActualFoulTerminalApplicationRunner } from './SqliteActualFoulTerminalApplicationRunner';
import { openSqliteActualFoulTerminalScoringStore } from './SqliteActualFoulTerminalScoringStore';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { openSqliteActualFoulTerminalRoleWorkloadStore } from './SqliteActualFoulTerminalRoleWorkloadStore';
import { foulTerminalRoleWorkloadContextFromSqlite } from './ActualFoulTerminalRoleWorkloadEvidenceFromSqlite';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import type { AcceptedFoulTerminalRoleWorkloadAssessment } from './ActualFoulTerminalRoleWorkloadAssessment';
import type { AcceptedFoulTerminalPostPlaySetup } from './ActualFoulTerminalPostPlaySetup';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One original two-strike bunt foul through the existing real owners. This
 * fresh private fixture explicitly installs terminal capability before use;
 * it does not migrate or copy an existing published artifact. */
export const completeNationalFoulFixture = (root: ReturnType<typeof nationalBattedFieldFixture>, progress: (phase: string) => void) => {
  const { f } = root, label = 'national-foul';
  const owned = attachOriginalSettledFoulRuntime(f.path, f, root, { source: root.source, sources: root.sources,
    ids: { runtimeSourceId: label + ':runtime', policySourceId: label + ':policy',
      fieldSourceIds: Array.from({ length: 32 }, (_, i) => `${label}:field-${i + 2}`) } });
  const foul = attachOriginalFoulEnd(f.path, owned, 'bunt', { runtimeSourceId: label + ':end-runtime', stopSourceId: label + ':stop',
    countSourceId: label + ':count', endpointSourceId: label + ':quantizer-endpoint' });
  progress('actual_foul_count_and_endpoint');
  const terminal = attachTerminalOfficialInputs(f.path, foul, {
    physicalEndSourceId: label + ':end', sessionSourceId: label + ':session', assignmentSourceId: label + ':assignment', intentSourceId: label + ':intent',
    recordCallSourceId: label + ':call', advanceSourceId: label + ':advance', fenceSourceId: label + ':fence', terminalSourceId: label + ':terminal',
    applicationId: label + ':application', sourceVersion: 'contract-v1', assignmentSourceVersion: 'explicit-fixture-v1',
    officialIds: ['umpire-1'], officialId: 'umpire-1', schedulerId: 'official-scheduler',
    officialPolicy: { sourceId: label + ':windows', sourceVersion: 'explicit-fixture-v1', ruleProfileId: root.actor.match.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
    legalGamePolicy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true },
  });
  // Only empty capabilities are installed; every gameplay row is produced below.
  assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='actual_foul_terminal_applications'").get(), undefined);
  f.db.exec(foulTerminalCompletionTableSql + '; PRAGMA user_version=3');
  f.track(openSqliteActualRoleWorkloadStore(f.path, f.links));
  const queue = f.track(openSqliteActualFoulTerminalApplicationStore(f.path, {
    readAcceptedApplication: id => id === terminal.terminalSource.sourceId ? terminal.terminalSource : null }));
  const queued = queue.enqueue(terminal.terminalSource.sourceId); assert('status' in queued);
  let completionSource: AcceptedFoulTerminalPostPlaySetup | undefined;
  const runner = f.track(openSqliteActualFoulTerminalApplicationRunner(f.path, {
    readAcceptedPostPlaySetup: id => completionSource?.sourceId === id ? completionSource : null }));
  runner.apply(terminal.terminalSource.sourceId);
  const acknowledged = runner.acknowledge(terminal.terminalSource.sourceId);
  assert.equal(acknowledged.status, 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
  const scoring = f.track(openSqliteActualFoulTerminalScoringStore(f.path)).apply(terminal.terminalSource.sourceId);
  assert.equal(scoring.record.classification, 'strikeout');
  const context = foulTerminalRoleWorkloadContextFromSqlite(f.db, terminal.terminalSource.sourceId);
  // Exact existing W02 explicit TOTAL fixture vector. These are accepted test
  // observations, never a generated production effort model or a prefix charge.
  const efforts = nationalFoulTotalEffortUnits;
  const assessments = new Map<string, AcceptedFoulTerminalRoleWorkloadAssessment>();
  for (const [i, actor] of context.actors.entries()) {
    const b = actor.binding;
    if (!f.workload.readHead(b.careerId, b.playerId)) {
      const baseline = { sourceId: label + ':baseline:' + b.playerId, sourceVersion: 'fixture-v1', personLinkSourceId: b.personLinkSourceId,
        careerId: b.careerId, playerId: b.playerId, createdAtDay: b.gameDay, fatigue: .1, recoveryCapacity: .5,
        policy: { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
          workloadFatiguePerUnit: .01, travelFatiguePerKm: .001, recoveryPerHour: .1 } };
      f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: id => id === baseline.sourceId ? baseline : null,
        readAcceptedActivity: () => null })).initialize(baseline.sourceId);
    }
    const source: AcceptedFoulTerminalRoleWorkloadAssessment = { sourceId: label + ':total:' + b.playerId, sourceVersion: 'fixture-v1',
      capability: 'actual_foul_terminal_total_workload_v1', terminalReference: context.reference.terminalReference,
      physicalEndReference: context.reference.physicalEndReference, wholeHistoryReference: context.reference.wholeHistoryReference,
      originalPhysicalPitchPrefix: context.reference.originalPhysicalPitchPrefix,
      participantReference: { playerId: b.playerId, bindingHash: hash(b), personHash: hash(actor.person) }, effortUnits: efforts[i],
      provenance: { assessmentSourceId: 'explicit-fixture-assessment:' + b.playerId, assessmentVersion: 'fixture-v1',
        calibrationSourceId: 'explicit-fixture-total-effort', calibrationVersion: 'fixture-v1' } };
    assessments.set(source.sourceId, source);
  }
  const workload = f.track(openSqliteActualFoulTerminalRoleWorkloadStore(f.path, f.links, { readAcceptedAssessment: id => assessments.get(id) ?? null }));
  workload.acceptAssessments([...assessments.keys()]); assert.equal(workload.settle(terminal.terminalSource.sourceId).kind, 'complete');
  const p = context.terminal.proposal;
  completionSource = { sourceId: label + ':completion', sourceVersion: 'fixture-v1', capability: 'actual_foul_terminal_post_play_setup_v1',
    terminalReference: { owner: 'actual_foul_terminal_applications', sourceId: terminal.terminalSource.sourceId,
      sourceVersion: terminal.terminalSource.sourceVersion, sourceHash: hash(terminal.terminalSource), proposalHash: hash(p) },
    nextStartedAtTick: p.clock.closureTick + 1, worldSetup: f.setup, controllerReset: 'rule_system_retire_original_play' };
  const completed = runner.completePostPlay(completionSource.sourceId);
  assert.equal(completed.status, 'POST_PLAY_COMPLETED_CONTINUING'); progress('foul_original_completion');
  return { terminal, completed, completionSource, runner, scoring };
};
