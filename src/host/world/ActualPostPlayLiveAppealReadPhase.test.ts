import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import { readPostPlayOriginalLiveAppeal } from './ActualPostPlayLiveAppealFromSqlite';
import * as seedReader from './SamePlateAppearanceCatchReviewFromSqlite';
import * as pairReader from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import * as physicalReader from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { memoSamePaLifecycleRead } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';
import type { ActualPostPlayReviewProjection } from './ActualPostPlayReviewState';

const pin = <O extends string>(owner: O, sourceId: string): SamePaReference<O> =>
  ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash([sourceId]) });
const moment = (elapsedSeconds: number) => ({ originTick: 0, elapsedSeconds, tick: elapsedSeconds * 1_000_000 });
const field = (elapsedSeconds: number) => ({ motion: { world: { moment: {
  ...moment(elapsedSeconds), ball: { tick: elapsedSeconds * 1_000_000 },
} } } });

/** Only the archived baseball reader boundaries are substituted. Their frozen
 * records exercise the import's real comparisons and ready result. The Native
 * transaction, lifecycle memo and cleanup are real; this is not LAN acceptance. */
const archivedInputs = () => {
  const lineage = { careerId: 'career', gameId: 'game', playId: 1 };
  const originalMatch = { bases: { first: 'runner', second: null, third: null } };
  const actor = { match: originalMatch, defenderBindings: [{ playerId: 'defender' }] };
  const physicalPitchReference = pin('pa_physical_v1_launches', 'pitch');
  const viewReference = pin('pa_lifecycle_v1_execution_views', 'view');
  const root = freeze({ kind: 'same_pa_physical_field_root_v1',
    source: { sourceId: 'root', sourceVersion: 'fixture' }, lineage, evaluationTick: 0, field: field(0) });
  const rootReference = reference('pa_physical_v1_field_roots', root);
  const indication = freeze({ kind: 'same_pa_physical_field_step_v1', operationOrdinal: 1, evaluationTick: 1_000_000,
    source: { sourceId: 'indication', sourceVersion: 'fixture', fieldRootReference: rootReference,
      action: { kind: 'appeal_indication_v1' } }, field: field(1),
    actionResult: { kind: 'appeal_indication_v1', defenderId: 'defender', runnerId: 'runner', base: 'first',
      contact: 'base', indicatedAt: moment(1) } });
  const indicationReference = reference('pa_physical_v1_field_steps', indication);
  const throwPlan = freeze({ kind: 'same_pa_physical_field_step_v1', operationOrdinal: 2, evaluationTick: 3_000_000,
    source: { sourceId: 'throw', sourceVersion: 'fixture', fieldRootReference: rootReference,
      action: { kind: 'throw_plan_v1', appealIndicationReference: indicationReference } }, field: field(3),
    actionResult: { kind: 'throw_plan_v1', appealIndicationReference: indicationReference } });
  const throwPlanReference = reference('pa_physical_v1_field_steps', throwPlan);
  const execution = { kind: 'executed', moment: moment(3), indicatedAt: moment(1),
    attempt: { defenderId: 'defender', runnerId: 'runner', base: 1 }, contact: { kind: 'base' },
    complianceEvidence: { kind: 'ball_world_tag_up_history_v1' },
    rights: { kind: 'pending', reason: 'original_live_ball_and_appeal_rights_required' } };
  const receipt = freeze({ kind: 'same_pa_physical_field_step_v1', operationOrdinal: 3,
    physicalPitchSourceId: physicalPitchReference.sourceId, evaluationTick: 3_000_000, field: throwPlan.field,
    source: { sourceId: 'execution', sourceVersion: 'fixture', fieldRootReference: rootReference,
      previousFieldReference: throwPlanReference, previousOperationReference: throwPlanReference,
      action: { kind: 'appeal_contact_v1', indicationReference, throwPlanReference } },
    actionResult: { kind: 'appeal_contact_v1', indicationReference, throwPlanReference, execution } });
  const executionReference = reference('pa_physical_v1_field_steps', receipt);
  const scope = freeze({ ...lineage, physicalPitchSourceId: physicalPitchReference.sourceId, originalMatch }) as unknown as PostPlayReviewNativeScope;
  const previous = freeze({ source: { reservedCatchSeed: { viewReference, physicalOperationReference: executionReference } },
    seed: { exactEnd: moment(3) }, cursor: { originTick: 0, ticksPerSecond: 1_000_000, offsetTicks: 0 } }) as unknown as ActualPostPlayReviewProjection;
  const pair = freeze({ kind: 'same_pa_field_rule_read_pair_v1', actor, view: { lineage },
    fields: [root, indication, throwPlan, receipt], value: { physicalOperationReference: executionReference, physicalPitchReference } }) as unknown as
    ReturnType<typeof pairReader.readSamePaFieldRuleEvidenceWithInputsFromSqlite>;
  const operations = new Map([receipt, indication, throwPlan].map(record => [
    json(reference('pa_physical_v1_field_steps', record)),
    freeze({ record, actor, lineage, physicalPitchReference }) as unknown as ReturnType<typeof physicalReader.readSamePaPhysicalOperationFromSqlite>,
  ]));
  return { scope, previous, pair, operations, executionReference, viewReference };
};

