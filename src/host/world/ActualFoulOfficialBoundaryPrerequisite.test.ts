import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes,
  type OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';
import { openSqliteActualFoulPlayEndStore, actualFoulClosedEvidenceFromSqlite } from './SqliteActualFoulPlayEndStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import { derivePhysicalNonLiveClosure } from '../../core/adjudication/PhysicalNonLiveClosure';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

let directory: string;
const fixtures: { x: OriginalFoulEndFixture; end: FoulEndedEvidence }[] = [];
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-official-prerequisites-'));
  for (const attempt of ['ordinary_swing', 'bunt'] as const) {
    const x = originalFoulEndFixture(join(directory, attempt + '.sqlite'), attempt);
    try {
      // Genuine end-policy enrollment, original count intent, all50 role pairs,
      // forty base histories, exact quantizer endpoint and historical S/C replay.
      assertOriginalFoulEndPrerequisites(x);
      const source = { sourceId: attempt + '-official-boundary-end', sourceVersion: 'contract-v1',
        capability: 'actual_original_settled_foul_play_end_v1' as const, ruleConsumptionSourceId: x.count.source.sourceId,
        baseFieldSourceId: x.foul.last.source.sourceId, executionSourceId: x.endpoint.source.sourceId };
      const ends = x.f.track(openSqliteActualFoulPlayEndStore(x.f.path, { readAcceptedEnd: id => id === source.sourceId ? source : null }));
      const end = ends.accept(source.sourceId);
      expect(actualFoulClosedEvidenceFromSqlite(x.f.db).read(end.source.sourceId)).toEqual(end);
      fixtures.push({ x, end });
    } catch (error) { x.f.close(); throw error; }
  }
}, 720_000);
afterAll(() => { for (const { x } of fixtures.reverse()) x.f.close();
  if (directory) rmSync(directory, { recursive: true, force: true }); });

const input = (x: OriginalFoulEndFixture, end: FoulEndedEvidence) => {
  if (!x.count.disposition.timeline) throw new Error('owned original foul timeline is missing');
  const policy = x.physical.frame.effortPolicy;
  return { match: x.physical.frame.match, timeline: x.count.disposition.timeline, batterRunnerId: null,
    gameDay: x.physical.frame.bindings[0].gameDay,
    effortPolicy: { policyId: policy.policyId, version: policy.version, availableAtDay: policy.availableAtDay,
      effortUnitsPerPhysicalPitch: policy.effortUnitsPerPhysicalPitch },
    snapshotId: x.originalAttempt + '-rule-proposal', ruleTick: end.exactEnd.tick,
    closureId: x.originalAttempt + '-closure-proposal', closureTick: end.exactEnd.tick };
};
const assertPendingNativeAuthority = (x: OriginalFoulEndFixture, end: FoulEndedEvidence) => {
  const profile = actualLiveAdjudicationProfile(x.physical.frame.match.ruleProfileId, null);
  expect(profile.id).toBe('npb-2026'); expect(profile.officialWindows).toEqual({ appeal: { available: true } });
  expect(profile.officialWindows?.review).toBeUndefined(); expect(profile.officialWindows?.challenge).toBeUndefined();
  // The existing accepted policy supplements unspecified capabilities; no such
  // Source or foul-specific applicability/call owner is supplied by this fixture.
  expect(() => actualLiveAdjudicationEvidenceFromSqlite(x.f.db).derive({ sourceId: 'foul-not-first-base', sourceVersion: 'contract-v1',
    physicalEndSourceId: end.source.sourceId, policy: null })).toThrow('accepted actual physical end is missing');
  expect(end.dispositionObligations.official).toMatchObject({ status: 'pending', consumer: null });
  expect(end.pending).toMatchObject({ controllerRetirement: 'unowned', workloadSettlement: 'unowned', reset: 'unowned', samePaResume: 'unowned' });
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).read(x.count.source.sourceId)).toEqual(x.count);
  expect(x.physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
  expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(x.originalMatchBytes);
};

it('preserves a genuine ordinary two-strike foul as the same active PA while terminal official application and Native handoff remain unavailable', () => {
  const { x, end } = fixtures[0], before = foulEndLogicalBytes(x.f.db), request = input(x, end);
  expect(x.originalAttempt).toBe('ordinary_swing'); expect(x.count.disposition.kind).toBe('continue_same_pa');
  expect(request.timeline.playId).toBe(x.physical.frame.match.playId);
  expect(request.timeline.status).toEqual({ kind: 'active', count: { balls: 0, strikes: 2 } });
  expect(request.timeline.events.slice(0, -1)).toEqual(x.physical.result.pitch.resolution.timeline.events);
  expect(request.timeline.events.at(-1)).toMatchObject({ kind: 'FoulBattedBallResolved',
    payload: { resolution: { kind: 'uncaught_foul', countResult: { kind: 'continue', cause: 'foul' } } } });
  expect(() => derivePhysicalNonLiveClosure(request)).toThrow('physical pitch workload requires a completed canonical play');
  expect(end.dispositionObligations.official.pendingReason).toBe('official_continuation_unowned');
  assertPendingNativeAuthority(x, end); expect(foulEndLogicalBytes(x.f.db)).toBe(before);
}, 180_000);

it('derives the existing Core terminal-count strikeout proposal from a genuine two-strike bunt foul without rewriting its raw pitch or applying Native closure', () => {
  const { x, end } = fixtures[1], before = foulEndLogicalBytes(x.f.db), request = input(x, end);
  expect(x.originalAttempt).toBe('bunt'); expect(x.count.disposition.kind).toBe('terminal_strikeout');
  expect(request.timeline.status.kind).toBe('strikeout'); expect(request.timeline.playId).toBe(request.match.playId);
  expect(request.timeline.events.slice(0, -1)).toEqual(x.physical.result.pitch.resolution.timeline.events);
  expect(request.timeline.events.at(-1)).toMatchObject({ kind: 'FoulBattedBallResolved',
    payload: { resolution: { kind: 'uncaught_foul', countResult: { kind: 'strikeout', cause: 'foul_bunt' } } } });
  const derived = derivePhysicalNonLiveClosure(request), closure = getOfficialPlayClosure(derived.adjudication);
  expect(derived.context).toEqual({ kind: 'strikeout' }); expect(derived.scoring).toMatchObject({ classification: 'strikeout' });
  expect(derived.nextMatch).toEqual({ ...request.match, playId: request.match.playId + 1, outs: request.match.outs + 1, balls: 0, strikes: 0 });
  expect(closure).toMatchObject({ closureId: request.closureId, closedAtTick: end.exactEnd.tick, playEnd: null });
  expect(end.playEnd).toMatchObject({ kind: 'play_end', reason: 'dead_ball', tick: end.exactEnd.tick });
  expect(request.timeline.events.some(e => e.kind === 'LiveBallPlayEnded')).toBe(false);
  expect(end.dispositionObligations.official.pendingReason).toBe('terminal_official_closure_unowned');
  assertPendingNativeAuthority(x, end);
  expect(json(x.count.successor)).toBe(json(end.dispositionObligations.original));
  expect(foulEndLogicalBytes(x.f.db)).toBe(before);
}, 180_000);
