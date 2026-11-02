import { expect, it } from 'vitest';
import { createLiveEmotionTrackerV1, liveLeverageV1, type LiveEmotionEventV1 } from './LiveEmotionV1';

const policy = { version:'live_emotion_policy_v1', sourceId:'test' } as const;
const players = [{ playerId:'b', clubId:'A' }, { playerId:'p', clubId:'B' }];
const pa = (tick:number, outcome:LiveEmotionEventV1['outcome'], over:Partial<LiveEmotionEventV1> = {}):LiveEmotionEventV1 => ({
  tick, batterId:'b', pitcherId:'p', outcome, inning:1, regulationInnings:9, outs:0, runnersOn:0, scoringPosition:false, runDifference:0, ...over });

it('stays silent in ordinary plate appearances', () => {
  const t = createLiveEmotionTrackerV1({ matchId:'m', policy, players });
  for (let i = 1; i <= 8; i++) t.observe(pa(i, i % 3 ? 'out' : 'hit', { inning:1 + (i >> 1) }));
  expect(t.marks()).toEqual([]);
  expect(t.influence('b')).toBeNull();
});

it('a fragile batter marks in a late failure streak, a calm one in the same spot does not', () => {
  const late = { inning:9, runnersOn:2, scoringPosition:true, outs:2, runDifference:-1 };
  const run = (response:Record<string,number>) => {
    const t = createLiveEmotionTrackerV1({ matchId:'m', policy, players:[{ playerId:'b', clubId:'A', response }, players[1]] });
    for (let i = 1; i <= 4; i++) t.observe(pa(i, 'strikeout', late));
    return t;
  };
  const fragile = run({ stability:.05, experience:.05, confidence:.1 }), calm = run({ stability:1, experience:1, confidence:.9 });
  expect(fragile.marks().map(m => m.playerId)).toContain('b');
  expect(fragile.influence('b')?.effects).toBeTruthy();
  expect(calm.marks().map(m => m.playerId)).not.toContain('b');
});

it('clears and leaves no effect behind', () => {
  const t = createLiveEmotionTrackerV1({ matchId:'m', policy, players:[{ playerId:'b', clubId:'A', response:{ stability:.05, experience:.05, confidence:.1 } }, players[1]] });
  for (let i = 1; i <= 4; i++) t.observe(pa(i, 'strikeout', { inning:9, runnersOn:2, scoringPosition:true, runDifference:-1 }));
  expect(t.influence('b')).not.toBeNull();
  for (let i = 5; i <= 16; i++) t.observe(pa(i, 'walk', { inning:1, runDifference:6 }));
  expect(t.influence('b')).toBeNull();
});

it('replays exactly from a capture', () => {
  const events = [pa(1, 'strikeout', { inning:9, runnersOn:2, scoringPosition:true }), pa(2, 'strikeout', { inning:9 }), pa(3, 'homer', { inning:9 })];
  const a = createLiveEmotionTrackerV1({ matchId:'m', policy, players });
  a.observe(events[0]);
  const b = createLiveEmotionTrackerV1({ matchId:'m', policy, players, saved:a.capture() });
  for (const e of events.slice(1)) { a.observe(e); b.observe(e); }
  expect(JSON.stringify(b.capture())).toBe(JSON.stringify(a.capture()));
});

it('leverage rises late and close', () => {
  const base = { regulationInnings:9, outs:0, runnersOn:0, scoringPosition:false };
  expect(liveLeverageV1({ ...base, inning:9, runDifference:0 })).toBeGreaterThan(liveLeverageV1({ ...base, inning:1, runDifference:0 }));
  expect(liveLeverageV1({ ...base, inning:9, runDifference:6 })).toBe(0);
});
