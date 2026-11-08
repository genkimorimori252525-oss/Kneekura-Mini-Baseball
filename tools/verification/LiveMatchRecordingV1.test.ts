import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../../src/core/model/RuleProfileRef';
import type { LiveIssuedPitchV1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { reducePlayableMatchV1 } from '../../src/integration/browser/PlayableMatchRulesV1';
import { assertLiveMatchReplayRecordV1, compactLiveIssuedPitchV1, hashLiveMatchRecordingValueV1 as sha,
  INITIAL_LIVE_MATCH_RECORD_HASH_V1, verifyLiveMatchRecordingV1,
  type CompactLiveMatchRecordV1, type LiveMatchRecordingBasisV1, type LiveMatchRecordingV1 } from './LiveMatchRecordingV1';

function rehash(recording: LiveMatchRecordingV1): void {
  let chain = INITIAL_LIVE_MATCH_RECORD_HASH_V1;
  for (const r of recording.records) { r.previousHash = chain; const { hash: ignored, ...item } = r; void ignored; r.hash = sha(item); chain = r.hash; }
  recording.summary.recordsHash = chain;
}
/** A rule-only synthetic fixture, not an assertion of physical execution. Four
 * away walks and six strikeouts finish one regulation inning at 1-0. */
function finishedFixture() {
  const basis: LiveMatchRecordingBasisV1 = { seed: 17, regulationInnings: 1,
    teams: [0, 1].map(t => ({ battingOrder: Array.from({ length: 9 }, (_, i) => `${t}-b${i}`), pitcherId: `${t}-p` })),
    initialMatch: { ruleProfileId: asRuleProfileId('npb-2026'), inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 0 } };
  const records: CompactLiveMatchRecordV1[] = [], issued: LiveIssuedPitchV1[] = [], order = [0, 0], classes: Record<string, number> = {};
  let match = basis.initialMatch, chain = INITIAL_LIVE_MATCH_RECORD_HASH_V1;
  for (const call of [...Array<string>(16).fill('ball'), ...Array<string>(18).fill('called_strike')]) {
    const offense = match.half === 'top' ? 0 : 1, batterPlayerId = basis.teams[offense].battingOrder[order[offense]],
      pitcherPlayerId = basis.teams[1 - offense].pitcherId, tick = (records.length + 1) * 1_000_000;
    const rules = reducePlayableMatchV1({ match, batterRunnerId: batterPlayerId, regulationInnings: 1,
      event: { kind: 'pitch_call', tick, call: call as 'ball' | 'called_strike' } });
    if (rules.kind !== 'applied') throw new Error('invalid test fixture');
    const one: LiveIssuedPitchV1 = { beforeMatch: match, match: rules.match, frames: [], events: [{ kind: 'pitch_adjudicated', tick }],
      command: { batting: 'take', pitchType: 'auto', location: 'auto', managedTeam: 0 },
      play: { classification: rules.classification, call: call as 'ball' | 'called_strike', contact: null, contactMoment: null,
        contactOrientation: null, outgoingBallMoment: null, field: null, rules, diagnostics: { basis: 'SYNTHETIC_RULE_ONLY_TEST' } },
      requiresNextPitch: !rules.gameOver, finished: rules.gameOver, batterPlayerId, pitcherPlayerId,
      pitchType: 'synthetic', speedKmh: 0, line: [], hits: null, errors: null };
    const record = compactLiveIssuedPitchV1(one, records.length + 1, chain);
    records.push(record); issued.push(one); chain = record.hash; match = rules.match;
    classes[rules.classification] = (classes[rules.classification] ?? 0) + 1;
    if (rules.batterAdvanced) order[offense] = (order[offense] + 1) % 9;
  }
  const recording: LiveMatchRecordingV1 = { authority: 'LOCAL_BROWSER_CORE_HOST_V1',
    summary: { seed: basis.seed, pitches: records.length, final: match, line: [{ inning: 1, away: 1, home: 0 }], classes, recordsHash: chain }, records };
  return { basis, recording, issued };
}

describe('complete saved-game rules and identities', () => {
  it('accepts a complete synthetic rules fixture and preserves the existing compact format', () => {
    const { basis, recording, issued } = finishedFixture();
    expect(() => verifyLiveMatchRecordingV1(recording, basis)).not.toThrow();
    const r = issued[0], item = { pitch: 1, batterPlayerId: r.batterPlayerId, pitcherPlayerId: r.pitcherPlayerId, command: r.command,
      before: r.beforeMatch, after: r.match, play: { ...r.play, field: null }, events: r.events, frameHash: sha(r.frames), previousHash: INITIAL_LIVE_MATCH_RECORD_HASH_V1 };
    expect(recording.records[0]).toEqual({ ...item, hash: sha(item) });
  });
  it('rejects an empty or truncated recording even after all chain hashes are recomputed', () => {
    const { basis, recording } = finishedFixture(), empty = structuredClone(recording), short = structuredClone(recording);
    empty.records = []; empty.summary.pitches = 0; empty.summary.final = basis.initialMatch; rehash(empty);
    expect(() => verifyLiveMatchRecordingV1(empty, basis)).toThrow('empty');
    short.records.pop(); short.summary.pitches--; short.summary.final = short.records.at(-1)!.after; rehash(short);
    expect(() => verifyLiveMatchRecordingV1(short, basis)).toThrow('before Core game over');
  });
  it.each(['ordinal', 'batter', 'pitcher', 'clock', 'after_game'] as const)('rejects rehashed %s mutation', kind => {
    const { basis, recording } = finishedFixture();
    if (kind === 'ordinal') recording.records[1].pitch = 1;
    if (kind === 'batter') recording.records[0].batterPlayerId = '0-b7';
    if (kind === 'pitcher') recording.records[0].pitcherPlayerId = '0-p';
    if (kind === 'clock') (recording.records[1].play.rules as { endedAtTick: number }).endedAtTick = 1_000_000;
    if (kind === 'after_game') { const extra = structuredClone(recording.records.at(-1)!); extra.pitch++; recording.records.push(extra); recording.summary.pitches++; }
    rehash(recording); expect(() => verifyLiveMatchRecordingV1(recording, basis)).toThrow();
  });
  it.each(['classes', 'line', 'final', 'regulation'] as const)('rejects false %s summary', kind => {
    const { basis, recording } = finishedFixture();
    if (kind === 'classes') recording.summary.classes.strikeout++;
    if (kind === 'line') recording.summary.line = [{ inning: 1, away: 9, home: 0 }];
    if (kind === 'final') recording.summary.final = { ...recording.summary.final, score: { away: 2, home: 0 } };
    expect(() => verifyLiveMatchRecordingV1(recording, kind === 'regulation' ? { ...basis, regulationInnings: 9 } : basis)).toThrow();
  });
});

describe('fresh full compact physical comparison', () => {
  it('rejects coordinated contact/outgoing tampering even with unchanged frames and a recomputed chain', () => {
    const { recording } = finishedFixture(), fresh = structuredClone(recording.records[0]);
    // Only this comparator fixture is synthetic: a self-consistent pair of
    // recorded impulse values must still match the independent fresh result.
    fresh.play = { ...fresh.play, contact: { exitVelocity: { x: 12, y: 3, z: 7 }, exitSpin: { x: 1, y: 2, z: 3 } },
      outgoingBallMoment: { ball: { velocity: { x: 12, y: 3, z: 7 } } } as NonNullable<typeof fresh.play.outgoingBallMoment> };
    const mutated = structuredClone(fresh);
    (mutated.play.contact as { exitVelocity: { x: number } }).exitVelocity.x += .125;
    mutated.play = { ...mutated.play, outgoingBallMoment: { ...mutated.play.outgoingBallMoment!, ball: { ...mutated.play.outgoingBallMoment!.ball,
      velocity: { ...mutated.play.outgoingBallMoment!.ball.velocity, x: 12.125 } } } };
    const { hash: ignored, ...item } = mutated; void ignored; mutated.hash = sha(item);
    expect(mutated.frameHash).toBe(fresh.frameHash);
    expect(() => assertLiveMatchReplayRecordV1(mutated, fresh)).toThrow('fresh physical execution');
  });
  it.each(['events', 'diagnostics', 'field', 'frameHash', 'previousHash'] as const)('does not omit %s from physical comparison', kind => {
    const fresh = finishedFixture().recording.records[0], mutated = structuredClone(fresh);
    if (kind === 'events') mutated.events = [...mutated.events, { kind: 'invented' }];
    if (kind === 'diagnostics') mutated.play = { ...mutated.play, diagnostics: { invented: true } };
    if (kind === 'field') mutated.play = { ...mutated.play, field: { frameCount: 99, frameHash: sha([]), facts: [] } as unknown as NonNullable<typeof mutated.play.field> };
    if (kind === 'frameHash') mutated.frameHash = sha('other frames');
    if (kind === 'previousHash') mutated.previousHash = sha('invented predecessor');
    expect(() => assertLiveMatchReplayRecordV1(mutated, fresh)).toThrow();
  });
});
