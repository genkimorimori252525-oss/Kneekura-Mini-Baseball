import { createRequire } from 'node:module';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';
import { assertSamePaLiveBallStateStorage as storage, samePaLiveBallStateSchema as schema } from './SamePlateAppearanceLiveBallStateStorage';
import { samePaLiveBallStateTable as table, samePaLiveBallActionInput, captureSamePaLiveBallOriginals,
  type SamePaLiveBallStateAuthority } from './SamePlateAppearanceLiveBallStateSource';
import { samePaLiveBallStateRow, deriveSamePaLiveBallStateFromSqlite, readSamePaLiveBallStateByIdFromSqlite } from './SamePlateAppearanceLiveBallStateFromSqlite';
import { samePaLiveBallPending as pending, type SamePaLiveBallState, type SamePaLiveBallPending } from './SamePlateAppearanceLiveBallState';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('live-ball action original Source or current head changed'); };

/** Explicit admission only. No scheduler, catch result or pitch calls Play/Time. */
export const openSqliteSamePlateAppearanceLiveBallStateStore = (path: string, authority?: SamePaLiveBallStateAuthority) => {
  if (!samePaText(path) || authority && Object.values(authority).some(v => typeof v !== 'function')) throw new Error('invalid live-ball action owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  const tx = battingInvocationTransaction(db, () => storage(db));
  const rows = () => storage(db) ? db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all() : [];
  const read = (id: string) => readSamePaLiveBallStateByIdFromSqlite(db, id);
  const accept = (id: string): SamePaLiveBallState | SamePaLiveBallPending => {
    if (!samePaText(id)) throw new Error('invalid live-ball action identity');
    const raw = authority?.readAcceptedAction(id) ?? null, source = raw === null ? null : samePaLiveBallActionInput(raw, id);
    const prior = tx.run(false, proof => proof(() => read(id)), () => {});
    if (prior) {
      if (source) { same(source, prior.source); if (authority) {
        const originals = captureSamePaLiveBallOriginals(source, authority); if (originals) same(originals, prior.originalInputs);
      } }
      return prior;
    }
    if (!source || !authority) return pending('accepted_explicit_live_ball_action_missing');
    const originals = captureSamePaLiveBallOriginals(source, authority);
    if (!originals) return pending('original_plate_umpire_assignment_and_person_required');
    const before = tx.run(false, proof => proof(() => ({ value: deriveSamePaLiveBallStateFromSqlite(db, source, originals, true), rows: rows() })), () => {});
    if (before.value.kind === 'pending') return before.value;
    const value = before.value, added = samePaLiveBallStateRow(value), expected = [...before.rows, added];
    const finalProof = () => {
      const b = readHistoricalSamePaLifecycleViewFromSqlite(db, source.viewReference);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', b.view.source.prefixReference.sourceId);
      if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('live-ball prior prefix missing');
      assertSamePaLifecycleReservedStateFromSqlite(db, b);
      assertSamePaLifecycleWorkCoverage(db, source.enrollmentReference, prefix.source.anchorViewReference,
        [...prefix.source.eventReferences, reference(table, value)]);
      same(read(id), value); same(rows(), expected);
    };
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ value: deriveSamePaLiveBallStateFromSqlite(db, source, originals, true), rows: rows() })), before);
      if (!storage(db)) step(() => db.exec(schema), 0, 1);
      step(() => {
        const result = db.prepare('INSERT INTO main.' + table + ' VALUES(' + Object.keys(added).map(() => '?').join(',') + ')').run(...Object.values(added));
        if (result.changes !== 1) throw new Error('live-ball action row delta differs');
      }, 1);
      proof(finalProof); return value;
    }, accepted => { same(accepted, value); finalProof(); });
  };
  return Object.freeze({ accept, read: (id: string) => tx.run(false, proof => proof(() => read(id)), () => {}), close: tx.close });
};
