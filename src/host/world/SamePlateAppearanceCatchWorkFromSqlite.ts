import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readSamePaLiveWorkFromSqlite } from './SamePlateAppearanceLiveWorkFromSqlite';
import { readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite, memoSamePaLifecycleRead,
  assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';
import { assertSamePaCatchWorkStorage as storage, samePaCatchWorkSchema as schema } from './SamePlateAppearanceCatchWorkStorage';
import { samePaCatchWorkInput, samePaCatchWorkOriginalsInput, samePaCatchOriginalAuthority, captureSamePaCatchOriginals,
  assertSamePaCatchWorkContinuation, type AcceptedSamePaCatchWork, type SamePaCatchWorkOriginals, type SamePaCatchWorkReference } from './SamePlateAppearanceCatchWork';
import type { SamePaCatchCommunicationAuthority } from './SamePlateAppearanceCatchCommunicationSource';
import type { SamePaCatchCommunicationProposal } from './SamePlateAppearanceCatchCommunication';
import type { SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
import type { SamePaLifecyclePitchReference, SamePaLifecycleCut } from './SamePlateAppearanceLifecycle';
import { readSamePaFieldRuleEvidenceFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { deriveSamePaCatchOperativeRuling, type SamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
const table = 'pa_catch_v1_work' as const;
type Pending = Readonly<{ kind: 'pending'; reason: string }>;
const pending = (reason: string): Pending => freeze({ kind: 'pending', reason });
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA catch work original ownership differs'); };
export type SamePaCatchWork = Readonly<{ kind: 'same_pa_catch_work_v1'; source: AcceptedSamePaCatchWork; lineage: SamePaExecutionLineage;
  physicalPitchReference: SamePaLifecyclePitchReference; physicalOperationReference: SamePaLifecycleCut['physicalOperationReference'];
  evaluationTick: number; originalInputs: SamePaCatchWorkOriginals; communication: SamePaCatchCommunicationProposal; operative: SamePaCatchOperativeRuling;
  fieldCoverageHash: string; fieldCensusHash: string }>;
const rowFor = (v: SamePaCatchWork): Record<string, string | number> => ({
  source_id: v.source.sourceId, source_version: v.source.sourceVersion, career_id: v.lineage.careerId, game_id: v.lineage.gameId,
  play_id: v.lineage.playId, enrollment_source_id: v.lineage.enrollmentReference.sourceId, actor_source_id: v.lineage.actorReference.sourceId,
  first_pitch_source_id: v.lineage.firstPhysicalPitchSourceId, physical_pitch_source_id: v.physicalPitchReference.sourceId,
  physical_operation_identity: json(v.physicalOperationReference), action_source_id: v.originalInputs.action!.sourceId,
  view_source_id: v.source.viewReference.sourceId, source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v),
});
const row = (db: DatabaseSync, id: string) => {
  if (!samePaText(id)) throw new Error('invalid same-PA catch work identity');
  const rows = storage(db) ? db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }) : [];
  if (rows.length > 1 || rows.length === 1 && rows[0].source_id !== id) throw new Error('same-PA catch work Source alias differs');
  return rows[0] ?? null;
};
const derive = (db: DatabaseSync, s: AcceptedSamePaCatchWork, raw: SamePaCatchWorkOriginals, current: boolean): SamePaCatchWork | Pending => {
  if(current){const b=readHistoricalSamePaLifecycleViewFromSqlite(db,s.viewReference);assertNoSamePaCatchReviewSeal(db,b.view.lineage.gameId,b.view.lineage.playId);}
  const originals = samePaCatchWorkOriginalsInput(raw, s);
  const live = readSamePaLiveWorkFromSqlite(db, s.viewReference, current ? 'current' : 'historical', {
    sourceId: originals.source.sourceId, authority: samePaCatchOriginalAuthority(originals),
  });
  if (live.kind !== 'same_pa_live_work_read_v1') return pending('owned_live_field_required');
  const communication = live.communication;
  if (communication.kind !== 'same_pa_catch_communication_proposal_v1') return pending(communication.reason);
  if (!communication.emitted || communication.pendingReason) return pending(communication.pendingReason ?? 'accepted_original_catch_action_missing');
  const b = readHistoricalSamePaLifecycleViewFromSqlite(db, s.viewReference), cut = b.view.cut;
  same(s.enrollmentReference, b.view.lineage.enrollmentReference);
  if (cut.stage !== 'field_active' || cut.outcomeReference || cut.resetReference) throw new Error('same-PA catch work requires an open original live field');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('same-PA catch work original prefix missing');
  const prior = prefix.source.eventReferences.filter(r => r.owner === table).map(r => readSamePaCatchWorkFromSqlite(db, { ...r, owner: table }))
    .filter(r => json(r.physicalPitchReference) === json(cut.physicalPitchReference)).at(-1);
  same(s.priorWorkReference, prior ? reference(table, prior) : null);
  if (prior) {
    assertSamePaCatchWorkContinuation(prior.originalInputs, originals);
    if (communication.evaluatedThrough.elapsedSeconds < prior.communication.evaluatedThrough.elapsedSeconds) throw new Error('same-PA catch reception moved backwards');
    if (json(prior.physicalOperationReference) === json(cut.physicalOperationReference) && json(prior.originalInputs.model) === json(originals.model))
      throw new Error('same-PA catch work repeats an unchanged physical and reception cut');
  }
  // Only accepted action/reception evidence becomes owned here. Consumer work,
  // physical controller completion and end finalization remain separate causes.
  const { originalSourceSnapshot: _inputs, physicalCoverageHash, censusHash, ...proposal } = communication;
  const actionBasis = readSamePaFieldRuleEvidenceFromSqlite(db, originals.action!.viewReference, 'historical');
  if (actionBasis.kind !== 'same_pa_field_rule_evidence_v1') throw new Error('original catch action rule basis missing');
  const operative = deriveSamePaCatchOperativeRuling({ action: originals.action!, originalMatch: actionBasis.originalMatch,
    batterRunnerId: actionBasis.evidence.physical.field.evidence.batterRunnerId,
    basisTick: actionBasis.evidence.physical.field.evidence.horizon.ball.tick, basisEvidenceRevision: actionBasis.fieldReferences.length,
    fairCatch: actionBasis.fairCatch });
  return freeze({ kind: 'same_pa_catch_work_v1', source: s, lineage: b.view.lineage, physicalPitchReference: cut.physicalPitchReference,
    physicalOperationReference: cut.physicalOperationReference, evaluationTick: cut.evaluationTick, originalInputs: originals,
    communication: proposal, operative, fieldCoverageHash: physicalCoverageHash, fieldCensusHash: censusHash });
};
const read = (db: DatabaseSync, id: string): SamePaCatchWork | null => memoSamePaLifecycleRead(db, table + ':' + id, () => {
  const r = row(db, id); if (!r) return null;
  const s = samePaCatchWorkInput(JSON.parse(String(r.source_json)), id), saved = JSON.parse(String(r.snapshot_json));
  const value = derive(db, s, saved.originalInputs, false); if (value.kind === 'pending') throw new Error('owned catch work lost original prerequisite');
  same(r, rowFor(value)); return value;
});
export const readSamePaCatchWorkFromSqlite = (db: DatabaseSync, ref: SamePaCatchWorkReference): SamePaCatchWork => {
  if (!samePaReferenceValid(ref, table)) throw new Error('invalid same-PA catch work reference');
  const value = read(db, ref.sourceId); if (!value) throw new Error('same-PA catch work owner missing'); same(reference(table, value), ref); return value;
};
export const openSqliteSamePlateAppearanceCatchWorkStore = (path: string,
  authority?: SamePaCatchCommunicationAuthority & Readonly<{ readAcceptedWork(id: string): unknown }>) => {
  if (!samePaText(path) || authority && Object.values(authority).some(v => typeof v !== 'function')) throw new Error('invalid same-PA catch owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  const tx = battingInvocationTransaction(db, () => storage(db));
  const rows = () => storage(db) ? db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all() : [];
  const accept = (id: string): SamePaCatchWork | Pending => {
    if (!samePaText(id)) throw new Error('invalid same-PA catch work identity');
    const raw = authority?.readAcceptedWork(id) ?? null, source = raw === null ? null : samePaCatchWorkInput(raw, id);
    const prior = tx.run(false, proof => proof(() => read(db, id)), () => {});
    if (prior) { if (source) same(source, prior.source); return prior; }
    if (!source || !authority) return pending('accepted_original_catch_work_missing');
    const originals = captureSamePaCatchOriginals(source, authority); if (!originals) return pending('accepted_original_communication_missing');
    const before = tx.run(false, proof => proof(() => ({ value: derive(db, source, originals, true), rows: rows() })), () => {});
    if (before.value.kind === 'pending') return before.value;
    const value = before.value, added = rowFor(value), expected = [...before.rows, added];
    const finalProof = () => {
      const b = readHistoricalSamePaLifecycleViewFromSqlite(db, source.viewReference);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
      if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('same-PA catch prior prefix missing');
      assertSamePaLifecycleReservedStateFromSqlite(db, b);
      assertSamePaLifecycleWorkCoverage(db, source.enrollmentReference, prefix.source.anchorViewReference, [...prefix.source.eventReferences, reference(table, value)]);
      same(read(db, id), value); same(rows(), expected);
    };
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ value: derive(db, source, originals, true), rows: rows() })), before);
      if (!storage(db)) step(() => db.exec(schema), 0, 1);
      step(() => {
        const r = db.prepare('INSERT INTO main.' + table + ' VALUES(' + Object.keys(added).map(() => '?').join(',') + ')').run(...Object.values(added));
        if (r.changes !== 1) throw new Error('same-PA catch row delta differs');
      }, 1);
      proof(finalProof); return value;
    }, accepted => { same(accepted, value); finalProof(); });
  };
  return Object.freeze({ accept, read: (id: string) => tx.run(false, proof => proof(() => read(db, id)), () => {}), close: tx.close });
};
