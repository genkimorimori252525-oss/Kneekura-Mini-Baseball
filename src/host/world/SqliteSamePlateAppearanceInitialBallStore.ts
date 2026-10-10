import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { samePaLiveBallAssignmentInput } from './SamePlateAppearanceLiveBallStateSource';
import { initialBallTables as tables, samePaInitialSetupInput, samePaInitialPlayInput, type SamePaInitialBallAuthority } from './SamePlateAppearanceInitialBallSource';
import { assertSamePaInitialBallStorage as storage, samePaInitialBallSchema as schema } from './SamePlateAppearanceInitialBallStorage';
import { deriveSamePaInitialSetupFromSqlite, deriveSamePaInitialPlay, type SamePaInitialBallSetup, type SamePaInitialPlay,
  type SamePaInitialPlayOriginals } from './SamePlateAppearanceInitialBallProof';
type Kind = keyof typeof tables;
type Value = SamePaInitialBallSetup | SamePaInitialPlay;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('initial ball Source or immutable owned row differs'); };
const pending = (reason: string) => freeze({ kind: 'pending' as const, reason });
export const samePaInitialBallRow = (v: Value, setup: SamePaInitialBallSetup = v as SamePaInitialBallSetup) => ({
  source_id: v.source.sourceId, source_version: v.source.sourceVersion, career_id: v.lineage.careerId, game_id: v.lineage.gameId,
  play_id: v.lineage.playId, enrollment_source_id: v.lineage.enrollmentReference.sourceId, actor_source_id: v.lineage.actorReference.sourceId,
  first_pitch_source_id: v.lineage.firstPhysicalPitchSourceId, view_source_id: setup.source.viewReference.sourceId,
  source_json: json(v.source), source_hash: hash(v.source), snapshot_json: json(v), snapshot_hash: hash(v),
});
const ownedRow = (db: DatabaseSync, kind: Kind, id: string) => {
  if (!samePaText(id)) throw new Error('invalid initial ball identity');
  const installed = storage(db);
  const matches = installed ? Object.values(tables).flatMap(table => db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id
    OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({ id }).map(row => ({table,row}))) : [];
  if (matches.length > 1 || matches.length === 1 && (matches[0].table !== tables[kind] || matches[0].row.source_id !== id))
    throw new Error('initial ball Source alias differs');
  if (!matches.length && installed && kind === 'setup' && db.prepare(`SELECT 1 FROM main.${tables.play} WHERE
    ${claim('source_json',['setupReference','sourceId'],'$id')} OR ${claim('snapshot_json',['setupReference','sourceId'],'$id')} LIMIT 1`).get({id}))
    throw new Error('initial setup missing with surviving Play claim; repair forbidden');
  return matches[0]?.row ?? null;
};
export const readSamePaInitialSetupFromSqlite = (db: DatabaseSync, ref: SamePaReference<typeof tables.setup>): SamePaInitialBallSetup => {
  if (!samePaReferenceValid(ref,tables.setup)) throw new Error('invalid initial setup reference');
  const row = ownedRow(db,'setup',ref.sourceId); if (!row) throw new Error('original initial setup missing');
  const source = samePaInitialSetupInput(JSON.parse(String(row.source_json)),ref.sourceId), saved = JSON.parse(String(row.snapshot_json));
  const value = deriveSamePaInitialSetupFromSqlite(db,source,saved.originalVenue,false);
  same(row,samePaInitialBallRow(value)); same(ref,reference(tables.setup,value)); return value;
};
export const readSamePaInitialPlayFromSqlite = (db: DatabaseSync, ref: SamePaReference<typeof tables.play>) => {
  if (!samePaReferenceValid(ref,tables.play)) throw new Error('invalid initial Play reference');
  const row = ownedRow(db,'play',ref.sourceId); if (!row) throw new Error('original initial Play missing');
  const source = samePaInitialPlayInput(JSON.parse(String(row.source_json)),ref.sourceId), saved = JSON.parse(String(row.snapshot_json));
  const setup = readSamePaInitialSetupFromSqlite(db,source.setupReference), play = deriveSamePaInitialPlay(source,setup,saved.originalInputs);
  same(row,samePaInitialBallRow(play,setup)); same(ref,reference(tables.play,play)); return freeze({ setup, play });
};
/** The only writers accept prospective explicit Sources. Reading saved evidence
 * never asks the outside authority to recreate historical Play. */