it('LPIR01 shares sequential import reads only within each current or historical Native invocation', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:'), inputs = archivedInputs();
  const spies: { mockRestore(): void }[] = [];
  try {
    db.exec('CREATE TABLE original_import_probe(value INTEGER); INSERT INTO original_import_probe VALUES(7)');
    const bytes = json(db.prepare('SELECT * FROM original_import_probe').all());
    const changes = db.prepare('SELECT total_changes() AS n').get()!.n;
    let materializations = 0;
    const observations: { stage: string; proof: Readonly<{ value: number }> }[] = [];
    const observe = (stage: string) => {
      const proof = memoSamePaLifecycleRead(db, 'import-test-original', () => {
        materializations++;
        return freeze({ value: Number(db.prepare('SELECT value FROM original_import_probe').get()!.value) });
      });
      observations.push({ stage, proof });
    };
    spies.push(vi.spyOn(seedReader, 'deriveSamePaCatchReviewNativeSeed').mockImplementation((connection, source, current) => {
      expect(connection).toBe(db); expect(source).toEqual(inputs.previous.source.reservedCatchSeed);
      observe('seed:' + current);
      return freeze({ seed: inputs.previous.seed, scope: inputs.scope });
    }));
    spies.push(vi.spyOn(pairReader, 'readSamePaFieldRuleEvidenceWithInputsFromSqlite').mockImplementation((connection, ref, mode) => {
      expect(connection).toBe(db); expect(ref).toEqual(inputs.viewReference); observe('pair:' + mode);
      return inputs.pair;
    }));
    spies.push(vi.spyOn(physicalReader, 'readSamePaPhysicalOperationFromSqlite').mockImplementation((connection, ref) => {
      expect(connection).toBe(db); observe('physical:' + ref.sourceId);
      const value = inputs.operations.get(json(ref)); if (!value) throw new Error('unrecognized fixture physical reference');
      return value;
    }));
    const returned: string[] = [];
    let priorProof: Readonly<{ value: number }> | undefined;
    withSqliteReadTransaction(db, () => {
      for (const [index, current] of [true, false, true].entries()) {
        const start = observations.length;
        const result = readPostPlayOriginalLiveAppeal(db, inputs.scope, inputs.previous, inputs.executionReference, current);
        if (result.kind !== 'ready') throw new Error('fixture import did not complete');
        const calls = observations.slice(start), proof = calls[0].proof;
        expect(calls.map(call => call.stage)).toEqual(['seed:' + current, 'pair:' + (current ? 'current' : 'historical'),
          'physical:execution', 'physical:indication', 'physical:throw']);
        expect(proof).toEqual({ value: 7 }); expect(calls.every(call => call.proof === proof)).toBe(true);
        expect(materializations).toBe(index + 1); expect(proof).not.toBe(priorProof); priorProof = proof;
        expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.liveAppealImport.provenance)).toBe(true);
        returned.push(json(result));
      }
    });
    expect(new Set(returned).size).toBe(1);
    expect(json(db.prepare('SELECT * FROM original_import_probe').all())).toBe(bytes);
    expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { for (const spy of spies.reverse()) spy.mockRestore(); if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});
