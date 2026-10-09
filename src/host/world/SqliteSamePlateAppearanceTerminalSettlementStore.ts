import { createRequire } from 'node:module';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { physicalStoreTransactionBoundary } from './PhysicalStoreTransactionBoundary';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { playerWorkloadRecoveryStoreFromSqlite } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { authenticateSamePaRow, samePaEnrollmentRow } from './SamePlateAppearanceReservationGuard';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { samePaTerminalSettlementInput, type SamePaTerminalSettlement, type SamePaTerminalSettlementPlan } from './SamePlateAppearanceTerminalSettlement';
import { assertSamePaSettlementStorage, readSamePaSettlementPlanRow, samePaSettlementPlanRow, samePaSettlementSchema } from './SamePlateAppearanceTerminalSettlementStorage';
import { deriveSamePaTerminalSettlementPlan, readSamePaTerminalSettlementFromSqlite, readSamePaTerminalReleaseFromSqlite, samePaSettlementReference } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { withSamePaSettlementActivityWrite } from './SamePlateAppearanceSettlementAdmission';
import { readSamePaTerminalTransitionFromSqlite } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { samePaOriginalMemberRows, samePaTerminalReleaseRow, type SamePaTerminalRelease } from './SamePlateAppearanceTerminalReleaseArchive';
import { readSamePaReleasedClaimCensus } from './SamePlateAppearanceReleasedClaimCensus';

const same = (a: unknown, b: unknown, detail: string) => { if (json(a) !== json(b)) throw new Error('same-PA settlement ' + detail); };
/** Owns only the terminal settlement plan, normal workload activities and the
 * final reservation release. No physical/official receipt is synthesized here. */
