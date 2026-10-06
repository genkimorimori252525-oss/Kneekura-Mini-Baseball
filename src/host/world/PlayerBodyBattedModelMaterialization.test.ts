import { expect, it } from 'vitest';
import { battedWorldContactFixture } from './BattedWorldContactFixtures.test-support';
import { bodyMaterializationOpener, ref, type AcceptedBodySource, type AcceptedPoseSource, type AcceptedReachSource,
  type BodyMaterializationRequest, type BodyMaterializationReceipt, type BattedBodyModelAssembly } from './PlayerBodyCapabilityMaterializationFixtures.test-support';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { openSqliteBattedWorldContactStore } from './SqliteBattedWorldContactStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const fixture = (omitPlayer?: string) => {
  const open = bodyMaterializationOpener();
  const base = battedWorldContactFixture(), { f, model, physical } = base;
  const atDay = physical.frame.batterActor!.binding.gameDay;
  const bodies = new Map<string, AcceptedBodySource>(), poses = new Map<string, AcceptedPoseSource>();
  const requests = new Map<string, BodyMaterializationRequest>(), fieldingSources = new Map<string, AcceptedPlayerFieldingModel>();
  const calibration: AcceptedReachSource = { sourceId: 'explicit-game-reach', sourceVersion: 'fixture-v1', acceptedAtDay: 1,
    baseline: { bodyOriginHeightMeters: 0.95, maximumLegReachMeters: 1.5, maximumGloveReachMeters: 1.3, maximumTagReachMeters: 1.1 } };
  const fielding = f.track(openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: (id) => fieldingSources.get(id) ?? null }));
  for (const actor of model.actors) {
    const person = f.links.readLink(`intake-${actor.playerId}`)!;
    const scope = { careerId: person.careerId, playerId: person.playerId, personId: person.personId, personLinkSourceId: person.sourceId };
    const body: AcceptedBodySource = { sourceId: `accepted-body-${actor.playerId}`, sourceVersion: 'fixture-v1', ...scope,
      acceptedAtDay: 1, physicalProfile: { heightMeters: actor.heightMeters }, displayLabel: actor.playerId };
    const pose: AcceptedPoseSource = { sourceId: `accepted-pose-${actor.playerId}`, sourceVersion: 'fixture-v1', ...scope,
      acceptedAtDay: 1, bodyRef: ref(body), primitives: actor.primitives };
    const role = actor.playerId === physical.frame.workload.playerId ? 'pitcher'
      : actor.playerId === physical.frame.batterActor!.binding.playerId ? 'batter' : 'defender';
    // Explicit test-only role measurements. Neither production body size nor priors generate these values.
    const capability: AcceptedPlayerFieldingModel = { sourceId: `accepted-fielding-${actor.playerId}`, sourceVersion: 'fixture-v1',
      careerId: person.careerId, playerId: person.playerId, personLinkSourceId: person.sourceId, acceptedAtDay: 1,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5,
        transfer: 0.5, armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
      throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
    if (role !== 'batter') { fieldingSources.set(capability.sourceId, capability); fielding.accept(capability.sourceId); }
    const release = role === 'pitcher' ? f.release.selectAtDay(person.careerId, person.playerId, atDay) : null;
    const request: BodyMaterializationRequest = { sourceId: `materialized-${actor.playerId}`, sourceVersion: 'body-composition-v1', ...scope,
      atDay, role, bodyRef: omitPlayer === actor.playerId ? null : ref(body), poseRef: ref(pose), reachCalibrationRef: ref(calibration),
      fieldingModelRef: role === 'batter' ? null : ref(capability),
      releaseGeometryRef: release ? { ...ref(release), effectiveDay: release.effectiveDay } : null };
    bodies.set(body.sourceId, body); poses.set(pose.sourceId, pose); requests.set(request.sourceId, request);
  }
  const assembly: BattedBodyModelAssembly = { ...model, sourceVersion: 'accepted-model-assembly-v1', kind: 'body_materialized_batted_model_v1', atDay,
    actors: model.actors.map((actor) => ({ playerId: actor.playerId, personId: actor.personId,
      materializationRef: ref(requests.get(`materialized-${actor.playerId}`)!) })) };
  const assemblies = new Map([[assembly.sourceId, assembly]]);
  const materializations = f.track(open(f.path, {
    readAcceptedMaterialization: (id) => requests.get(id) ?? null,
    readAcceptedBody: (id) => bodies.get(id) ?? null,
    readAcceptedPose: (id) => poses.get(id) ?? null,
    readAcceptedReachCalibration: (id) => id === calibration.sourceId ? calibration : null,
    readAcceptedModelAssembly: (id) => assemblies.get(id) ?? null,
  }));
  const receipts = new Map<string, BodyMaterializationReceipt>();
  for (const request of requests.values()) {
    const result = materializations.accept(request.sourceId);
    if (request.playerId === omitPlayer) expect(result).toEqual({ kind: 'pending', missing: ['body'] });
    else {
      expect(result.kind).toBe('materialized');
      if (result.kind === 'materialized') receipts.set(request.playerId, result.value);
    }
  }
  const contacts = f.track(openSqliteBattedWorldContactStore(f.path, base.flights, {
    readAcceptedContact: base.authority.readAcceptedContact,
    readAcceptedModel: (id) => materializations.readAcceptedModel(id),
  }));
  return { ...base, contacts, open, materializations, assembly, assemblies, receipts, requests };
};

