import { afterEach, expect, it, vi } from 'vitest';
import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import * as geometry from './SamePlateAppearanceLifecycleStartingGeometry';
import type { AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
const fixtures: ReturnType<typeof enrollmentFixture>[] = [];
const owners: { close(): void }[] = [];
afterEach(() => { owners.splice(0).reverse().forEach(o => o.close()); fixtures.splice(0).reverse().forEach(f => f.close()); vi.restoreAllMocks(); });
const centers = { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } };
const occupied = (count: number) => {
  const f = enrollmentFixture(); fixtures.push(f);
  const actor = f.actor as any, source = structuredClone(f.source) as any;
  actor.match.half = 'top'; actor.match.balls = 0; actor.match.strikes = 0; actor.world.tick = 100;
  f.db.exec('CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT)');
  const originalRead = f.personLinks.readLink, runners = new Map<string, AcceptedPlayerIntakeSource>();
  vi.spyOn(f.personLinks, 'readLink').mockImplementation(id => runners.get(id) ?? originalRead(id));
  vi.spyOn(geometry, 'samePaStartingBaseCenters').mockReturnValue(centers);
  for (let i = 0; i < count; i++) {
    const playerId = 'runner-' + (i + 1), base = (['first', 'second', 'third'] as const)[i];
    const person = { ...actor.person, sourceId: 'intake-' + playerId, playerId, personId: 'person-' + playerId, sourceRecordId: 'record-' + playerId };
    runners.set(person.sourceId, person);
    f.db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId,person.careerId,playerId,person.personId,person.rosterRevision,person.acceptedAtDay,json(person));
    const binding = { ...actor.binding, playerId, personId: person.personId, personLinkSourceId: person.sourceId };
    f.db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run(binding.gameId,playerId,JSON.stringify(binding));
    const baseline = { ...f.baselines.values().next().value!, sourceId: 'baseline-' + playerId, playerId, personLinkSourceId: person.sourceId };
    f.baselines.set(baseline.sourceId,baseline); f.workload.initialize(baseline.sourceId);
    source.participantBaselineReferences.push({playerId,baselineSourceId:baseline.sourceId,revision:0,stateHash:hash(readActualRoleWorkloadState(f.db,binding.careerId,playerId))});
    actor.match.bases[base] = playerId;
    actor.world.runners.unshift({playerId,position:centers[base],velocity:{x:0,z:0}});
  }
  source.capability = 'reserved_same_pa_enrollment_v2';
  f.persistActor(); source.actorReference.snapshotHash = hash(actor);
  const owner = openSqliteSamePlateAppearanceEnrollmentStore(f.path,{readAcceptedEnrollment: () => source}); owners.push(owner);
  return {...f,source,actor,owner};
};
it.each([1,2,3])('occupied enrollment reserves the exact %i original runner bodies and baselines', count => {
  const f = occupied(count), saved = f.owner.accept(f.source.sourceId);
  expect(saved.kind).toBe('reserved');
  if (saved.kind !== 'reserved') throw new Error('unexpected missing baseline');
  expect(saved.participants.map(p => p.binding.playerId)).toEqual([...f.players,...Array.from({length:count},(_,i)=>'runner-'+(i+1))].sort());
  expect(f.db.prepare('SELECT count(*) AS n FROM same_pa_participant_reservations').get()!.n).toBe(10+count);
  expect(f.owner.read(f.source.sourceId)).toEqual(saved);
  expect(f.owner.accept(f.source.sourceId)).toEqual(saved);
});
it.each(['omitted','wrong_base','moving','wrong_person','wrong_side','wrong_club','wrong_day','wrong_fixture','national','duplicate_person','v1'] as const)('occupied original %s rejects with no partial reservation', fault => {
  const f = occupied(2);
  if (fault === 'omitted') f.actor.world.runners.pop();
  if (fault === 'wrong_base') f.actor.world.runners[0].position = centers.first;
  if (fault === 'moving') f.actor.world.runners[0].velocity.x = 1;
  if (fault === 'duplicate_person') { f.actor.defenderBindings[0].personId=f.actor.binding.personId; f.actor.defenderPersons[0].personId=f.actor.binding.personId; }
  if (fault === 'v1') f.source.capability = 'reserved_same_pa_enrollment_v1';
  if (['wrong_person','wrong_side','wrong_club','wrong_day','wrong_fixture','national'].includes(fault)) {
    const row = f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='runner-1'").get()!;
    const binding = JSON.parse(String(row.binding_json));
    if (fault === 'wrong_person') binding.personId = 'wrong';
    if (fault === 'wrong_side') binding.side = 'HOME';
    if (fault === 'wrong_club') binding.clubId = 'foreign';
    if (fault === 'wrong_day') binding.gameDay++;
    if (fault === 'wrong_fixture') binding.fixtureEventId = 'foreign';
    if (fault === 'national') binding.nationalRegistrationEventId = 'foreign';
    f.db.prepare("UPDATE official_participant_bindings SET binding_json=? WHERE player_id='runner-1'").run(JSON.stringify(binding));
  }
  f.persistActor(); f.source.actorReference.snapshotHash = hash(f.actor);
  expect(() => f.owner.accept(f.source.sourceId)).toThrow();
  expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'same_pa_%'").all()).toEqual([]);
});

