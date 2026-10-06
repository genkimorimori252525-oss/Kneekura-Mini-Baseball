import { expect, it } from 'vitest';
import { deriveDefenderPhysicalReachCalibration } from '../../core/sim/fielding/DefenderPhysicalProfileCalibration';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { bodyMaterializationFixture as fixture, materialized, materializationCount, installPitcherRelease, ref,
  type AcceptedBodySource, type AcceptedPoseSource, type AcceptedReachSource } from './PlayerBodyCapabilityMaterializationFixtures.test-support';

it('materializes original Person/body/pose evidence through the existing reach kernel and existing fielding owner', () => {
  const f = fixture();
  try {
    const value = materialized(f);
    expect(value.source).toEqual(f.request);
    expect(value.person).toEqual(f.person);
    expect(value.body).toEqual(f.body);
    expect(value.pose).toEqual(f.pose);
    expect(value.reachCalibration).toEqual(f.calibration);
    expect(value.fieldingModel).toEqual(f.fielding);
    expect(value.reach).toEqual(deriveDefenderPhysicalReachCalibration(f.body.physicalProfile, f.calibration.baseline));
    expect(value.actor).toEqual({ playerId: f.person.playerId, personId: f.person.personId,
      heightMeters: 1.8, bodyOriginHeightMeters: 0.95, primitives: f.pose.primitives });
    expect(Object.keys(value.actor).sort()).toEqual(['bodyOriginHeightMeters', 'heightMeters', 'personId', 'playerId', 'primitives']);
    expect(Object.isFrozen(value.actor.primitives[0].offset)).toBe(true);
    expect(materializationCount(f)).toEqual({ n: 1 });
    expect(f.models.read(f.source.sourceId)).toEqual(f.fielding);
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
  } finally { f.close(); }
});

it('changes derived physical intermediates for an accepted height change, without inventing primitive dimensions or ability', () => {
  const f = fixture();
  try {
    const original = materialized(f);
    const taller: AcceptedBodySource = { ...f.body, sourceId: 'measured-taller-body', physicalProfile: { heightMeters: 1.98 } };
    const pose: AcceptedPoseSource = { ...f.pose, sourceId: 'accepted-taller-pose', bodyRef: ref(taller) };
    const request = { ...f.request, sourceId: 'taller-materialization', bodyRef: ref(taller), poseRef: ref(pose) };
    f.bodies.set(taller.sourceId, taller); f.poses.set(pose.sourceId, pose); f.requests.set(request.sourceId, request);
    const changed = materialized(f, request.sourceId);
    expect(changed.reach).toEqual(deriveDefenderPhysicalReachCalibration(taller.physicalProfile, f.calibration.baseline));
    expect(changed.actor.bodyOriginHeightMeters).toBeCloseTo(1.045, 12);
    expect(changed.reach.maximumGloveReachMeters).toBeCloseTo(1.43, 12);
    expect(changed.reach.maximumLegReachMeters).toBeCloseTo(1.65, 12);
    expect(changed.reach.maximumTagReachMeters).toBeCloseTo(1.21, 12);
    expect(changed.actor.bodyOriginHeightMeters).not.toBe(original.actor.bodyOriginHeightMeters);
    expect(changed.actor.primitives).toEqual(original.actor.primitives);
    expect(changed.fieldingModel).toEqual(original.fieldingModel);
    expect(f.materializations.read(f.request.sourceId)).toEqual(original);
  } finally { f.close(); }
});

it('keeps physical output and abilities identical when only independently accepted display metadata changes', () => {
  const f = fixture();
  try {
    const original = materialized(f);
    const relabeled = { ...f.body, sourceId: 'relabeled-body', displayLabel: 'very tall elite player' };
    const pose = { ...f.pose, sourceId: 'relabeled-pose', bodyRef: ref(relabeled) };
    const request = { ...f.request, sourceId: 'relabeled-materialization', bodyRef: ref(relabeled), poseRef: ref(pose) };
    f.bodies.set(relabeled.sourceId, relabeled); f.poses.set(pose.sourceId, pose); f.requests.set(request.sourceId, request);
    const result = materialized(f, request.sourceId);
    expect(result.actor).toEqual(original.actor);
    expect(result.reach).toEqual(original.reach);
    expect(result.fieldingModel).toEqual(original.fieldingModel);
    expect(result.releaseGeometry).toBeNull();
  } finally { f.close(); }
});

