import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { originalFoulRuleFixture, advanceOriginalFoulFieldExecution } from './ActualFoulRuleFixtures.test-support';

it.each(['ordinary_0', 'ordinary_2', 'bunt_2', 'legacy_2'] as const)('proves the genuine registered original stop and count prerequisites for %s', scenario => {
  const directory = mkdtempSync(join(tmpdir(), 'foul-rule-physical-'));
  let x: ReturnType<typeof originalFoulRuleFixture> | undefined;
  try {
    x = originalFoulRuleFixture(join(directory, 'physical.sqlite'), scenario);
    const expectedStrikes = scenario === 'ordinary_0' ? 0 : 2, count = x.countEvidence;
    expect(x.runtime.source.capability).toBe('causal_original_settled_foul_count_runtime_v1');
    expect(x.runtime.membership.producers).toHaveLength(71);
    expect(count.basis).toEqual(x.production.basis);
    expect(count.basis.originalCount.count.strikes).toBe(expectedStrikes);
    expect(count.basis.evidence.interpretation).toMatchObject({ kind: 'dead_ball', reason: 'untouched_settled_foul' });
    expect(count.basis.contactOrigins!.firstGround.length).toBeGreaterThan(0);
    expect(count.basis.contactOrigins!.decisiveStop).toHaveLength(1);
    expect(x.production.event.occurredAt).toEqual(x.production.event.availableAt);
    expect(x.production.successor.status).toBe('pending');
    expect(x.physical.result.pitch.resolution.timeline.status).toMatchObject({ kind: 'batted_ball_pending', count: { strikes: expectedStrikes } });
    expect(x.prefix).toHaveLength(scenario === 'ordinary_0' ? 1 : 3);
    expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
    expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
    if (scenario === 'legacy_2') expect(count.countConsequence).toEqual({ kind: 'unresolved', reason: 'original_batting_intent_missing' });
    else expect(count.countConsequence).toMatchObject({ kind: 'derived', rule: { kind: 'uncaught_foul', ballDead: true,
      countResult: { kind: scenario === 'bunt_2' ? 'strikeout' : 'continue' } } });
  } finally { x?.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 120_000);

it('proves a genuine later admitted execution while preserving the original stop receipt', () => {
  const directory = mkdtempSync(join(tmpdir(), 'foul-rule-later-physical-'));
  let x: ReturnType<typeof originalFoulRuleFixture> | undefined;
  try {
    x = originalFoulRuleFixture(join(directory, 'physical.sqlite'), 'ordinary_0');
    const before = x.f.db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
    const later = advanceOriginalFoulFieldExecution(x);
    expect(later.executions.read(later.source.sourceId)).toEqual(later.value);
    expect(later.value.execution.kind).toBe('motion');
    const after = x.f.db.prepare('SELECT * FROM actual_live_play_admissions ORDER BY sequence').all();
    expect(after.slice(0, -1)).toEqual(before);
    expect(after.at(-1)).toMatchObject({ runtime_source_id: x.runtime.source.sourceId,
      owner: 'batted_world_field_executions', source_id: later.source.sourceId });
    expect(x.producer.read(x.production.source.sourceId)).toEqual(x.production);
    expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
    expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
  } finally { x?.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 120_000);