it('feeds materialized actors into the existing Batted World contact owner and its real physical primitives', () => {
  const f = fixture();
  try {
    const model = f.materializations.acceptModel(f.assembly.sourceId);
    expect(model.kind).toBe('body_materialized_batted_model_v1');
    expect(model.materializationSourceId).toBe(f.assembly.sourceId);
    expect(model.sourceVersion).toBe(f.assembly.sourceVersion);
    expect(model.actors).toEqual(f.assembly.actors.map((a) => f.receipts.get(a.playerId)!.actor));
    expect(model.batterGripOffset).toEqual(f.model.batterGripOffset);
    expect(model.surfaces).toEqual(f.model.surfaces);
    const actual = f.contacts.accept(f.source.sourceId);
    expect(actual.model).toEqual(model);
    expect(actual.actors).toHaveLength(50);
    const pitcherBody = actual.actors.find((actor) => actor.playerId === 'p2' && actor.primitive.role === 'body')!;
    const accepted = f.receipts.get('p2')!, offset = accepted.actor.primitives.find((p) => p.role === 'body')!.offset.y;
    expect(pitcherBody.primitive.startCenter.y).toBeCloseTo(accepted.reach.bodyOriginHeightMeters + offset, 12);
    expect(pitcherBody.primitive.startCenter.y).not.toBe(offset);
    expect(f.f.official.getMatch('game-1')!.durableRevision).toBe(0);

    f.assemblies.clear(); f.requests.clear();
    const reopenedSource = f.f.track(f.open(f.f.path));
    expect(reopenedSource.readAcceptedModel(model.sourceId)).toEqual(model);
    const legacyReader = f.f.track(openSqliteBattedWorldContactStore(f.f.path, f.flights));
    expect(legacyReader.read(f.source.sourceId)).toEqual(actual);
    expect(legacyReader.accept(f.source.sourceId)).toEqual(actual);
  } finally { f.f.close(); }
});

it('records exact actor materialization references in the immutable model manifest, not just flattened geometry', () => {
  const f = fixture();
  try {
    f.materializations.acceptModel(f.assembly.sourceId);
    const row = f.f.db.prepare('SELECT source_json FROM world_batted_body_materializations WHERE source_id=?')
      .get(f.assembly.sourceId)!;
    expect(JSON.parse(row.source_json as string)).toEqual(f.assembly);
    const changed = { ...f.assembly, actors: f.assembly.actors.map((a, i) => i ? a : {
      ...a, materializationRef: { ...a.materializationRef, sourceId: 'different-receipt' },
    }) };
    f.assemblies.set(changed.sourceId, changed);
    expect(() => f.materializations.acceptModel(changed.sourceId)).toThrow();
  } finally { f.f.close(); }
});