import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearanceHistoricalViewReader } from './SqliteSamePlateAppearanceHistoricalViewReader';
import { samePaViewInput } from './SamePlateAppearanceExecutionView';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
it('original participant order follows base identity independently of World runner array order', () => {
  const f = occupied(3);
  expect(readSamePaOriginalParticipants(f.db,f.actor).map(p => [p.binding.playerId,p.role,p.startingBase])).toEqual([
    ['away-2','batter',null],...f.players.slice(1).map(p => [p,'defender',null]),['runner-1','runner',1],['runner-2','runner',2],['runner-3','runner',3],
  ]);
});
it('occupied TOTAL sets require exact enrollment members and reject partial set repair', () => {
  const f = occupied(1), enrollment = f.owner.accept(f.source.sourceId);
  if (enrollment.kind !== 'reserved') throw new Error('unexpected missing baseline');
  const accepted = new Map<string,unknown>(), execution = openSqliteSamePlateAppearanceExecutionStore(f.path,{
    readAcceptedPrefix:id=>accepted.get(id),readAcceptedTotal:id=>accepted.get(id),readAcceptedView:id=>accepted.get(id),
  }); owners.push(execution);
  const prefixSource = {sourceId:'occupied-prefix',sourceVersion:'fixture-v1',capability:'reserved_same_pa_empty_prefix_v1',enrollmentReference:reference('same_pa_enrollments',enrollment)};
  accepted.set(prefixSource.sourceId,prefixSource); const prefix = execution.acceptPrefix(prefixSource.sourceId);
  if (prefix.kind !== 'empty_prefix') throw new Error('unexpected pending prefix');
  const totals = prefix.lineage.participantReferences.map(p=>({sourceId:'occupied-total-'+p.playerId,sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_total_v1',
    enrollmentReference:prefixSource.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',prefix),participantReference:p,effortUnits:0,
    provenance:{assessmentSourceId:'occupied-assessment-'+p.playerId,assessmentVersion:'fixture-v1',calibrationSourceId:'explicit-zero-declaration',calibrationVersion:'fixture-v1'}}));
  totals.forEach(s=>accepted.set(s.sourceId,s));
  expect(()=>execution.acceptTotalSet(totals.slice(0,10).map(s=>s.sourceId))).toThrow(/membership|coverage|participant/);
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n).toBe(0);
  const set = execution.acceptTotalSet(totals.map(s=>s.sourceId));
  expect(set.kind).toBe('total_set'); if (set.kind !== 'total_set') throw new Error('unexpected pending TOTAL');
  expect(set.totals).toHaveLength(11);
  const viewSource = {sourceId:'occupied-view',sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:prefixSource.enrollmentReference,
    prefixReference:reference('reserved_pa_work_prefixes',prefix),participantTotalReferences:set.participantTotalReferences};
  expect(samePaViewInput(viewSource).participantTotalReferences).toHaveLength(11);
  accepted.set(viewSource.sourceId,{...viewSource,participantTotalReferences:set.participantTotalReferences.slice(0,10)});
  expect(()=>execution.acceptView(viewSource.sourceId)).toThrow();
  accepted.set(viewSource.sourceId,viewSource); const view = execution.acceptView(viewSource.sourceId);
  expect(view.kind).toBe('basis_prepared'); if(view.kind !== 'basis_prepared') throw new Error('unexpected pending view');
  expect(view.participants.map(p=>p.playerId)).toEqual(enrollment.participants.map(p=>p.binding.playerId));
  const history = openSqliteSamePlateAppearanceHistoricalViewReader(f.path); owners.push(history);
  expect(history.read(reference('reserved_pa_execution_views',view)).view).toEqual(view);
  f.db.prepare('DELETE FROM reserved_pa_total_assessments WHERE source_id=?').run(totals.at(-1)!.sourceId);
  expect(()=>execution.acceptTotalSet(totals.map(s=>s.sourceId))).toThrow();
  expect(f.db.prepare('SELECT count(*) AS n FROM reserved_pa_total_assessments').get()!.n).toBe(10);
});

import { samePaOutcomeRetirement } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
it('retirement retains every original occupied participant without inventing runner commands', () => {
  const f = occupied(3), originals = readSamePaOriginalParticipants(f.db,f.actor);
  const basis = {actor:f.actor,view:{cut:{physicalPitchReference:{owner:'test',sourceId:'pitch'},physicalOperationReference:{owner:'test',sourceId:'operation'}},coverageHash:hash('coverage')}} as any;
  const retired = samePaOutcomeRetirement(basis,[],123,originals);
  expect(retired.participants).toEqual(originals.map(p=>({playerId:p.binding.playerId,personId:p.binding.personId,ownedCommands:[]})));
  expect(() => samePaOutcomeRetirement(basis,[],123)).toThrow(/runner membership/);
});
