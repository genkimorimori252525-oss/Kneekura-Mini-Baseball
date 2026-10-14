import { expect, it } from 'vitest';
import { assertInFlightDecisionRetryFrontier } from './InFlightBattingLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

// Small causal-boundary declarations only. These are not Native receipts and
// do not qualify a retained database, batting operation or full IFN scenario.
const frontier = () => {
  const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceHash: sourceId, snapshotHash: sourceId });
  const lineage = { original: 'one-enrollment-and-pitch' };
  const delivery = ref('pa_physical_v1_cuts', 'delivery');
  const priorPrefix: any = { lineage, source: { sourceId: 'physical-fixture:cut8:prefix',
    enrollmentReference: ref('same_pa_enrollments', 'enrollment'), anchorViewReference: ref('pa_continuation_v1_execution_views', 'anchor'),
    eventReferences: Array.from({ length: 8 }, (_, i) => ref('original-work', String(i))) } };
  const completedView: any = { lineage, source: { sourceId: 'physical-fixture:cut8:view',
    prefixReference: reference('pa_lifecycle_v1_work_prefixes', priorPrefix) }, cut: { physicalOperationReference: delivery } };
  const completedViewReference = reference('pa_lifecycle_v1_execution_views', completedView);
  const decisionCut: any = { kind: 'same_pa_physical_cut_v1', stage: 'in_flight', operationOrdinal: 3, lineage,
    source: { sourceId: 'in-flight-fixture:pitch3:decision-cut', viewReference: completedViewReference, previousOperationReference: delivery } };
  const physicalHeadReference = reference('pa_physical_v1_cuts', decisionCut);
  const pendingPrefix: any = { lineage, source: { ...priorPrefix.source, sourceId: 'physical-fixture:cut9:prefix',
    eventReferences: [...priorPrefix.source.eventReferences, physicalHeadReference] }, previousViewReference: completedViewReference,
    cut: { physicalOperationReference: physicalHeadReference } };
  return { priorPrefix, completedView, pendingPrefix, decisionCut, physicalHeadReference, successorSourceIds: [] as string[] };
};
it('IFD01 admits only the exact incomplete cut9 extension of its last complete view', () => {
  expect(() => assertInFlightDecisionRetryFrontier(frontier())).not.toThrow();
});
it.each([
  ['earlier view', (x: ReturnType<typeof frontier>) => { x.completedView.source.sourceId = 'physical-fixture:cut7:view'; }],
  ['missing admitted predecessor', (x: ReturnType<typeof frontier>) => { x.pendingPrefix.source.eventReferences.splice(3, 1); }],
  ['duplicate decision cut', (x: ReturnType<typeof frontier>) => { x.pendingPrefix.source.eventReferences.push(x.physicalHeadReference); }],
  ['foreign enrollment', (x: ReturnType<typeof frontier>) => { x.pendingPrefix.source.enrollmentReference = { ...x.pendingPrefix.source.enrollmentReference, sourceId: 'other' }; }],
  ['wrong physical head', (x: ReturnType<typeof frontier>) => { x.physicalHeadReference = { ...x.physicalHeadReference, snapshotHash: 'different' }; }],
  ['changed decision predecessor', (x: ReturnType<typeof frontier>) => { x.decisionCut.source.previousOperationReference = { ...x.decisionCut.source.previousOperationReference, sourceId: 'capture' }; }],
  ['later input already exists', (x: ReturnType<typeof frontier>) => { x.successorSourceIds.push('in-flight-fixture:pitch3:input'); }],
  ['different lineage', (x: ReturnType<typeof frontier>) => { x.pendingPrefix.lineage = { original: 'different-enrollment' }; }],
] as const)('IFD02 rejects %s before a retry can append work', (_name, mutate) => {
  const x = frontier(); mutate(x); expect(() => assertInFlightDecisionRetryFrontier(x)).toThrow();
});