it.each(['body', 'pose', 'reachCalibration', 'fieldingModel'] as const)('returns explicit pending for an unsupplied %s pin without a partial actor', (missing) => {
  const f = fixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, [`${missing}Ref`]: null });
    expect(f.materializations.accept(f.request.sourceId)).toEqual({ kind: 'pending', missing: [missing] });
    expect(f.materializations.read(f.request.sourceId)).toBeNull();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('does not conceal a false Person claim behind an unsupplied calibration', () => {
  const f = fixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, personId: 'unowned-person', reachCalibrationRef: null });
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['request', 'body', 'pose', 'reach', 'fielding'] as const)('rejects a missing nonnull %s source instead of using defaults', (missing) => {
  const f = fixture();
  try {
    if (missing === 'request') f.requests.clear();
    if (missing === 'body') f.bodies.clear();
    if (missing === 'pose') f.poses.clear();
    if (missing === 'reach') f.calibrations.clear();
    if (missing === 'fielding') f.db.exec('DELETE FROM world_player_fielding_models');
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['person', 'career', 'player', 'intake', 'version', 'future', 'before-intake', 'height', 'hidden-prior'] as const)
('rejects invalid accepted body %s evidence', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'person' ? { ...f.body, personId: 'person-b' }
      : kind === 'career' ? { ...f.body, careerId: 'other-career' }
      : kind === 'player' ? { ...f.body, playerId: 'player-b' }
      : kind === 'intake' ? { ...f.body, personLinkSourceId: 'intake-b' }
      : kind === 'version' ? { ...f.body, sourceVersion: 'different-version' }
      : kind === 'future' ? { ...f.body, acceptedAtDay: 21 }
      : kind === 'before-intake' ? { ...f.body, acceptedAtDay: 9 }
      : kind === 'height' ? { ...f.body, physicalProfile: { heightMeters: NaN } }
      : { ...f.body, currentAbilityFromDevelopmentPrior: 0.99 };
    f.bodies.set(f.body.sourceId, changed);
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['wrong-body', 'wrong-person', 'wrong-version', 'future', 'duplicate-role', 'missing-role', 'nonfinite-radius'] as const)
('rejects %s pose evidence instead of claiming generated anatomy', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'wrong-body' ? { ...f.pose, bodyRef: { ...f.pose.bodyRef, sourceId: 'unrelated-body' } }
      : kind === 'wrong-person' ? { ...f.pose, personId: 'person-b' }
      : kind === 'wrong-version' ? { ...f.pose, bodyRef: { ...f.pose.bodyRef, sourceVersion: 'future-body' } }
      : kind === 'future' ? { ...f.pose, acceptedAtDay: 21 }
      : kind === 'duplicate-role' ? { ...f.pose, primitives: f.pose.primitives.map((p) => p.role === 'glove' ? { ...p, role: 'body' as const } : p) }
      : kind === 'missing-role' ? { ...f.pose, primitives: f.pose.primitives.slice(1) }
      : { ...f.pose, primitives: f.pose.primitives.map((p) => ({ ...p, radius: Infinity })) };
    f.poses.set(f.pose.sourceId, changed);
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['future', 'version', 'invalid-baseline', 'origin-outside-body'] as const)('rejects %s reach calibration', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'future' ? { ...f.calibration, acceptedAtDay: 21 }
      : kind === 'version' ? { ...f.calibration, sourceVersion: 'wrong-version' }
      : kind === 'invalid-baseline' ? { ...f.calibration, baseline: { ...f.calibration.baseline, maximumTagReachMeters: 0 } }
      : { ...f.calibration, baseline: { ...f.calibration.baseline, bodyOriginHeightMeters: 2 } };
    f.calibrations.set(f.calibration.sourceId, changed);
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['wrong-version', 'future', 'wrong-person'] as const)('selects only the native applicable fielding owner: %s', (kind) => {
  const f = fixture();
  try {
    if (kind === 'wrong-version') f.requests.set(f.request.sourceId, { ...f.request,
      fieldingModelRef: { ...ref(f.source), sourceVersion: 'invented-version' } });
    if (kind === 'future') {
      f.db.exec('DELETE FROM world_player_fielding_models');
      f.sources.set(f.source.sourceId, { ...f.source, acceptedAtDay: 21 }); f.models.accept(f.source.sourceId);
    }
    if (kind === 'wrong-person') f.db.exec("UPDATE world_player_person_links SET person_id='person-b'");
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['batter', 'runner'] as const)('prepares a %s actor without pretending body dimensions create its role capability', (role) => {
  const f = fixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, role, fieldingModelRef: null });
    const result = materialized(f);
    expect(result.fieldingModel).toBeNull();
    expect(result.actor.primitives).toEqual(f.pose.primitives);
    expect(result).not.toHaveProperty('battingAbility');
    expect(result).not.toHaveProperty('runnerDecision');
  } finally { f.close(); }
});

it.each(['batter', 'runner'] as const)('rejects an extra fielding capability pin for the %s-only role', (role) => {
  const f = fixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, role });
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it.each(['defender', 'batter', 'runner'] as const)('rejects a valid release pin outside the pitching role: %s', (role) => {
  const f = fixture();
  try {
    installPitcherRelease(f);
    f.requests.set(f.request.sourceId, { ...f.requests.get(f.request.sourceId)!, role,
      fieldingModelRef: role === 'defender' ? f.request.fieldingModelRef : null });
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('rejects a valid fielding source owned by another actual Player/Person', () => {
  const f = fixture();
  try {
    const other = { ...f.person, sourceId: 'intake-b', playerId: 'player-b', personId: 'person-b', sourceRecordId: 'accepted-intake-b' };
    const links = f.track(openSqlitePlayerPersonLinkStore(f.path, { readAcceptedPlayerIntake: (id) => id === other.sourceId ? other : null }));
    links.accept(other.sourceId);
    const capability = { ...f.source, sourceId: 'fielding-b', playerId: other.playerId, personLinkSourceId: other.sourceId };
    f.sources.set(capability.sourceId, capability); f.models.accept(capability.sourceId);
    f.requests.set(f.request.sourceId, { ...f.request, fieldingModelRef: ref(capability) });
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('keeps an unsupplied pitcher release explicit without generating one from body height', () => {
  const f = fixture();
  try {
    f.requests.set(f.request.sourceId, { ...f.request, role: 'pitcher' });
    expect(f.materializations.accept(f.request.sourceId)).toEqual({ kind: 'pending', missing: ['releaseGeometry'] });
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('pins the pitcher release snapshot for the requested day, even when a later body change exists', () => {
  const f = fixture();
  try {
    const { release, change } = installPitcherRelease(f);
    release.apply(change.sourceId, 0);
    const expected = release.selectAtDay(f.person.careerId, f.person.playerId, f.request.atDay);
    const result = materialized(f);
    expect(result.releaseGeometry).toEqual(expected);
    expect(result.actor.heightMeters).toBe(expected.body.heightMeters);
    expect(result.releaseGeometry!.sourceId).not.toBe(change.sourceId);
    const reopened = f.track(f.open(f.path));
    expect(reopened.read(f.request.sourceId)).toEqual(result);
    expect(release.readHead(f.person.careerId, f.person.playerId)!.revision).toBe(1);
  } finally { f.close(); }
});

it('replays the originally pinned release after a valid equal-day history append without reselecting today’s head', () => {
  const f = fixture();
  try {
    const { release, change } = installPitcherRelease(f, 1.8, f.request.atDay);
    const original = materialized(f);
    release.apply(change.sourceId, 0);
    expect(release.selectAtDay(f.person.careerId, f.person.playerId, f.request.atDay).sourceId).toBe(change.sourceId);
    expect(f.materializations.read(f.request.sourceId)).toEqual(original);
    expect(f.materializations.accept(f.request.sourceId)).toEqual({ kind: 'materialized', value: original });
    const reopened = f.track(f.open(f.path));
    expect(reopened.read(f.request.sourceId)).toEqual(original);
    expect(reopened.accept(f.request.sourceId)).toEqual({ kind: 'materialized', value: original });
    const fresh = { ...f.requests.get(f.request.sourceId)!, sourceId: 'fresh-receipt-with-stale-release-pin' };
    f.requests.set(fresh.sourceId, fresh);
    expect(() => f.materializations.accept(fresh.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 1 });
  } finally { f.close(); }
});

it.each(['missing', 'wrong-version', 'wrong-day', 'different-body'] as const)('rejects a pitcher %s release selection', (kind) => {
  const f = fixture();
  try {
    installPitcherRelease(f, kind === 'different-body' ? 1.98 : 1.8);
    const request = f.requests.get(f.request.sourceId)!;
    const pin = request.releaseGeometryRef!;
    if (kind !== 'different-body') f.requests.set(request.sourceId, { ...request, releaseGeometryRef: {
      ...pin, ...(kind === 'missing' ? { sourceId: 'missing-release' } : kind === 'wrong-version'
        ? { sourceVersion: 'wrong-version' } : { effectiveDay: 11 }),
    } });
    expect(() => f.materializations.accept(request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('reopens from archived original inputs without external authority and rejects changed retry inputs', () => {
  const f = fixture();
  try {
    const value = materialized(f);
    f.bodies.set(f.body.sourceId, { ...f.body, physicalProfile: { heightMeters: 1.98 } });
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    f.requests.clear(); f.bodies.clear(); f.poses.clear(); f.calibrations.clear();
    const reopened = f.track(f.open(f.path));
    expect(reopened.read(f.request.sourceId)).toEqual(value);
    expect(reopened.accept(f.request.sourceId)).toEqual({ kind: 'materialized', value });
    expect(f.models.read(f.source.sourceId)).toEqual(f.fielding);
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
  } finally { f.close(); }
});

it.each(['body', 'pose', 'reach'] as const)('cannot launder changed %s evidence under an old source pin in a new receipt', (kind) => {
  const f = fixture();
  try {
    const prior = materialized(f), next = { ...f.request, sourceId: 'new-receipt-same-pins' };
    if (kind === 'body') f.bodies.set(f.body.sourceId, { ...f.body, physicalProfile: { heightMeters: 1.98 } } satisfies AcceptedBodySource);
    if (kind === 'pose') f.poses.set(f.pose.sourceId, { ...f.pose,
      primitives: f.pose.primitives.map((p) => ({ ...p, radius: p.radius + 0.01 })) } satisfies AcceptedPoseSource);
    if (kind === 'reach') f.calibrations.set(f.calibration.sourceId, { ...f.calibration,
      baseline: { ...f.calibration.baseline, maximumGloveReachMeters: 1.4 } } satisfies AcceptedReachSource);
    f.requests.set(next.sourceId, next);
    expect(() => f.materializations.accept(next.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 1 });
    expect(f.materializations.read(f.request.sourceId)).toEqual(prior);
  } finally { f.close(); }
});

it.each([
  "UPDATE world_player_person_links SET person_id='changed-person'",
  "UPDATE world_player_fielding_models SET accepted_at_day=99",
  'DELETE FROM world_player_fielding_models',
])('rolls back writer-local owner mutation after receipt insertion: %s', (mutation) => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER mutate_materialization_dependency AFTER INSERT ON world_player_body_materializations BEGIN ${mutation}; END;`);
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
    expect(f.models.read(f.source.sourceId)).toEqual(f.fielding);
    f.db.exec('DROP TRIGGER mutate_materialization_dependency');
    expect(materialized(f).person).toEqual(f.person);
  } finally { f.close(); }
});

it('rolls back a writer-local historical release mutation instead of trusting an independent connection', () => {
  const f = fixture();
  try {
    const { release } = installPitcherRelease(f);
    const original = release.selectAtDay(f.person.careerId, f.person.playerId, f.request.atDay);
    f.db.exec(`CREATE TRIGGER mutate_release_dependency AFTER INSERT ON world_player_body_materializations
      BEGIN UPDATE world_player_release_baselines SET source_json='{}'; END;`);
    expect(() => f.materializations.accept(f.request.sourceId)).toThrow();
    expect(materializationCount(f)).toEqual({ n: 0 });
    expect(release.selectAtDay(f.person.careerId, f.person.playerId, f.request.atDay)).toEqual(original);
    f.db.exec('DROP TRIGGER mutate_release_dependency');
    expect(materialized(f).releaseGeometry).toEqual(original);
  } finally { f.close(); }
});

it.each([
  "UPDATE world_player_body_materializations SET source_hash='changed'",
  "UPDATE world_player_body_materializations SET snapshot_hash='changed'",
  "UPDATE world_player_body_materializations SET source_id='moved-source'",
  "UPDATE world_player_body_materializations SET player_id='wrong-player'",
  "UPDATE world_player_person_links SET person_id='changed-person'",
])('rejects corrupt original provenance on reopen and retry: %s', (mutation) => {
  const f = fixture();
  try {
    materialized(f); f.db.exec(mutation);
    const reopened = f.track(f.open(f.path));
    expect(() => reopened.read(f.request.sourceId)).toThrow();
    expect(() => reopened.accept(f.request.sourceId)).toThrow();
  } finally { f.close(); }
});
