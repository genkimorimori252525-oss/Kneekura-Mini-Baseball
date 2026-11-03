import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { createLiveBattingPracticeV150 } from './LiveBattingPracticeV150';
import { createLiveBaseballMatchWorkerV116, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1, type LiveMatchInputV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
import type { LiveMatchWorkloadConfigV122 } from './LiveMatchWorkloadOwnerV122';

const take = { batting:'take' as const };
const normalTake = { ...take, pitchType:'auto', location:'auto', managedTeam:0 as const };
const jsonCopy = <T>(value:T):T => JSON.parse(JSON.stringify(value));

it('matches both full normal Host TAKE records and every accepted continuation clock/count/seed', () => {
  const input = liveMatchFixture(2468), normal = createLiveBaseballMatchWorkerV116(input), practice = createLiveBattingPracticeV150(input);
  for (let index = 0; index < 2; index++) {
    const candidate = practice.preview(take);
    expect(candidate.acceptedPitchCount).toBe(index);
    expect(practice.inspect().pitchCount).toBe(index);
    expect(practice.accept(candidate)).toEqual(normal.issuePitch(normalTake));
    expect(practice.capture().continuation).toEqual(normal.captureContinuationV116());
    expect(practice.inspect()).toMatchObject(normal.inspect());
  }
  expect(practice.inspect().acceptedRecords).toHaveLength(2);
});

it('does not advance unused previews and rejects foreign, copied, stale and twice accepted candidates', () => {
  const input = liveMatchFixture(2468), practice = createLiveBattingPracticeV150(input), other = createLiveBattingPracticeV150(input),
    before = practice.capture(), first = practice.preview(take), second = practice.preview(take), foreign = other.preview(take);
  expect(first.record).toEqual(second.record);
  expect(practice.capture()).toEqual(before);
  expect(practice.inspect().acceptedRecords).toHaveLength(0);
  expect(Object.isFrozen(first.record.frames)).toBe(true);
  expect(() => practice.accept(foreign)).toThrow(/candidate/);
  expect(() => practice.accept({ ...second })).toThrow(/candidate/);
  expect(practice.capture()).toEqual(before);
  practice.accept(second);
  const accepted = practice.capture();
  expect(() => practice.accept(first)).toThrow(/candidate/);
  expect(() => practice.accept(second)).toThrow(/candidate/);
  expect(practice.capture()).toEqual(accepted);
});

it('owns the complete measured catalog and configuration without freezing or following caller mutations', () => {
  const input = liveMatchFixture(2468), expected = createLiveBaseballMatchWorkerV116(input), practice = createLiveBattingPracticeV150(input),
    before = practice.capture();
  expect(Object.isFrozen(input.players[0])).toBe(false);
  (input.players[0] as { heightMeters:number }).heightMeters = .8;
  (input.teams[0].battingOrder as string[]).reverse();
  (input.measuredClips[0].frames[0].grip as { x:number }).x += 1;
  expect(practice.capture()).toEqual(before);
  expect(practice.issuePitch(take)).toEqual(expected.issuePitch(normalTake));
  expect(Object.isFrozen(practice.inspect().configuration.measuredClips[0].frames[0].grip)).toBe(true);
});

it('owns all 673 actual measured clips through the catalog boundary without widening ordinary inert limits', () => {
  runInThisContext(readFileSync('tools/browser-bridge/measured-bat-library-v1.js', 'utf8'));
  const decoder = (globalThis as unknown as { KneekuraMeasuredBatLibrary:{ decode(text:string):{ clips:LiveMatchInputV1['measuredClips'] } } }).KneekuraMeasuredBatLibrary,
    library = decoder.decode(readFileSync('docs/demos/measured-bat-library-v1.json', 'utf8')),
    practice = createLiveBattingPracticeV150({ ...liveMatchFixture(), measuredClips:library.clips });
  expect(practice.inspect().configuration.measuredClips).toHaveLength(673);
  expect(practice.inspect().configuration.measuredClips.reduce((count, clip) => count + clip.frames.length, 0)).toBe(92201);
  expect(practice.inspect().configuration.measuredClips.map(clip => clip.id)).toEqual(library.clips.map(clip => clip.id));
  expect(Object.isFrozen(practice.capture().configuration.measuredClips)).toBe(true);
}, 60000);

it('restores JSON captures with the full configuration binding and preserves the next full record', () => {
  const input = liveMatchFixture(2468), practice = createLiveBattingPracticeV150(input);
  practice.issuePitch(take);
  const capture = jsonCopy(practice.capture()), resumed = createLiveBattingPracticeV150(input, capture);
  expect(resumed.capture()).toEqual(practice.capture());
  expect(resumed.inspect().acceptedRecords).toEqual([]);
  expect(resumed.issuePitch(take)).toEqual(practice.issuePitch(take));
  expect(resumed.capture()).toEqual(practice.capture());
  const other = { ...input, park:{ fenceRadiusMeters:95, fenceHeightMeters:2 } };
  expect(() => createLiveBattingPracticeV150(other, capture)).toThrow(/configuration/);
  const changed = jsonCopy(capture);
  (changed.configuration.players[0] as { heightMeters:number }).heightMeters = 1.7;
  expect(() => createLiveBattingPracticeV150(input, changed)).toThrow(/configuration/);
});

it('keeps accepted state on request/continuation failures and never accepts manual opponent pitching controls', () => {
  const input = liveMatchFixture(2468), practice = createLiveBattingPracticeV150(input), candidate = practice.preview(take), before = practice.capture();
  for (const request of [{ ...take, pitchType:'fastball' }, { ...take, location:'inside' }, { ...take, managedTeam:1 },
    { ...take, battingDirectionRequestV149:{ version:'batting_direction_request_v149', sourceId:'test', mode:'INVALID' } }]) {
    expect(() => practice.preview(request as typeof take)).toThrow();
    expect(practice.capture()).toEqual(before);
  }
  const invalid = jsonCopy(before);
  (invalid.continuation as { nextTick:number }).nextTick = -1;
  expect(() => createLiveBattingPracticeV150(input, invalid)).toThrow();
  expect(practice.capture()).toEqual(before);
  expect(practice.accept(candidate)).toEqual(candidate.record);
});

it('finishes a real TAKE plate appearance, changes the batter and derives the managed offense after a half change', () => {
  const practice = createLiveBattingPracticeV150(liveMatchFixture(2468)), firstBatter = practice.inspect().batterPlayerId;
  for (let index = 0; index < 6 && practice.inspect().batterPlayerId === firstBatter; index++) practice.issuePitch(take);
  expect(practice.inspect().batterPlayerId).not.toBe(firstBatter);
  expect(practice.inspect().battingOrderIndices[0]).toBe(1);
  // Continue through exactly this half inning with TAKE; no field-play search is needed.
  for (let index = 0; index < 30 && practice.inspect().match.half === 'top'; index++) practice.issuePitch(take);
  expect(practice.inspect().match.half).toBe('bottom');
  expect(practice.preview(take).record.command).toMatchObject({ managedTeam:1, pitchType:'auto', location:'auto', batting:'take' });
});

const workload = ():LiveMatchWorkloadConfigV122 => ({ version:'live_match_workload_v122', sessionId:'s', matchId:'m', managerId:'manager', players:[{
  context:{ sourceId:'workload-test', sourceVersion:'1', scope:{ sessionId:'s', matchId:'m', careerId:'c', playerId:'1-p0', gameDay:1 },
    baseline:{ careerId:'c', playerId:'1-p0', createdAtDay:1, fatigue:.1, recoveryCapacity:1,
      policy:{ policyId:'effort', version:'1', availableAtDay:1, workloadFatiguePerUnit:.01, travelFatiguePerKm:0, recoveryPerHour:.01 } }, activities:[], expectedRevision:0 },
  timingProfile:{ baseStartIntervalUs:1000000, normalMotionToReleaseUs:800000, followThroughUs:400000, quickSpeedFactor:1, cadenceExecutionControl:1, cadenceTimingKnowledge:1,
    quickRepeatability:1, naturalVariationUs:0, normalPhaseWeights:{ gather:1, transition:1, stride:1 }, quickPhaseWeights:{ gather:1, transition:1, stride:1 } },
  pitchPolicy:{ policyId:'response-test', version:'1', availableAtDay:1, motionDurationScaleAtFullFatigue:1.2, velocityRetentionAtFullFatigue:.995, spinRetentionAtFullFatigue:.99 }, effortUnitsPerPitch:1 }] });

it('applies only supplied workload and arrived knowledge on acceptance, exactly as the normal Host', () => {
  const base = liveMatchFixture(31), observerPlayerId = base.teams[0].battingOrder[0], pitcherId = base.teams[1].pitcherId,
    input:LiveMatchInputV1 = { ...base, workloadV122:workload(), players:base.players.map(player => ({ ...player, physical:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } })),
      batterKnowledgeV122:[{ version:'batter_belief_v122', sourceId:'own-history', observerPlayerId, pitcherId, capturedAtTick:500000,
        observedThroughTick:400000, confidence:.5, evidenceRefs:['old'], candidates:[{ familyId:'estimated-fast', regionId:'centre', probability:1,
          prediction:{ x:0, y:1, arrivalAfterReleaseSeconds:.4 } }] }] },
    request = { ...take, swingInstructionV121:{ authority:'hard' as const, effort:.4, compactness:.9 },
      battingDirectionRequestV149:{ version:'batting_direction_request_v149' as const, sourceId:'practice-test', mode:'PULL' as const },
      batterEvidenceV122:{ evidence:{ evidenceId:'own-extra', observerPlayerId, pitcherId, observedTick:600000, availableTick:700000,
        familyId:'estimated-slow', regionId:'low', prediction:{ x:.1, y:.6, arrivalAfterReleaseSeconds:.5 }, reliability:.8 }, learningWeight:.2 } },
    practice = createLiveBattingPracticeV150(input), host = createLiveBaseballMatchWorkerV116(input), before = practice.capture(), candidate = practice.preview(request);
  expect(practice.capture()).toEqual(before);
  expect(practice.inspect().workloadV122!.players[0].workload.state).toMatchObject({ fatigue:.1, revision:0 });
  expect(practice.inspect().batterKnowledgeV122!.beliefs[0].evidenceRefs).toEqual(['old']);
  expect(practice.accept(candidate)).toEqual(host.issuePitch({ ...normalTake, ...request }));
  expect(practice.capture().continuation).toEqual(host.captureContinuationV116());
  expect(practice.inspect().workloadV122!.players[0].workload.state).toMatchObject({ fatigue:.11, revision:1 });
  expect(practice.inspect().batterKnowledgeV122!.beliefs[0].evidenceRefs).toEqual(['old', 'own-extra']);
  const resumed = createLiveBattingPracticeV150(input, jsonCopy(practice.capture()));
  expect(resumed.issuePitch(take)).toEqual(practice.issuePitch(take));
  expect(resumed.capture()).toEqual(practice.capture());
});
