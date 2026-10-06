import { expect, it } from 'vitest';
import * as locomotion from './SqliteActualLocomotionStore';
import { runnerContactWaitProspectiveFixture, requireRunnerContactWaitFactory } from './RunnerNativeContactWaitFixtures.test-support';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('owns a prospective policy and unique view before the dependent pitch, with immutable retry and no peer mutation', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const before = x.peer(), store = x.f.track(requireRunnerContactWaitFactory(locomotion)(x.f.path,x.authority));
    const policy = store.acceptPolicy(x.policy.sourceId), view = store.acceptView(x.view.sourceId);
    expect(policy.source).toEqual(x.policy); expect(policy.observationModelHash).toBe(actorHash(x.model));
    expect(view.source).toEqual(x.view); expect(view.admission).toBe('prospective_before_dependent_pitch');
    expect(view.actorHash).toBe(actorHash(x.actor)); expect(view.policyHash).toBe(actorHash(policy));
    expect(view.observationModelHash).toBe(actorHash(x.model));
    expect(view.registeredAt).toEqual({ originTick:x.actor.world.tick,elapsedSeconds:0,tick:x.actor.world.tick });
    expect(store.acceptView(x.view.sourceId)).toEqual(view); expect(store.readView(x.view.sourceId)).toEqual(view);
    x.noPitch(); expect(x.peer()).toEqual(before);
    for (const key of ['captures','recognizedEvent','decisionInput','decision','motor','settledForPlay']) expect(view).not.toHaveProperty(key);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it.each(['identical','different_direction','different_policy','equal_endpoint'] as const)
('rejects competing %s view overlap before any dependent pitch or contact and preserves the first admission', variant => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(requireRunnerContactWaitFactory(locomotion)(x.f.path,x.authority));
    store.acceptPolicy(x.policy.sourceId); const first = store.acceptView(x.view.sourceId), before = x.peer();
    let second = { ...x.view,sourceId:'wait-competing-view' };
    if (variant === 'different_direction') second = { ...second,forward:{ x:0,y:0,z:-1 } };
    if (variant === 'different_policy') {
      const policy = { ...x.policy,sourceId:'wait-competing-policy',classification:{ ...x.policy.classification,minimumLoftRecognitionConfidence:0.3 } };
      x.policies.set(policy.sourceId,policy); store.acceptPolicy(policy.sourceId); second = { ...second,policySourceId:policy.sourceId };
    }
    if (variant === 'equal_endpoint') second = { ...second,validFromTick:x.view.validThroughTick,validThroughTick:x.view.validThroughTick+1 };
    x.views.set(second.sourceId,second);
    const allBefore = x.allRows();
    expect(() => store.acceptView(second.sourceId)).toThrow(/overlap|ambiguous|view.*scope/i);
    expect(store.readView(second.sourceId)).toBeNull(); expect(store.readView(x.view.sourceId)).toEqual(first);
    x.noPitch(); expect(x.peer()).toEqual(before); expect(x.allRows()).toEqual(allBefore);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it('rejects new view registration after a genuine dependent pitch while preserving historical view retry and full reopen', () => {
  const x = runnerContactWaitProspectiveFixture();
  let fixtureClosed = false;
  try {
    const open = requireRunnerContactWaitFactory(locomotion);
    const store = x.f.track(open(x.f.path,x.authority)); store.acceptPolicy(x.policy.sourceId); const original = store.acceptView(x.view.sourceId);
    const pitch = x.advancePitch(); expect(pitch.frame.batterActor?.source.sourceId).toBe(x.actor.source.sourceId);
    const late = { ...x.view,sourceId:'wait-late-view',validFromTick:x.view.validThroughTick+1,validThroughTick:x.view.validThroughTick+2 };
    x.views.set(late.sourceId,late); const before = x.peer(), allBefore = x.allRows();
    expect(() => store.acceptView(late.sourceId)).toThrow(/prospective|pitch|frame|late/i);
    expect(store.readView(late.sourceId)).toBeNull(); expect(store.acceptView(x.view.sourceId)).toEqual(original);
    expect(x.peer()).toEqual(before); expect(x.allRows()).toEqual(allBefore);
    const path = x.f.path; x.f.close(); fixtureClosed = true;
    const reopened = open(path,x.authority);
    try { expect(reopened.readView(x.view.sourceId)).toEqual(original); expect(reopened.readPolicy(x.policy.sourceId)?.source).toEqual(x.policy); }
    finally { reopened.close(); }
  } finally { try { if (!fixtureClosed) x.f.close(); } finally { x.cleanupFile(); } }
});

it('rejects an otherwise valid foreign recipient policy instead of borrowing its observation model for the runner view', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(requireRunnerContactWaitFactory(locomotion)(x.f.path,x.authority));
    const other = x.installOtherObservation();
    const foreign = { ...x.policy,sourceId:'wait-other-policy',playerId:other.source.playerId,
      personLinkSourceId:other.source.personLinkSourceId,observationModelSourceId:other.source.sourceId };
    x.policies.set(foreign.sourceId,foreign); expect(store.acceptPolicy(foreign.sourceId).source).toEqual(foreign);
    const source = { ...x.view,sourceId:'wait-foreign-policy-view',policySourceId:foreign.sourceId };
    x.views.set(source.sourceId,source); const before = x.allRows();
    expect(() => store.acceptView(source.sourceId)).toThrow(/recipient|Player|Person|policy|scope/i);
    expect(store.readView(source.sourceId)).toBeNull(); x.noPitch(); expect(x.allRows()).toEqual(before);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it('witnesses actual view insertion and rolls back own and peer changes when its observation model mutates inside that write', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(requireRunnerContactWaitFactory(locomotion)(x.f.path,x.authority));
    store.acceptPolicy(x.policy.sourceId); const before = x.allRows(); let mutated = false;
    const witness = witnessSqliteWrite(/^\s*INSERT\s+(?:OR\s+\w+\s+)?INTO\s+/i, writer => {
      if (mutated) return true;
      const tables = writer.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => String(row.name));
      const inserted = tables.some(name => {
        const table = '"'+name.replaceAll('"','""')+'"';
        if (!writer.prepare('PRAGMA table_info('+table+')').all().some(row => row.name === 'source_id')) return false;
        return !!writer.prepare('SELECT 1 FROM '+table+' WHERE source_id=?').get(x.view.sourceId);
      });
      if (!inserted) return false;
      expect(writer.isTransaction).toBe(true);
      const changed = writer.prepare("UPDATE world_player_observation_models SET source_hash='changed-during-view-insert' WHERE source_id=?")
        .run(x.model.source.sourceId).changes;
      expect(changed).toBe(1);
      mutated = true; return true;
    });
    try { expect(() => store.acceptView(x.view.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(store.readView(x.view.sourceId)).toBeNull(); x.noPitch(); expect(x.allRows()).toEqual(before);
    expect(store.acceptView(x.view.sourceId).source).toEqual(x.view);
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});
