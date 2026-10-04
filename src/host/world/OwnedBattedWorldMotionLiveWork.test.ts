import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
it('exposes accepted coverage and actual execution as partial source-local unfinished work', () => {
  const x = fixture();
  try {
    const source = x.retain(x.first.source.sourceId, x.at + 200); x.sources.set(source.sourceId, source);
    const value = x.executions.accept(source.sourceId);
    if (value.execution.kind !== 'owned_motion_v1') throw new Error('owned motion missing');
    expect(value.execution).toHaveProperty('liveWork');
    const work = value.execution.liveWork;
    expect(work.sourceCoverage).toBe('explicit_known_sources_only');
    expect(work.queue).toBeNull(); expect(work).not.toHaveProperty('settledThroughTick'); expect(work).not.toHaveProperty('playEnd');
    expect(work.contributors).toHaveLength(10);
    expect(work.contributors.every(c => c.status === 'admitted_physical_coverage' && c.actualExecutedThrough.tick === x.at + 200
      && c.acceptedThroughTick === x.at + 2000 && c.motorAdoption === null)).toBe(true);
    expect(new Set(work.contributors.map(c => c.workId)).size).toBe(10);
    const later = x.retain(source.sourceId, x.at + 300, 'owned-work-later'); x.sources.set(later.sourceId, later); x.executions.accept(later.sourceId);
    expect(x.executions.read(source.sourceId)).toEqual(value);
  } finally { x.f.close(); }
});
