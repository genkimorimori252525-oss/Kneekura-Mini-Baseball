import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getHeapStatistics } from 'node:v8';
import { afterEach, expect, it } from 'vitest';
import { nativeSpinNeutralFixtureV193 } from './NativeSpinNeutralV193.test-support';

// The 180s Native193-01 timeout remains a failed normal observation. A longer
// explicit functional run changes neither Source nor simulation time/physics.
const functionalBudgetMs = process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS === undefined ? 180_000
  : Number(process.env.BASEBALL_NATIVE_FUNCTIONAL_BUDGET_MS);
if (!Number.isSafeInteger(functionalBudgetMs) || functionalBudgetMs < 180_000 || functionalBudgetMs > 1_200_000) throw Error('invalid Native V193 functional budget');
const reportCleanup: (() => void)[] = [];
afterEach(() => { while (reportCleanup.length) reportCleanup.pop()!(); });

it('NSN193-N01 keeps two genuine independent Native techniques in the consumer while NO_SPIN_TARGET preserves ordinary execution', async () => {
  const output = process.env.BASEBALL_NATIVE_SPIN_NEUTRAL_V193_OUTPUT;
  if (output) mkdirSync(resolve(output), { recursive: false });
  if (output && process.report) {
    const prior = { directory: process.report.directory, reportOnFatalError: process.report.reportOnFatalError, excludeEnv: process.report.excludeEnv };
    process.report.directory = resolve(output); process.report.reportOnFatalError = true; process.report.excludeEnv = true;
    reportCleanup.push(() => { Object.assign(process.report!, prior); });
  }
  const stage = (name: string) => {
    if (output) appendFileSync(resolve(output, 'stages.jsonl'), JSON.stringify({ name, at: new Date().toISOString(),
      memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit }) + '\n');
  };
  const stringify = output ? (createRequire(import.meta.url)('../../../tools/verification/live-debug-record.mjs') as { stringifyDebugRecord(value: unknown): string }).stringifyDebugRecord : undefined;
  const result = await nativeSpinNeutralFixtureV193(stage, value => {
    const gold = (value as { stage: string }).stage === 'NATIVE_GOLD_READ';
    if (output) writeFileSync(resolve(output, gold ? 'gold-native-locators.lossless.json' : 'before-consumer-locators.lossless.json'), stringify!(value) + '\n', { flag: 'wx' });
  });
  try {
    expect(result.h.f.actor.binding.gameDay).toBe(40);
    expect(result.inventory).toMatchObject({ effectiveStateId: 'GOLD', masteredTechniqueSet: ['BACKSPIN', 'TOPSPIN'], rejected: [] });
    expect(result.inventory.motorQualifications).toHaveLength(2);
    const qualifications = result.practices.map(practice => practice.qualification);
    expect(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size).toBe(2);
    expect(new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size).toBe(2);
    expect(new Set(qualifications.flatMap(q => q.contacts.map(contact => contact.eventId))).size).toBe(6);
    expect(qualifications.map(q => q.successfulContacts)).toEqual([3, 3]);
    for (const q of qualifications) {
      expect(q.person.personId).toBe(result.h.f.actor.binding.personId);
      expect(q.source.personLinkSourceId).toBe(result.h.f.actor.person.sourceId);
      expect(q.source.repertoireRef).toEqual(result.h.f.source.repertoireRef);
    }
    const actual = result.swing.commitment.calculation;
    if (actual.algorithm !== 'batting-spin-execution-calculation-v123') throw new Error('Native spin calculation missing');
    expect(actual.spinContext.techniques.map(t => t.technique)).toEqual(['BACKSPIN', 'TOPSPIN']);
    expect(actual.spinContext.techniques.every(t => t.motorProfileRefs.length > 0)).toBe(true);
    expect(actual.spinMotorPlanV123).toMatchObject({ declaredIntent: 'NO_SPIN_TARGET', selectedIntent: 'NO_SPIN_TARGET', selectedQualificationRef: null, fallbackReason: null });
    expect(actual.nominalRequest).toStrictEqual(result.ordinary.nominalRequest);
    expect(actual.effectiveValues).toStrictEqual(result.ordinary.effectiveValues);
    expect(actual.commitment).toStrictEqual(result.ordinary.commitment);
    expect(actual.status).toBe(result.ordinary.status); expect(actual.scheduledTick).toBe(result.ordinary.scheduledTick);
    expect(result.swing.resolution.contact).not.toBeNull();
    expect(result.swing.resolution.timeline.events.filter(event => event.kind === 'BatBallContact')).toHaveLength(1);
    if (output) {
      const records = { fixtureAuthority: result.fixtureAuthority, inventory: result.inventory, qualifications,
        input: result.swing.input, launch: result.swing.launch, commitment: result.swing.commitment, resolution: result.swing.resolution, ordinary: result.ordinary };
      writeFileSync(resolve(output, 'actual-native-records.lossless.json'), stringify!(records) + '\n', { flag: 'wx' });
      writeFileSync(resolve(output, 'report.json'), JSON.stringify({ pass: true, databasePath: result.h.f.path,
        qualificationCount: qualifications.length, consumerTechniqueCount: actual.spinContext.techniques.length,
        selectedIntent: actual.spinMotorPlanV123?.selectedIntent, actualContact: result.swing.resolution.contact !== null,
        ordinaryExecutionEqual: true, flightExercised: false, officialTerminalProven: false, wholeRngConsumptionProven: false,
        productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, testBudgetMilliseconds: functionalBudgetMs,
        functionalCompletionOnly: functionalBudgetMs > 180_000, performancePass: false }) + '\n', { flag: 'wx' });
    }
  } finally { result.h.close(); }
}, functionalBudgetMs);
