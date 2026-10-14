import { afterEach, expect, it, vi } from 'vitest';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import * as timing from './SqlitePlayerPitchTimingStore';
import * as release from './SqlitePlayerReleaseGeometryStore';
import * as policy from './SqlitePitchFatiguePolicyStore';
import * as persons from './SqlitePlayerPersonLinkStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createRosterState } from '../../core/world/roster/RosterState';
import { rosterFixture } from '../../core/world/roster/RosterTestFixtures';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { startDevelopmentLearningEpisode, appendDevelopmentLearningEvent } from '../../core/world/development/DevelopmentLearningEpisode';
import { practiceBundleForEpisode } from '../../core/world/development/DevelopmentPracticeExposure.test-support';
const fixtures: ReturnType<typeof enrollmentFixture>[] = [];
afterEach(() => { vi.restoreAllMocks(); fixtures.splice(0).forEach(f => f.close()); });
const api = () => {
  const t = (timing as any).readPlayerPitchTimingPrefixFromSqlite, r = (release as any).readPlayerReleaseGeometryPrefixFromSqlite,
    p = (policy as any).readPitchFatiguePolicyFromSqlite;
  expect([t, r, p].every(v => typeof v === 'function'), 'bounded nominal owner readers missing').toBe(true); return { t, r, p };
};
const setup = () => {
  const f = enrollmentFixture(); fixtures.push(f); const person = f.actor.defenderPersons[0];
  vi.spyOn(persons, 'playerPersonLinkEvidenceFromSqlite').mockReturnValue({ readLink: (id: string) => id === person.sourceId ? person : null } as any);
  const common = { careerId: person.careerId, playerId: person.playerId, personLinkSourceId: person.sourceId, acceptedAtDay: 1, sourceVersion: 'fixture-v1' };
  const t = { ...common, sourceId: 'timing', profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
    quickSpeedFactor: 1.5, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.7, naturalVariationUs: 50_000,
    normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const r = { ...common, sourceId: 'release', body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
    tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const p = { sourceId: 'policy', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 1,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
  const links = { readAcceptedPlayerPersonLink: () => person };
  const ts = timing.openSqlitePlayerPitchTimingStore(f.path, links, { readAcceptedBaseline: () => t, readAcceptedLearning: () => null });
  const rs = release.openSqlitePlayerReleaseGeometryStore(f.path, links, { readAcceptedBaseline: () => r, readAcceptedChange: () => null });
  const ps = policy.openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => p });
  const tv = ts.initialize(t.sourceId), rv = rs.initialize(r.sourceId); ps.accept(p.sourceId); ts.close(); rs.close(); ps.close();
  const ref = (owner: string, s: { sourceId: string }, value: unknown) => ({ owner, sourceId: s.sourceId, sourceHash: hash(s), snapshotHash: hash(value) });
  return { ...f, person, t, r, p, tv, rv, tr: ref('world_pitch_timing_baselines', t, tv), rr: ref('world_player_release_baselines', r, rv), pr: ref('world_pitch_fatigue_policies', p, p) };
};
it('DN01 endpoint refs reconstruct the normal timing release and policy values on the private Native connection', () => {
  const a = api(), f = setup(); expect(a.t(f.db, f.tr)).toEqual(f.tv); expect(a.r(f.db, f.rr)).toEqual(f.rv); expect(a.p(f.db, f.pr)).toEqual(f.p);
});
it('DN02 historical endpoint reads preserve opaque future records and heads', () => {
  const a = api(), f = setup();
  f.db.prepare('INSERT INTO world_pitch_timing_updates VALUES(?,?,?,?,?,?,?)').run('future-t', 'career-a', 'home-1', 99, 100, json('opaque'), json('opaque'));
  f.db.prepare('INSERT INTO world_player_release_changes VALUES(?,?,?,?,?)').run('future-r', 'career-a', 'home-1', 100, json('opaque'));
  f.db.exec("UPDATE world_pitch_timing_heads SET revision=100,state_json='\"opaque\"'; UPDATE world_player_release_heads SET revision=100,state_json='\"opaque\"'");
  expect(a.t(f.db, f.tr)).toEqual(f.tv); expect(a.r(f.db, f.rr)).toEqual(f.rv);
});
it('DN03 wrong endpoint hashes moved raw identities and temp aliases reject', () => {
  const a = api(), f = setup(); expect(() => a.t(f.db, { ...f.tr, snapshotHash: hash('wrong') })).toThrow();
  f.db.prepare("UPDATE world_pitch_timing_baselines SET source_id='moved'").run(); expect(() => a.t(f.db, f.tr)).toThrow();
  f.db.exec('CREATE TEMP TABLE world_player_release_baselines(source_id TEXT)'); expect(() => a.r(f.db, f.rr)).toThrow();
});
it('DN04 policy Sources and version aliases retain exact independent ownership', () => {
  const a = api(), f = setup(); expect(() => a.p(f.db, { ...f.pr, sourceHash: hash('wrong') })).toThrow();
  f.db.prepare("UPDATE world_pitch_fatigue_policies SET source_id='moved'").run(); expect(() => a.p(f.db, f.pr)).toThrow();
});
const learning = () => {
  const before = createRosterState(JSON.parse(JSON.stringify({ ...rosterFixture(), careerId: 'career-a' }).replaceAll('p2', 'home-1')));
  const change = applyRosterChange(before, { commandId: 'promote-1', causeEventId: 'selection-1', expectedRevision: 0, effectiveDay: 10,
    changes: [{ playerId: 'home-1', assignment: { clubId: 'a', unitId: 'a-first' } }] }); if (!change.ok) throw new Error('fixture roster change failed');
  let episode = startDevelopmentLearningEpisode('learning-1', before, change.state, change.event, 'home-1', { careerId: 'career-a', playerId: 'home-1', createdAtDay: 1, profileVersion: 'catalyst-v1' },
    { policyId: 'learning-policy', version: 'v1', availableAtDay: 10, minimumPracticeEvents: 3, minimumFeedbackEvents: 1, minimumElapsedDays: 5 });
  const events = [{ kind: 'APPRAISAL_ENGAGED', atDay: 10 }, { kind: 'HYPOTHESIS_FORMED', atDay: 11 }, { kind: 'PRACTICE_RECORDED', atDay: 12 },
    { kind: 'PRACTICE_RECORDED', atDay: 13 }, { kind: 'PRACTICE_RECORDED', atDay: 14 }, { kind: 'FEEDBACK_RECORDED', atDay: 14 }, { kind: 'CONSOLIDATION_RECORDED', atDay: 15 }] as const;
  for (const [i, event] of events.entries()) episode = appendDevelopmentLearningEvent(episode, episode.revision, { eventId: 'event:' + i, sourceEventId: 'practice:' + i,
    ...event, ...(i ? { domain: 'TECHNICAL' as const } : {}) });
  return { sourceId: 'learning', episode, measurements: [2, 3, 4].map(i => ({ practiceSourceEventId: 'practice:' + i, normalMotionToReleaseUs: 600_000, quickMotionToReleaseUs: 300_000 })), practice: practiceBundleForEpisode(episode) };
};
it('DN05 timing update endpoints select only the applicable state inside their authenticated bounded prefix', () => {
  const select = (timing as any).selectPlayerPitchTimingProfileFromSqlitePrefix;
  expect(select, 'bounded game-day timing selector missing').toBeTypeOf('function');
  const a = api(), f = setup(), source = learning(), ts = timing.openSqlitePlayerPitchTimingStore(f.path, { readAcceptedPlayerPersonLink: () => f.person }, { readAcceptedBaseline: () => f.t, readAcceptedLearning: () => source });
  const value = ts.apply(source.sourceId, 0); ts.close(); const ref = { owner: 'world_pitch_timing_updates', sourceId: source.sourceId, sourceHash: hash(source), snapshotHash: hash(value) };
  expect(a.t(f.db, ref)).toEqual(value); expect(select(f.db, ref, 2)).toEqual(f.tv.profile); expect(select(f.db, ref, 20)).toEqual(value.profile);
  f.db.prepare("UPDATE world_pitch_timing_updates SET after_revision=100,before_revision=99 WHERE source_id='learning'").run(); expect(() => a.t(f.db, ref)).toThrow();
});
it('DN06 new acceptance rejects unpinned applicable timing and release revisions while historical refs remain readable', () => {
  const t = (timing as any).assertCurrentPlayerPitchTimingPrefixFromSqlite, r = (release as any).assertCurrentPlayerReleaseGeometryPrefixFromSqlite;
  expect([t, r].every(v => typeof v === 'function'), 'current nominal endpoint gates missing').toBe(true);
  const a = api(), f = setup(), source = learning(), links = { readAcceptedPlayerPersonLink: () => f.person };
  const ts = timing.openSqlitePlayerPitchTimingStore(f.path, links, { readAcceptedBaseline: () => f.t, readAcceptedLearning: () => source }); ts.apply(source.sourceId, 0); ts.close();
  const changed = { sourceId: 'release-change', sourceVersion: 'fixture-v1', careerId: 'career-a', playerId: 'home-1', causeEventId: 'fixture-coaching', causeKind: 'FORM_REBUILD' as const,
    effectiveDay: 15, body: f.r.body, profile: { ...f.r.profile, releaseHeightRatio: 0.8, releaseHeightTier: 'HIGH_MID' as const } };
  const rs = release.openSqlitePlayerReleaseGeometryStore(f.path, links, { readAcceptedBaseline: () => f.r, readAcceptedChange: () => changed }); const rv = rs.apply(changed.sourceId, 0); rs.close();
  expect(() => t(f.db, f.tr, 20)).toThrow(/current|unpinned|applicable/); expect(() => r(f.db, f.rr, 20)).toThrow(/current|unpinned|applicable/);
  expect(() => t(f.db, f.tr, 2)).not.toThrow(); expect(() => r(f.db, f.rr, 2)).not.toThrow();
  expect(a.t(f.db, f.tr)).toEqual(f.tv); expect(a.r(f.db, f.rr)).toEqual(f.rv);
  const rr = { owner: 'world_player_release_changes', sourceId: changed.sourceId, sourceHash: hash(changed), snapshotHash: hash(rv) }; expect(a.r(f.db, rr)).toEqual(rv);
});