export const openSqliteSamePlateAppearanceTerminalSettlementStore = (path: string,
  personLinks: Pick<SqlitePlayerPersonLinkStore, 'readLink'>,
  authority?: Readonly<{ readAcceptedSettlement(sourceId: string): unknown }>) => {
  if (!samePaText(path) || !isAbsolute(path) || realpathSync(path) !== path || !lstatSync(path).isFile()
    || typeof personLinks?.readLink !== 'function' || authority && typeof authority.readAcceptedSettlement !== 'function') throw new Error('invalid same-PA settlement owner');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path), tx = physicalStoreTransactionBoundary(db, 'same-PA terminal settlement');
  const proof = <T>(body: () => T): T => withBattedWorldPhysicalReadTraversal(db, body);
  const counters = () => ({ changes: db.prepare('SELECT total_changes() n').get()!.n,
    main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
    user: db.prepare('PRAGMA main.user_version').get()!.user_version });
  const writing = <T>(body: () => { value: T; changes: number; schemas?: number }): T => {
    const before = counters();
    return tx.write(() => {
      same(counters(), before, 'acquisition changed rows or schema');
      const result = body();
      same(counters(), { ...before, changes: Number(before.changes) + result.changes, main: Number(before.main) + (result.schemas ?? 0) }, 'write accounting differs');
      return result.value;
    });
  };
  const check = (id: string) => { tx.check(); if (!samePaText(id)) throw new Error('invalid same-PA settlement Source identity'); };
  const plan = (id: string) => {
    const value = readSamePaSettlementPlanRow(db, id);
    if (!value) throw new Error('same-PA settlement plan missing');
    return value;
  };
  const read = (id: string): SamePaTerminalSettlement | null => {
    check(id); return tx.read(() => {
      const original = readSamePaSettlementPlanRow(db, id);
      return original ? readSamePaTerminalSettlementFromSqlite(db, samePaSettlementReference(original)) : null;
    });
  };
  const committed = <T>(value: T, verify: () => void): T => {
    try { tx.read(verify); return value; }
    catch (error) { tx.close(); throw new Error('same-PA settlement committed result could not be verified; owner retired without compensating repair', { cause: error }); }
  };
  try { tx.read(() => assertSamePaSettlementStorage(db)); }
  catch (error) { tx.close(); throw error; }
  let active: SamePaTerminalSettlementPlan['participants'][number] | null = null;
  let workload: ReturnType<typeof playerWorkloadRecoveryStoreFromSqlite>;
  try {
    workload = playerWorkloadRecoveryStoreFromSqlite(db, personLinks, {
      readAcceptedBaseline: () => null,
      readAcceptedActivity: id => active?.activity.sourceEventId === id ? active.activity : null,
    }, {
      transaction: body => {
        if (!db.isTransaction || !active) throw new Error('same-PA settlement normal writer has no owned transaction');
        return body();
      },
      activity: (connection, activity) => {
        if (connection !== db || !db.isTransaction || !active) throw new Error('same-PA settlement normal writer connection differs');
        same(activity, active.activity, 'normal writer activity differs');
      },
    });
  } catch (error) { tx.close(); throw error; }
  const freeze = (id: string): SamePaTerminalSettlement => {
    check(id);
    const raw = authority?.readAcceptedSettlement(id) ?? null;
    const source = raw === null ? null : samePaTerminalSettlementInput(raw, id);
    const prior = read(id);
    if (prior) { if (source) same(source, prior.plan.source, 'Source already frozen differently'); return prior; }
    if (!source) throw new Error('accepted same-PA terminal settlement Source missing');
    const candidate = tx.read(() => deriveSamePaTerminalSettlementPlan(db, source, 'current'));
    const saved = writing(() => {
      proof(() => same(deriveSamePaTerminalSettlementPlan(db, source, 'current'), candidate, 'terminal basis changed before freeze'));
      const installed = proof(() => assertSamePaSettlementStorage(db));
      if (!installed) for (const sql of Object.values(samePaSettlementSchema)) db.exec(sql);
      proof(() => {
        assertSamePaSettlementStorage(db);
        same(deriveSamePaTerminalSettlementPlan(db, source, 'current'), candidate, 'terminal basis changed after storage installation');
        if (db.prepare('SELECT 1 FROM main.pa_settlement_v1_plans WHERE source_id=? OR enrollment_source_id=? OR terminal_source_id=? OR (game_id=? AND play_id=?)')
          .get(id, candidate.enrollmentReference.sourceId, source.terminalReference.sourceId, candidate.lineage.gameId, candidate.lineage.playId)) throw new Error('same-PA settlement canonical plan already exists');
      });
      db.prepare('INSERT INTO main.pa_settlement_v1_plans VALUES(?,?,?,?,?,?,?,?,?,?)').run(...Object.values(samePaSettlementPlanRow(candidate)));
      const value = proof(() => readSamePaTerminalSettlementFromSqlite(db, samePaSettlementReference(candidate)));
      return { value, changes: 1, schemas: installed ? 0 : 2 };
    });
    return committed(saved, () => same(readSamePaTerminalSettlementFromSqlite(db, saved.reference), saved, 'committed plan differs'));
  };
  const settle = (id: string): SamePaTerminalSettlement => {
    const frozen = freeze(id);
    for (const participant of frozen.participants) {
      if (participant.applied) continue;
      const after = writing(() => {
        const current = proof(() => readSamePaTerminalSettlementFromSqlite(db, frozen.reference, 'current'));
        const target = current.participants.find(p => p.playerId === participant.playerId)!;
        if (target.applied) return { value: target.projectedState, changes: 0 };
        // No unrelated head may move while the PA is still reserved.
        proof(() => {
          const root = authenticateSamePaRow(db, samePaEnrollmentRow(db, current.plan.enrollmentReference.sourceId)!);
          for (const p of current.participants) {
            const member = root.participants.find(m => m.binding.playerId === p.playerId)!;
            same(readActualRoleWorkloadState(db, current.plan.lineage.careerId, p.playerId, undefined, member.binding.personLinkSourceId),
              p.applied ? p.projectedState : p.reservedState, 'active reserved head changed');
          }
        });
        active = target;
        try {
          const value = withSamePaSettlementActivityWrite(db, frozen.reference, target.playerId,
            () => workload.apply(target.activity.sourceEventId, target.reservedState.revision));
          same(value, target.projectedState, 'normal durable AFTER differs from projected AFTER');
          proof(() => {
            const saved = readSamePaTerminalSettlementFromSqlite(db, frozen.reference, 'current');
            same(saved.participants, current.participants.map(p => p.playerId === target.playerId ? { ...p, applied: true } : p), 'normal writer changed another participant');
          });
          return { value, changes: 2 };
        } finally { active = null; }
      });
      committed(after, () => {
        const saved = readSamePaTerminalSettlementFromSqlite(db, frozen.reference, 'current').participants.find(p => p.playerId === participant.playerId)!;
        if (!saved.applied) throw new Error('same-PA settlement committed effect missing');
        same(saved.projectedState, after, 'committed effect differs');
      });
    }
    const result = read(id)!;
    if (result.kind !== 'settled') throw new Error('same-PA settlement ten durable effects incomplete');
    return result;
  };
  const readRelease = (id: string): SamePaTerminalRelease | null => {
    check(id); return tx.read(() => readSamePaTerminalReleaseFromSqlite(db, plan(id).enrollmentReference.sourceId));
  };
  const release = (id: string) => {
    check(id);
    const prior = readRelease(id); if (prior) return prior;
    const value = writing(() => {
      const prepared = proof(() => {
        const original = plan(id), reference = samePaSettlementReference(original), settled = readSamePaTerminalSettlementFromSqlite(db, reference);
        if (settled.kind !== 'settled') throw new Error('same-PA release requires all ten durable effects');
        const transition = readSamePaTerminalTransitionFromSqlite(db, original.source.terminalReference, 'current');
        if (transition.kind !== 'completed') throw new Error('same-PA release requires completed PA transition');
        same(transition.settlementReference, reference, 'transition settlement reference differs');
        same(transition.terminalReference, original.source.terminalReference, 'transition terminal reference differs');
        const enrollment = authenticateSamePaRow(db, samePaEnrollmentRow(db, original.enrollmentReference.sourceId)!);
        return { enrollment, release: { kind: 'same_pa_terminal_release_v1', settlementReference: reference,
          enrollmentReference: original.enrollmentReference, terminalReference: original.source.terminalReference,
          transitionReference: transition.reference, memberRows: samePaOriginalMemberRows(enrollment),
          claimCensus: readSamePaReleasedClaimCensus(db, enrollment.source.sourceId) } as SamePaTerminalRelease };
      });
      // One owned release transaction archives every original lease byte and
      // retires exactly those original active rows. No authority callback intervenes.
      db.prepare('INSERT INTO main.pa_settlement_v1_releases VALUES(?,?,?,?,?)').run(...Object.values(samePaTerminalReleaseRow(prepared.release)));
      for (const row of prepared.release.memberRows) {
        const changed = db.prepare('DELETE FROM main.same_pa_participant_reservations WHERE enrollment_source_id=? AND player_id=? AND member_json=?')
          .run(row.enrollment_source_id, row.player_id, row.member_json);
        if (changed.changes !== 1) throw new Error('same-PA release active lease changed');
      }
      const saved = proof(() => readSamePaTerminalReleaseFromSqlite(db, prepared.enrollment.source.sourceId));
      same(saved, prepared.release, 'released member archive differs');
      return { value: prepared.release, changes: 1 + prepared.release.memberRows.length };
    });
    return committed(value, () => same(readSamePaTerminalReleaseFromSqlite(db, value.enrollmentReference.sourceId), value, 'committed release differs'));
  };
  return Object.freeze({ freeze, settle, read, release, readRelease, close: () => tx.close() });
};
