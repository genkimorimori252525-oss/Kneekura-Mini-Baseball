import { resolve } from 'node:path';
import { instrumentFieldDiagnostic, type DiagnosticTarget } from './BattedFieldDiagnosticTransform.test-support';

/** Closed allowlist of observation points. Production bytes and calls stay intact. */
export const fieldDiagnosticTargets: Readonly<Record<string, readonly DiagnosticTarget[]>> = {
  'src/host/world/BattedEpisodeV2FieldContinuation.acceptance.ts': [
    { variable: 'observe', label: 'fixture.owner-call', metadata: '({})' },
    { variable: 'checkpoint', label: 'fixture.checkpoint', metadata: '({phase})' },
  ],
  'src/host/world/SqliteBattedWorldFieldStore.ts': [
    { variable: 'root', label: 'field.root', metadata: '__epbDiagnosticInput(source)' },
    { variable: 'derive', label: 'field.derive', metadata: '__epbDiagnosticInput(source)' },
    { variable: 'execute', label: 'field.execute', metadata: '__epbDiagnosticInput(source,original)' },
    { variable: 'currentBefore', label: 'field.current-before', metadata: '({...__epbDiagnosticInput(value),transactional:db.isTransaction})' },
    { variable: 'currentRoot', label: 'field.current-root', metadata: '({...__epbDiagnosticInput(value),transactional:db.isTransaction})' },
    { variable: 'current', label: 'field.current', metadata: '({...__epbDiagnosticInput(value),transactional:db.isTransaction})' },
  ],
  'src/host/world/SqliteBattedEpisodeFieldBindingStore.ts': [
    { variable: 'derive', label: 'binding.derive', metadata: '({sourceId:raw.sourceId,responseSourceId:raw.responseSourceId})' },
    { variable: 'read', label: 'binding.read', metadata: '({sourceId,transactional:db.isTransaction})' },
    { variable: 'current', label: 'binding.current', metadata: '({sourceId:value.source.sourceId,physicalPitchSourceId:value.physicalPitchSourceId,transactional:db.isTransaction})' },
  ],
  'src/host/world/ActualLivePhysicalActivation.ts': [
    { variable: 'readActualLivePhysicalActivation', label: 'ancestry.activation', metadata: '({gameId,applicationId})' },
  ],
  'src/host/world/ActualLivePlayReadinessFromSqlite.ts': [
    { variable: 'read', label: 'ancestry.readiness', metadata: '({closureSourceId,currentHeads})' },
  ],
  'src/host/world/ActualLivePlayClosureEvidenceFromSqlite.ts': [
    { variable: 'checkPriorActualLiveClosureCompleted', label: 'ancestry.prior-completion', metadata: '({applicationId,historical,paired})' },
    { variable: 'deriveActualLivePlayClosureProposal', label: 'ancestry.closure-proposal', metadata: '({sourceId:raw.sourceId,historicalApplied})' },
  ],
  'src/core/sim/ball/BattedWorldFieldMotion.ts': [
    { variable: 'deriveInitialBattedWorldFieldMotion', label: 'core.initial-field', metadata: '__epbDiagnosticInput(raw)' },
    { variable: 'deriveBattedWorldFieldMotion', label: 'core.field', metadata: '__epbDiagnosticInput(raw)' },
  ],
};
export const fieldDiagnosticPlugin = (root: string) => ({
  name: 'episode-field-observation-only', enforce: 'pre' as const,
  transform(code: string, id: string) {
    const target = Object.entries(fieldDiagnosticTargets).find(([file]) => resolve(root, file) === id.split('?')[0]);
    if (!target) return null;
    return { code: instrumentFieldDiagnostic(code, id, resolve(root, 'src/host/world/BattedFieldDiagnosticTrace.test-support.ts'), target[1]), map: null };
  },
});
