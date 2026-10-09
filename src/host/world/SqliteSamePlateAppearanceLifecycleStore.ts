import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRequire } from 'node:module';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaLifecycleSchema as schema, assertSamePaLifecycleStorage as storage } from './SamePlateAppearanceLifecycleStorage';
import { samePaLifecycleTables as tables, samePaLifecycleSourceInput as input,
  type SamePaLifecycleRecord as RecordValue, type SamePaLifecyclePrefix, type SamePaLifecycleView,
  type SamePaLifecycleTotal } from './SamePlateAppearanceLifecycle';
import type { SamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibration';
import { samePaLifecycleRow as rowFor, samePaLifecycleKind, type SamePaLifecycleKind as Kind, deriveCurrentSamePaLifecycleFromSqlite as derive,
  deriveCurrentSamePaLifecycleSetFromSqlite as deriveSet, readSamePaLifecycleRecordFromSqlite as readRecord,
  readSamePaLifecycleSetFromSqlite as readSet } from './SamePlateAppearanceLifecycleFromSqlite';
type Authority = Readonly<{ readAcceptedPrefix?(id: string): unknown; readAcceptedTotal?(id: string): unknown; readAcceptedView?(id: string): unknown; readAcceptedCalibration?(id: string): unknown }>;
type Pending = Readonly<{ kind: 'pending'; missingAcceptedSourceIds: readonly string[] }>;
const pending = (ids: readonly string[]): Pending => freeze({ kind: 'pending', missingAcceptedSourceIds: ids });
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA lifecycle exact write or original Source differs'); };
export const openSqliteSamePlateAppearanceLifecycleStore = (path: string, authority?: Authority) => {
  if (!samePaText(path) || authority && Object.values(authority).some(v => typeof v !== 'function')) throw new Error('invalid same-PA lifecycle owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  const tx = battingInvocationTransaction(db, () => storage(db)), names = Object.values(tables);
  const rows = () => storage(db) ? names.map(t => db.prepare('SELECT * FROM main.' + t + ' ORDER BY rowid').all()) : names.map(() => []);
  const read = (kind: Kind, id: string) => {
    if (!samePaText(id)) throw new Error('invalid lifecycle Source identity');
    return tx.run(false, proof => proof(() => readRecord(db, kind, id)), () => {});
  };
  const parsed = (kind: Kind, raw: unknown, id: string) => { const s = input(raw, id); if (samePaLifecycleKind(s) !== kind) throw new Error('lifecycle Source owner differs'); return s; };
  const canonical = (kind: Kind, row: Record<string, string | number>) => {
    const keys = kind === 'prefix' ? ['enrollment_source_id', 'event_set_hash'] : kind === 'total' ? ['prefix_source_id', 'player_id']
      : kind === 'view' ? ['enrollment_source_id', 'prefix_source_id'] : ['view_source_id', 'player_id', 'route', 'nominal_parameter_identity'];
    const previous = db.prepare(`SELECT source_id FROM main.${tables[kind]} WHERE ${keys.map(k => k + '=?').join(' AND ')}`).get(...keys.map(k => row[k]));
    if (previous && previous.source_id !== row.source_id) throw new Error('same-PA lifecycle canonical Source alias rejected');
  };
  const accept = (kind: Exclude<Kind, 'total' | 'calibration'>, id: string): RecordValue | Pending => {
    const raw = (kind === 'prefix' ? authority?.readAcceptedPrefix : authority?.readAcceptedView)?.(id) ?? null;
    const source = raw === null ? null : parsed(kind, raw, id), prior = read(kind, id);
    if (prior) { if (source) same(prior.source, source); return prior; } if (!source) return pending([id]);
    const preflight = tx.run(false, proof => proof(() => ({ value: derive(db, source), rows: rows() })), () => {});
    const row = rowFor(preflight.value), expected = preflight.rows.map(r => [...r]); expected[names.indexOf(tables[kind])].push(row);
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ value: derive(db, source), rows: rows() })), preflight);
      if (!storage(db)) { if (kind !== 'prefix') throw new Error('same-PA nonempty prefix namespace missing');
        for (const sql of Object.values(schema)) step(() => db.exec(sql), 0, 1);
        same(proof(() => derive(db, source)), preflight.value);
      }
      canonical(kind, row);
      step(() => { const result = db.prepare(`INSERT INTO main.${tables[kind]} VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
        if (result.changes !== 1) throw new Error('same-PA lifecycle exact row delta differs'); }, 1);
      proof(() => { same(derive(db, source), preflight.value); same(readRecord(db, kind, id), preflight.value); same(rows(), expected); });
      return preflight.value;
    }, value => { same(readRecord(db, kind, id), value); same(rows(), expected); });
  };
  const acceptSet = (kind: 'total' | 'calibration', suppliedIds: readonly string[]) => {
    const rawIds = cloneInert(suppliedIds);
    const count = kind === 'total' ? 10 : 32;
    if (!Array.isArray(rawIds) || rawIds.length !== count || rawIds.some(id => !samePaText(id)) || new Set(rawIds).size !== count) throw new Error('same-PA lifecycle exact participant set required');
    const ids = [...rawIds], captured = ids.map(id => { const raw = (kind === 'total' ? authority?.readAcceptedTotal : authority?.readAcceptedCalibration)?.(id) ?? null;
      return raw === null ? null : parsed(kind, raw, id); });
    const prior = tx.run(false, proof => proof(() => readSet(db, kind, ids)), () => {});
    if (prior.some(Boolean) && prior.some(v => !v)) throw new Error('same-PA lifecycle partial accepted set cannot be repaired');
    if (prior.every(Boolean)) {
      prior.forEach((v, i) => { if (captured[i]) same(v!.source, captured[i]); });
      return setResult(kind, prior as RecordValue[]);
    }
    if (captured.some(s => !s)) return pending(ids.filter((_id, i) => !captured[i]));
    const sources = captured.map(s => s!), first = sources[0];
    if (sources.some(s => !('provenance' in s)) || new Set(sources.map(s => 'provenance' in s ? s.provenance.assessmentSourceId : '')).size !== count) throw new Error('same-PA lifecycle assessment provenance duplicated');
    for (const s of sources) {
      same(s.enrollmentReference, first.enrollmentReference);
      if (kind === 'total' && s.capability === 'same_pa_lifecycle_cumulative_total_v1' && first.capability === s.capability) same(s.prefixReference, first.prefixReference);
      else if (kind === 'calibration' && s.capability === 'same_pa_lifecycle_execution_calibration_v1' && first.capability === s.capability) same(s.viewReference, first.viewReference);
      else throw new Error('same-PA lifecycle set Source domain differs');
    }
    const preflight = tx.run(false, proof => proof(() => ({ values: deriveSet(db, sources), rows: rows() })), () => {});
    assertSet(kind, preflight.values);
    const added = preflight.values.map(rowFor), expected = preflight.rows.map(r => [...r]); expected[names.indexOf(tables[kind])].push(...added);
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ values: deriveSet(db, sources), rows: rows() })), preflight); added.forEach(r => canonical(kind, r));
      step(() => { const result = db.prepare(`INSERT INTO main.${tables[kind]} VALUES ${added.map(row => '(' + Object.keys(row).map(() => '?').join(',') + ')').join(',')}`).run(...added.flatMap(Object.values));
        if (result.changes !== count) throw new Error('same-PA lifecycle exact set delta differs'); }, count);
      proof(() => { same(deriveSet(db, sources), preflight.values); same(readSet(db, kind, ids), preflight.values); same(rows(), expected); });
      return setResult(kind, preflight.values);
    }, value => { same(setResult(kind, readSet(db, kind, ids) as RecordValue[]), value); same(rows(), expected); });
  };
  const assertSet = (kind: 'total' | 'calibration', values: readonly RecordValue[]) => {
    const first = values[0]; if (!first || values.length !== (kind === 'total' ? 10 : 32)) throw new Error('same-PA lifecycle set incomplete');
    const assessments = new Set<string>();
    for (const value of values) {
      same(value.lineage, first.lineage);
      if (value.kind === 'same_pa_lifecycle_total' && first.kind === value.kind) same(value.source.prefixReference, first.source.prefixReference);
      else if (value.kind === 'same_pa_lifecycle_calibration' && first.kind === value.kind) same(value.source.viewReference, first.source.viewReference);
      else throw new Error('same-PA lifecycle set contains a foreign owner');
      if (assessments.has(value.source.provenance.assessmentSourceId)) throw new Error('same-PA lifecycle set repeats assessment provenance');
      assessments.add(value.source.provenance.assessmentSourceId);
    }
    if (kind === 'total') {
      const totals = values as readonly SamePaLifecycleTotal[], ids = totals.map(v => v.source.participantReference.playerId).sort();
      same(ids, totals[0].lineage.participantReferences.map(p => p.playerId).sort());
    } else {
      const calibrations = values as readonly SamePaLifecycleCalibration[];
      const groups = new Map<string, string[]>();
      for (const v of calibrations) { const routes = groups.get(v.source.member.playerId) ?? []; routes.push(v.source.route); groups.set(v.source.member.playerId, routes); }
      if (groups.size !== 10) throw new Error('same-PA lifecycle all-ten calibration coverage missing');
      const signatures = [...groups.values()].map(routes => routes.sort().join(','));
      const batter = 'batter_decision,batter_motor,batter_observation,batter_swing', defender = 'defender_decision,defender_locomotion,defender_observation';
      if (signatures.filter(s => s === batter).length !== 1 || signatures.filter(s => s === defender).length !== 8
        || signatures.filter(s => s === defender + ',pitch_delivery').length !== 1) throw new Error('same-PA lifecycle all32 route coverage differs');
    }
  };
  const setResult = (kind: 'total' | 'calibration', values: readonly RecordValue[]) => {
    assertSet(kind, values);
    return kind === 'total' ? freeze({ kind: 'same_pa_lifecycle_total_set' as const, totals: values as readonly SamePaLifecycleTotal[],
      participantTotalReferences: (values as readonly SamePaLifecycleTotal[]).map(v => ({ playerId: v.source.participantReference.playerId, assessmentReference: reference(tables.total, v) })) })
      : freeze({ kind: 'same_pa_lifecycle_calibration_set' as const, calibrations: values as readonly SamePaLifecycleCalibration[],
        calibrationReferences: values.map(v => reference(tables.calibration, v)) });
  };
  return Object.freeze({ acceptPrefix: (id: string) => accept('prefix', id) as SamePaLifecyclePrefix | Pending,
    acceptView: (id: string) => accept('view', id) as SamePaLifecycleView | Pending,
    readPrefix: (id: string) => read('prefix', id) as SamePaLifecyclePrefix | null, readView: (id: string) => read('view', id) as SamePaLifecycleView | null,
    acceptTotalSet: (ids: readonly string[]) => acceptSet('total', ids), acceptCalibrationSet: (ids: readonly string[]) => acceptSet('calibration', ids),
    close: tx.close });
};
