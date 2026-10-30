import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { createHash } from 'node:crypto';
import type { CanonicalMatchState } from '../../src/core/model/CanonicalMatchState';
import { quantizeEventTick } from '../../src/core/sim/ExactEventTime';
import type { LiveIssuedPitchV1, LiveLineScoreV1, LiveTeamV1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { reducePlayableMatchV1 } from '../../src/integration/browser/PlayableMatchRulesV1';

export const hashLiveMatchRecordingValueV1 = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const savedValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const hashPattern = /^[a-f0-9]{64}$/;
export const INITIAL_LIVE_MATCH_RECORD_HASH_V1 = '0'.repeat(64);

export type CompactLiveMatchRecordV1 = {
  pitch: number; batterPlayerId: string; pitcherPlayerId: string; command: LiveIssuedPitchV1['command'];
  before: LiveIssuedPitchV1['beforeMatch']; after: LiveIssuedPitchV1['match'];
  play: Omit<LiveIssuedPitchV1['play'], 'field'> & {
    field: null | Omit<NonNullable<LiveIssuedPitchV1['play']['field']>, 'frames'> & { frameCount: number; frameHash: string };
  };
  events: readonly unknown[]; frameHash: string; previousHash: string; hash: string;
};
export type LiveMatchRecordingV1 = {
  authority: string;
  summary: { seed: number; pitches: number; final: CanonicalMatchState; line: readonly LiveLineScoreV1[]; classes: Record<string, number>; recordsHash: string };
  records: CompactLiveMatchRecordV1[];
};
export type LiveMatchRecordingBasisV1 = Readonly<{
  seed: number; initialMatch: CanonicalMatchState; regulationInnings: number;
  teams: readonly Pick<LiveTeamV1, 'battingOrder' | 'pitcherId'>[];
}>;

/** One projection for production and physical replay. The insertion order is
 * the original v1 saved format; normalization only removes non-JSON values.
 * A hash detects corruption, not Native ownership or an authentic execution. */
export function compactLiveIssuedPitchV1(record: LiveIssuedPitchV1, pitch: number, previousHash: string): CompactLiveMatchRecordV1 {
  ok(Number.isSafeInteger(pitch) && pitch > 0, 'invalid pitch ordinal');
  ok(hashPattern.test(previousHash), 'invalid preceding record hash');
  const field = record.play.field;
  const fieldSummary = field ? (({ frames, ...rest }) => ({ ...rest, frameCount: frames.length, frameHash: hashLiveMatchRecordingValueV1(frames) }))(field) : null;
  const item = { pitch, batterPlayerId: record.batterPlayerId, pitcherPlayerId: record.pitcherPlayerId, command: record.command,
    before: record.beforeMatch, after: record.match, play: { ...record.play, field: fieldSummary }, events: record.events,
    frameHash: hashLiveMatchRecordingValueV1(record.frames), previousHash };
  return savedValue({ ...item, hash: hashLiveMatchRecordingValueV1(item) });
}

export function assertLiveMatchReplayRecordV1(saved: CompactLiveMatchRecordV1, actual: CompactLiveMatchRecordV1): void {
  // This compares contact, its impulse successor, all field facts and diagnostics,
  // events, field frame count/hash, presentation frame hash and the full chain.
  deepStrictEqual(saved, actual, 'saved compact record differs from fresh physical execution');
}

/** Every saved record receives a rule/identity/completeness check. Physics is
 * deliberately a separate fresh execution, via assertLiveMatchReplayRecordV1. */
export function verifyLiveMatchRecordingV1(recording: LiveMatchRecordingV1, basis: LiveMatchRecordingBasisV1): void {
  strictEqual(recording.authority, 'LOCAL_BROWSER_CORE_HOST_V1');
  ok(Number.isSafeInteger(basis.seed) && Number.isSafeInteger(recording.summary.seed), 'invalid match seed');
  strictEqual(recording.summary.seed, basis.seed);
  ok(Number.isSafeInteger(basis.regulationInnings) && basis.regulationInnings > 0, 'invalid regulation innings');
  ok(basis.teams.length === 2 && basis.teams.every(t => t.battingOrder.length === 9 && new Set(t.battingOrder).size === 9), 'invalid recording roster');
  ok(Number.isSafeInteger(recording.summary.pitches) && recording.summary.pitches > 0, 'empty or invalid finished-game record');
  strictEqual(recording.records.length, recording.summary.pitches);
  let chain = INITIAL_LIVE_MATCH_RECORD_HASH_V1, expected = basis.initialMatch, finished = false, lastTick = -1;
  const battingIndices = [0, 0], classes: Record<string, number> = {};
  const line: { inning: number; away: number | null; home: number | null }[] = [{ inning: 1, away: 0, home: null }];
  for (const [index, record] of recording.records.entries()) {
    ok(!finished, 'record exists after game over');
    strictEqual(record.pitch, index + 1, 'missing, repeated or reordered pitch ordinal');
    const { hash, ...item } = record;
    ok(hashPattern.test(hash) && hashPattern.test(item.frameHash), 'invalid record or frame hash');
    strictEqual(item.previousHash, chain);
    strictEqual(hashLiveMatchRecordingValueV1(item), hash);
    deepStrictEqual(item.before, expected);
    const offense = expected.half === 'top' ? 0 : 1;
    strictEqual(item.batterPlayerId, basis.teams[offense].battingOrder[battingIndices[offense]], 'record batter differs from actual batting order');
    strictEqual(item.pitcherPlayerId, basis.teams[1 - offense].pitcherId, 'record pitcher differs from defensive roster');
    ok(item.command && ['balanced', 'contact', 'power', 'take', 'bunt'].includes(item.command.batting)
      && [0, 1].includes(item.command.managedTeam) && typeof item.command.pitchType === 'string' && typeof item.command.location === 'string', 'invalid pitch command');
    ok(item.play.rules.kind === 'applied', 'unfinished adjudication in finished-game recording');
    const endedAtTick = item.play.rules.endedAtTick;
    ok(Number.isSafeInteger(endedAtTick) && endedAtTick > lastTick, 'pitch adjudication clock did not advance');
    const field = item.play.field;
    if (field) {
      ok(item.play.contact && item.play.contactMoment && item.play.contactOrientation && item.play.outgoingBallMoment, 'field play missing actual contact basis');
      ok(field.end.complete && Number.isSafeInteger(field.frameCount) && field.frameCount > 0 && hashPattern.test(field.frameHash), 'unfinished physical field summary');
    } else {
      strictEqual(item.play.contact, null); strictEqual(item.play.contactMoment, null);
      strictEqual(item.play.contactOrientation, null); strictEqual(item.play.outgoingBallMoment, null);
      ok(['ball', 'called_strike', 'swinging_strike'].includes(item.play.call!), 'pitch has no secured count call');
    }
    const batting = item.command.managedTeam === offense ? item.command.batting : 'balanced';
    const event = field ? { kind: 'field_play' as const, facts: { ...field.ruleFacts, buntAttempt: batting === 'bunt' } }
      : { kind: 'pitch_call' as const, tick: endedAtTick, call: item.play.call! };
    const rules = reducePlayableMatchV1({ match: item.before, batterRunnerId: item.batterPlayerId, regulationInnings: basis.regulationInnings, event });
    deepStrictEqual(savedValue(rules), item.play.rules);
    ok(rules.kind === 'applied');
    strictEqual(item.play.classification, rules.classification);
    deepStrictEqual(item.after, rules.match);
    if (item.play.contact) {
      const impact = item.play.contact as { exitVelocity: unknown; exitSpin: unknown }, incoming = item.play.contactMoment!, outgoing = item.play.outgoingBallMoment!;
      strictEqual(incoming.ball.tick, quantizeEventTick(incoming.originTick, incoming.elapsedSeconds, 1e6));
      strictEqual(field!.ruleFacts.contactTick, incoming.ball.tick);
      deepStrictEqual(outgoing, { ...incoming, ball: { ...incoming.ball, velocity: impact.exitVelocity, spin: impact.exitSpin } });
    }
    classes[rules.classification] = (classes[rules.classification] ?? 0) + 1;
    const row = line.find(r => r.inning === item.before.inning)!;
    row[item.before.half === 'top' ? 'away' : 'home'] = (row[item.before.half === 'top' ? 'away' : 'home'] ?? 0) + rules.scoredRunnerIds.length;
    if (rules.batterAdvanced) battingIndices[offense] = (battingIndices[offense] + 1) % 9;
    if (rules.halfChanged) {
      let next = line.find(r => r.inning === rules.match.inning);
      if (!next) { next = { inning: rules.match.inning, away: null, home: null }; line.push(next); }
      next[rules.match.half === 'top' ? 'away' : 'home'] = 0;
    }
    finished = rules.gameOver;
    if (finished) ok(rules.winner !== null && rules.match.inning >= basis.regulationInnings, 'finished before regulation');
    chain = hash; expected = item.after; lastTick = endedAtTick;
  }
  ok(finished, 'recording ends before Core game over');
  strictEqual(chain, recording.summary.recordsHash);
  deepStrictEqual(expected, recording.summary.final);
  deepStrictEqual(classes, recording.summary.classes);
  deepStrictEqual(line, recording.summary.line);
  strictEqual(line.reduce((sum, r) => sum + (r.away ?? 0), 0), expected.score.away);
  strictEqual(line.reduce((sum, r) => sum + (r.home ?? 0), 0), expected.score.home);
}
