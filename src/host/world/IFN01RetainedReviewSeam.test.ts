import { expect, it, vi } from 'vitest';
import * as terminal from './SamePlateAppearanceFairCatchTerminalNative.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

const stops = vi.hoisted(() => ({ review: vi.fn(() => { throw new Error('first unperformed CatchReview'); }),
  prefix: vi.fn(() => { throw new Error('completed prefix replayed'); }) }));
vi.mock('./SamePlateAppearanceCatchReviewNative.test-support', () => ({ appendNativeReservedCatchReview: stops.review }));
vi.mock('./SamePlateAppearanceCatchWorkFromSqlite', () => ({ openSqliteSamePlateAppearanceCatchWorkStore: stops.prefix }));
vi.mock('./SamePlateAppearanceFieldRuleEvidenceFromSqlite', () => ({ readSamePaFieldRuleEvidenceFromSqlite: stops.prefix }));
vi.mock('./SamePlateAppearanceAdmittedLiveWorkFromSqlite', () => ({ readSamePaAdmittedLiveWorkFromSqlite: stops.prefix }));

it('starts the retained original tail at CatchReview without replaying seal, catch-work, or earlier assertions', () => {
  const resume = terminal.completeNativeFairCatchTerminalReview;
  expect(resume).toBeTypeOf('function');
  type Args = Parameters<typeof resume>;
  const current = { viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'physical-fixture:cut39:view',
    sourceHash: 'view-source', snapshotHash: 'view-snapshot' } };
  const h = { f: { actor: { match: { ruleProfileId: 'npb-2026' } }, x: { f: { track: stops.prefix } } },
    current: () => current, save: stops.prefix, advance: stops.prefix, physical: { acceptOperation: stops.prefix } } as unknown as Args[0];
  const work = { source: { sourceId: 'in-flight-fixture:fair-terminal:catch-work', sourceVersion: 'fixture-only-v1' } } as Args[2];
  const label = 'in-flight-fixture:fair-terminal';
  expect(() => resume(h, {} as Args[1], work, {} as Args[3], { close: stops.prefix }, label))
    .toThrow('first unperformed CatchReview');
  expect(stops.prefix).not.toHaveBeenCalled();
  expect(stops.review).toHaveBeenCalledTimes(1);
  expect(stops.review).toHaveBeenCalledWith(h, reference('pa_catch_v1_work', work),
    { sourceId: label + ':window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: 'npb-2026',
      officialWindows: { appeal: { available: true }, review: { available: true }, challenge: { available: false } } },
    label + ':review', 'explicit-fixture-scheduler');
});
