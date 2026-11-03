import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { initialQualifiedSpinFixtureV133 } from './InitialQualifiedSpinV133.test-support';
import { REGISTERED_MEASURED_LINEAR_V133 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import { registeredMeasuredMotorBindingV133 } from './StandaloneMeasuredPracticeV133';
import { readSamePaSpinContextV123 } from './SamePlateAppearanceSpinBindingV123';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readNativeSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Genuine same-DB measured practice/qualification and pre-enrollment binding.
 * This is not the initial pitch/joint/contact Gate and does not replace its
 * original nine defenders, 32 calibrations or current admission. */
it('IMP133 qualifies only the actual registered measured practice motor of the original early Actor and can reopen its complete proof', () => {
  const start = Date.now(), stage = (name: string) => {
    process.stdout.write('IMP133-stage ' + name + ' ' + (Date.now() - start) + 'ms\n');
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.IMP133-stages.jsonl', JSON.stringify({ name, elapsedMs: Date.now() - start }) + '\n');
  };
  const f = initialQualifiedSpinFixtureV133(stage);
  let originalsClosed = false;
  try {
    expect(f.genesis.models).toHaveLength(18); expect(f.actor.defenderBindings).toHaveLength(9);
    expect(f.batting.source.acceptedAtDay).toBe(1); expect(f.batting.bodyMaterialization.source.atDay).toBe(1);
    expect(f.qualification.source).toMatchObject({ careerId: f.actor.binding.careerId, playerId: f.actor.binding.playerId,
      personLinkSourceId: f.actor.binding.personLinkSourceId, acceptedAtDay: 9, technique: 'BACKSPIN' });
    expect(f.qualification.contacts).toHaveLength(3);
    const r = f.qualification.motorProfileRefs[0], binding = registeredMeasuredMotorBindingV133(f.batting.repertoire.values, f.batting.equipment.values, r);
    expect(f.qualification.motorBindingsV133).toEqual([binding]);
    for (const contact of f.qualification.contacts) expect(contact.motorBindingV133).toEqual(binding);
    const modelReference = reference('world_player_batting_models', f.batting);
    const fixed = { kind: 'fixed_native_spin_binding_v123' as const, modelReference,
      intent: { technique: 'BACKSPIN' as const, selectedAtTick: 100 }, qualificationReferences: [f.qualificationReference] };
    const read = () => {
      const db = f.openReader();
      try { return withSqliteReadTransaction(db, () => ({
        context: readSamePaSpinContextV123(db, fixed, { actor: f.actor, modelReference, decisionTick: 100, effectiveRepertoire: f.batting.repertoire.values }),
        qualification: readNativeSpinControlMasteryV123(db, f.qualification.source.sourceId),
      })); } finally { db.close(); }
    };
    const accepted = read();
    expect(accepted.qualification).toEqual(f.qualification);
    expect(accepted.context.techniques[0].motorProfileRefs).toEqual([{ ...r, implementationV133: REGISTERED_MEASURED_LINEAR_V133 }]);
    f.close(); originalsClosed = true;
    expect(read()).toEqual(accepted);
    stage('reopened-original-measured-qualification-and-binding-ready');
  } finally { if (!originalsClosed) f.close(); }
}, 90_000);