it.each(['fixture-v1', 'body_materialized_batted_model_v1'])('preserves a legacy model with opaque sourceVersion %s and no new schema', (sourceVersion) => {
  bodyMaterializationOpener();
  const f = battedWorldContactFixture();
  try {
    const model = { ...f.model, sourceVersion };
    f.models.set(model.sourceId, model);
    const original = f.contacts.accept(f.source.sourceId);
    expect(original.model).toEqual(model);
    expect(f.f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('world_player_body_materializations','world_batted_body_materializations')").all()).toEqual([]);
    const reopened = f.f.track(openSqliteBattedWorldContactStore(f.f.path, f.flights));
    expect(reopened.read(f.source.sourceId)).toEqual(original);
  } finally { f.f.close(); }
});

it.each(['original-index', 'moved-manifest-index', 'moved-manifest-source-claim'] as const)
('rejects a coherently legacy-relabeled model while its %s materialization claim remains', (kind) => {
  const f = fixture();
  try {
    const model = f.materializations.acceptModel(f.assembly.sourceId), original = f.contacts.accept(f.source.sourceId);
    const { kind: _kind, materializationSourceId: _reference, ...legacy } = model;
    const snapshot = { ...original, model: legacy };
    f.f.db.prepare('UPDATE batted_world_models SET source_json=?,source_hash=? WHERE source_id=?')
      .run(json(legacy), hash(legacy), model.sourceId);
    f.f.db.prepare('UPDATE batted_world_contacts SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(json(snapshot), hash(snapshot), f.source.sourceId);
    if (kind === 'moved-manifest-index') f.f.db.exec("UPDATE world_batted_body_materializations SET source_id='hidden-materialization-index'");
    if (kind === 'moved-manifest-source-claim') {
      const alias = { ...f.assembly, sourceId: 'hidden-manifest-source' };
      f.f.db.prepare('UPDATE world_batted_body_materializations SET source_id=?,source_json=?,source_hash=? WHERE source_id=?')
        .run(alias.sourceId, json(alias), hash(alias), f.assembly.sourceId);
      // The original model ID and explicit materialization reference remain in the archived snapshot.
    }
    const reopened = f.f.track(openSqliteBattedWorldContactStore(f.f.path, f.flights));
    expect(() => reopened.read(f.source.sourceId)).toThrow();
    expect(() => reopened.accept(f.source.sourceId)).toThrow();
  } finally { f.f.close(); }
});

it('does not reinterpret a materialized model as legacy caller geometry after its manifest is deleted', () => {
  const f = fixture();
  try {
    f.materializations.acceptModel(f.assembly.sourceId); f.contacts.accept(f.source.sourceId);
    f.f.db.exec('DELETE FROM world_batted_body_materializations');
    const reopened = f.f.track(openSqliteBattedWorldContactStore(f.f.path, f.flights));
    expect(() => reopened.read(f.source.sourceId)).toThrow();
    expect(() => reopened.accept(f.source.sourceId)).toThrow();
  } finally { f.f.close(); }
});

it('checks the materialized model manifest on the contact writer connection before committing physical actors', () => {
  const f = fixture();
  try {
    const model = f.materializations.acceptModel(f.assembly.sourceId);
    f.f.db.exec(`CREATE TRIGGER remove_body_manifest AFTER INSERT ON batted_world_models
      BEGIN DELETE FROM world_batted_body_materializations; END;`);
    expect(() => f.contacts.accept(f.source.sourceId)).toThrow();
    expect(f.f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
    expect(f.f.db.prepare('SELECT count(*) AS n FROM batted_world_models').get()).toEqual({ n: 0 });
    expect(f.materializations.readAcceptedModel(model.sourceId)).toEqual(model);
    f.f.db.exec('DROP TRIGGER remove_body_manifest');
    expect(f.contacts.accept(f.source.sourceId).model).toEqual(model);
  } finally { f.f.close(); }
});

it('does not invent geometry for an explicitly requested later batter whose accepted body is absent', () => {
  const f = fixture('away-2');
  try {
    expect(f.assembly.actors.some((a) => a.playerId === 'away-2')).toBe(true);
    expect(f.materializations.read('materialized-away-2')).toBeNull();
    expect(() => f.materializations.acceptModel(f.assembly.sourceId)).toThrow();
    expect(f.f.db.prepare('SELECT count(*) AS n FROM world_batted_body_materializations').get()).toEqual({ n: 0 });
    expect(f.f.db.prepare('SELECT count(*) AS n FROM batted_world_models').get()).toEqual({ n: 0 });
  } finally { f.f.close(); }
});

it('leaves a frozen ten-actor model intact instead of treating absent future actors as covered', () => {
  const f = fixture();
  try {
    const currentPlayers = new Set(f.source.commands.map((command) => command.playerId));
    const ten = { ...f.assembly, actors: f.assembly.actors.filter((a) => currentPlayers.has(a.playerId)) };
    expect(ten.actors).toHaveLength(10);
    expect(ten.actors.some((a) => a.playerId === 'away-2')).toBe(false);
    f.assemblies.set(ten.sourceId, ten);
    const originalModel = f.materializations.acceptModel(ten.sourceId);
    const original = f.contacts.accept(f.source.sourceId);
    f.assemblies.set(ten.sourceId, f.assembly);
    expect(() => f.materializations.acceptModel(ten.sourceId)).toThrow();
    expect(f.contacts.read(f.source.sourceId)).toEqual(original);
    expect(originalModel.actors.some((a) => a.playerId === 'away-2')).toBe(false);
  } finally { f.f.close(); }
});

it.each(['wrong-person', 'wrong-version', 'wrong-day', 'unregistered-player', 'duplicate-player'] as const)
('rejects %s model assembly instead of trusting actor-ref metadata', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'wrong-day' ? { ...f.assembly, atDay: f.assembly.atDay + 1 }
      : { ...f.assembly, actors: f.assembly.actors.map((a, i) => i ? a : kind === 'wrong-person' ? { ...a, personId: 'different-person' }
        : kind === 'wrong-version' ? { ...a, materializationRef: { ...a.materializationRef, sourceVersion: 'different-version' } }
        : kind === 'unregistered-player' ? { ...a, playerId: 'unregistered-player' } : f.assembly.actors[1]) };
    f.assemblies.set(changed.sourceId, changed);
    expect(() => f.materializations.acceptModel(changed.sourceId)).toThrow();
    expect(f.f.db.prepare('SELECT count(*) AS n FROM world_batted_body_materializations').get()).toEqual({ n: 0 });
  } finally { f.f.close(); }
});

it('rolls back a writer-local actor receipt mutation during model materialization', () => {
  const f = fixture();
  try {
    const original = f.materializations.read('materialized-p2');
    f.f.db.exec(`CREATE TRIGGER mutate_body_receipt AFTER INSERT ON world_batted_body_materializations
      BEGIN UPDATE world_player_body_materializations SET snapshot_hash='changed' WHERE source_id='materialized-p2'; END;`);
    expect(() => f.materializations.acceptModel(f.assembly.sourceId)).toThrow();
    expect(f.f.db.prepare('SELECT count(*) AS n FROM world_batted_body_materializations').get()).toEqual({ n: 0 });
    expect(f.materializations.read('materialized-p2')).toEqual(original);
    f.f.db.exec('DROP TRIGGER mutate_body_receipt');
    expect(f.materializations.acceptModel(f.assembly.sourceId).actors).toHaveLength(f.assembly.actors.length);
  } finally { f.f.close(); }
});

it.each([
  "UPDATE world_batted_body_materializations SET snapshot_hash='changed'",
  "UPDATE world_batted_body_materializations SET source_id='moved-model'",
  "UPDATE world_player_body_materializations SET source_id='moved-body' WHERE source_id='materialized-p2'",
])('rejects changed model provenance on authority-free reopen: %s', (mutation) => {
  const f = fixture();
  try {
    f.materializations.acceptModel(f.assembly.sourceId); f.f.db.exec(mutation);
    const reopened = f.f.track(f.open(f.f.path));
    expect(() => reopened.readAcceptedModel(f.assembly.sourceId)).toThrow();
    expect(() => reopened.acceptModel(f.assembly.sourceId)).toThrow();
  } finally { f.f.close(); }
});