export const openSqliteSamePlateAppearanceInitialBallStore = (path: string, authority?: SamePaInitialBallAuthority) => {
  if (!samePaText(path) || authority && Object.values(authority).some(f => typeof f !== 'function')) throw new Error('invalid initial ball owner');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  const tx = battingInvocationTransaction(db,() => storage(db));
  const rows = () => storage(db) ? Object.values(tables).map(t => db.prepare('SELECT * FROM main.' + t + ' ORDER BY rowid').all()) : [[],[]];
  const read = (kind: Kind,id: string): Value | null => {
    const row = ownedRow(db,kind,id); if (!row) return null;
    const ref = { owner: tables[kind],sourceId:id,sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash) };
    return kind === 'setup' ? readSamePaInitialSetupFromSqlite(db,{...ref,owner:tables.setup}) : readSamePaInitialPlayFromSqlite(db,{...ref,owner:tables.play}).play;
  };
  const accept = (kind: Kind,id: string) => {
    if (!samePaText(id)) throw new Error('invalid initial ball identity');
    const raw = (kind === 'setup' ? authority?.readAcceptedSetup?.(id) : authority?.readAcceptedPlay?.(id)) ?? null;
    const source = raw === null ? null : kind === 'setup' ? samePaInitialSetupInput(raw,id) : samePaInitialPlayInput(raw,id);
    const prior = tx.run(false,proof => proof(() => read(kind,id)),() => {});
    if (prior) {
      if (source) {
        same(source,prior.source);
        if (source.capability === 'same_pa_initial_ball_setup_v1' && prior.kind === 'same_pa_initial_ball_setup_v1') {
          const original = authority?.readAcceptedVenue?.(source.venueReference.sourceId); if (original != null) same(original,prior.originalVenue);
        } else if (source.capability === 'same_pa_initial_play_v1' && prior.kind === 'same_pa_initial_play_v1') {
          const assignment = authority?.readAcceptedAssignment?.(source.assignmentReference.sourceId);
          if (assignment != null) { same(assignment,prior.originalInputs.assignment);
            const person = authority?.readAcceptedOfficialPerson?.(prior.originalInputs.assignment.personReference.sourceId);
            if (person != null) same(person,prior.originalInputs.person); }
        }
      }
      return prior;
    }
    if (!source || !authority) return pending('accepted_original_initial_ball_source_required');
    const original = source.capability === 'same_pa_initial_ball_setup_v1' ? authority.readAcceptedVenue?.(source.venueReference.sourceId)
      : (() => { const raw = authority.readAcceptedAssignment?.(source.assignmentReference.sourceId); if (!raw) return null;
        const assignment = samePaLiveBallAssignmentInput(raw,source.assignmentReference.sourceId);
        const person = authority.readAcceptedOfficialPerson?.(assignment.personReference.sourceId);
        return person ? { assignment,person } : null; })();
    if (!original) return pending(source.capability === 'same_pa_initial_ball_setup_v1' ? 'original_initial_venue_required' : 'original_plate_umpire_assignment_and_person_required');
    const derive = (fresh: boolean) => {
      if (source.capability === 'same_pa_initial_ball_setup_v1') { const setup = deriveSamePaInitialSetupFromSqlite(db,source,original,fresh); return { value: setup as Value,setup }; }
      const setup = readSamePaInitialSetupFromSqlite(db,source.setupReference);
      if (fresh) same(deriveSamePaInitialSetupFromSqlite(db,setup.source,setup.originalVenue,true),setup);
      return { value: deriveSamePaInitialPlay(source,setup,original as SamePaInitialPlayOriginals) as Value,setup };
    };
    const before = tx.run(false,proof => proof(() => ({ ...derive(true),rows:rows() })),() => {});
    const added = samePaInitialBallRow(before.value,before.setup), expected = before.rows.map(r => [...r]); expected[kind === 'setup' ? 0 : 1].push(added);
    const verify = () => { same(read(kind,id),before.value); same(rows(),expected); };
    return tx.run(true,(proof,step) => {
      same(proof(() => ({ ...derive(true),rows:rows() })),before);
      if (!storage(db)) for (const sql of Object.values(schema)) step(() => db.exec(sql),0,1);
      step(() => { const delta = db.prepare('INSERT INTO main.' + tables[kind] + ' VALUES(' + Object.keys(added).map(() => '?').join(',') + ')').run(...Object.values(added));
        if (delta.changes !== 1) throw new Error('initial ball exact row delta differs'); },1);
      proof(verify); return before.value;
    },verify);
  };
  return Object.freeze({ acceptSetup:(id: string) => accept('setup',id),acceptPlay:(id: string) => accept('play',id),
    readSetup:(id: string) => tx.run(false,p => p(() => read('setup',id)),() => {}),readPlay:(id: string) => tx.run(false,p => p(() => read('play',id)),() => {}),close:tx.close });
};
