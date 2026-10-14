import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {battedContactResponseEvidenceFromSqlite,type DurableBattedContactResponse} from './SqliteBattedContactResponseStore';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import type { AcceptedBattedWorldFieldAction, DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
import type { AcceptedActualLivePlayRuntime } from './ActualLivePlayRuntime';
import type { AcceptedOriginalSettledFoulRuntime } from './ActualSettledFoulStopProducer';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy } from './SqliteBattedVenueLegalPolicyStore';

type OriginalFieldRoot=ReturnType<typeof battedWorldFieldFixture>;
export type SettledFoulAttachmentContext=Pick<OriginalFieldRoot['f'],'db'|'track'|'close'|'official'>;
export type SettledFoulAttachmentIds=Readonly<{runtimeSourceId:string;policySourceId:string;fieldSourceIds:readonly string[]}>;
const legacyFoulAttachmentIds: SettledFoulAttachmentIds={runtimeSourceId:'foul-runtime',policySourceId:'registered-foul-policy',fieldSourceIds:Array.from({length:32},(_,i)=>`registered-foul-field-${i+2}`)};
type SettledFoulRoot=Readonly<{f:SettledFoulAttachmentContext;physical:OriginalFieldRoot['physical'];fields:OriginalFieldRoot['fields'];source:AcceptedBattedWorldFieldAction;sources:Map<string,AcceptedBattedWorldFieldAction>}>;
/** Attach normal runtime/policy/field owners to an accepted current response/binding before the first field action.
 * The caller owns lifecycle and the explicit Source authority; no initial World
 * or participant selection is created by this seam. */
export const attachOriginalSettledFoulRuntime=(path:string,context:SettledFoulAttachmentContext,
 root:Readonly<{fields:OriginalFieldRoot['fields'];response:DurableBattedContactResponse}>,
 accepted:Readonly<{source:AcceptedBattedWorldFieldAction;sources:Map<string,AcceptedBattedWorldFieldAction>;ids:SettledFoulAttachmentIds}>)=>{
 if(root.response.source.sourceId!==accepted.source.responseSourceId||json(accepted.sources.get(accepted.source.sourceId))!==json(accepted.source))throw new Error('foul attachment requires its independently accepted field Source');
 const response=withSqliteReadTransaction(context.db,()=>battedContactResponseEvidenceFromSqlite(context.db).read(root.response.source.sourceId));
 if(!response||json(response)!==json(root.response))throw new Error('foul attachment response owner differs');
 const physical=response.touch.worldContact.flight.physicalPitch;
 return attachSettledFoulOwners(path,{f:context,physical,fields:root.fields,source:accepted.source,sources:accepted.sources},accepted.ids);
};
const attachSettledFoulOwners=<T extends SettledFoulRoot>(path:string,x:T,rawIds:SettledFoulAttachmentIds)=>{
 const ids=cloneInert(rawIds);
 if(ids.fieldSourceIds.length!==32||new Set([x.source.sourceId,ids.runtimeSourceId,ids.policySourceId,...ids.fieldSourceIds]).size!==35||[ids.runtimeSourceId,ids.policySourceId,...ids.fieldSourceIds].some(id=>typeof id!=='string'||!id.length||id.trim()!==id))throw new Error('foul attachment explicit Source identities differ');
  try {
  const pitch = x.physical, runtimeSources = new Map<string, AcceptedActualLivePlayRuntime | AcceptedOriginalSettledFoulRuntime>();
  const runtimes = x.f.track(openSqliteActualLivePlayRuntimeStore(path, {
    readAcceptedRuntime: id => (runtimeSources.get(id) ?? null) as never,
  }));
  const source = (capability: AcceptedActualLivePlayRuntime['capability'] | AcceptedOriginalSettledFoulRuntime['capability']) => ({
    sourceId: ids.runtimeSourceId, sourceVersion: 'explicit-test-v1', capability, physicalPitchSourceId: pitch.source.sourceId,
  });
  const register = (capability: AcceptedActualLivePlayRuntime['capability'] | AcceptedOriginalSettledFoulRuntime['capability']) => {
    const accepted = source(capability); runtimeSources.set(accepted.sourceId, accepted); return runtimes.accept(accepted.sourceId);
  };
  const inputArchiveBytes = () => nativeSettledFoulInputArchiveBytes(x.f.db);
  const beforePhysicalBytes = inputArchiveBytes(), originalMatchBytes = JSON.stringify(x.f.official.getMatch(pitch.frame.gameId));
  const advanceToFoul = () => {
    const fields: DurableBattedWorldFieldAction[] = [x.fields.accept(x.source.sourceId)];
    const first = fields[0], horizonTick = first.field.motion.world.moment.ball.tick + 100_000_000;
    for (let step = 0; step < 32; step++) {
      const previous = fields.at(-1)!, world = previous.field.motion.world;
      if (world.kind === 'boundary' && world.contacts.length === 1 && world.contacts[0].kind === 'rolling_stop') break;
      if (world.kind !== 'boundary' || world.contacts.length !== 1 || world.contacts[0].kind !== 'ground') {
        throw new Error('registered original fixture encountered unsupported contact before its actual stop');
      }
      const next = { ...x.source, sourceId: ids.fieldSourceIds[step],
        previousFieldSourceId: previous.source.sourceId, throughTick: horizonTick };
      x.sources.set(next.sourceId, next); fields.push(x.fields.accept(next.sourceId));
    }
    const last = fields.at(-1)!, accepted=last;
    // These are the actual newly returned owner values. The end producer does
    // its own fresh authentication; a duplicate test-level replay adds none.
    const prefix = { baseField: accepted, fields, executions: [] };
    const physical = battedWorldFieldPhysicalPrefix(prefix), territory = deriveBallWorldFieldTerritory(physical.field);
    if (territory.kind !== 'resolved' || territory.territory !== 'foul' || territory.basis !== 'settling'
      || last.field.motion.world.kind !== 'boundary' || last.field.motion.world.contacts.length !== 1
      || last.field.motion.world.contacts[0].kind !== 'rolling_stop') throw new Error('registered original fixture did not derive the actual foul stop');
    if (inputArchiveBytes() !== beforePhysicalBytes) throw new Error('registered original fixture changed accepted input bytes');
    return { first, last: accepted, prefix, physical, fields };
  };
  const acceptPolicy = (first: DurableBattedWorldFieldAction) => {
    const world = first.response.touch.worldContact;
    const policySource: AcceptedBattedVenueLegalPolicy = { sourceId: ids.policySourceId, sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
      gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId, venueId: world.model.venueId,
      availableAtDay: world.model.availableAtDay, baseFieldSourceId: first.source.sourceId, worldModelSourceId: world.model.sourceId,
      responseModelSourceId: first.response.model.sourceId, fieldGeometrySourceId: first.geometry.source.sourceId,
      baseGeometrySourceId: first.geometry.baseGeometry.source.sourceId,
      rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
    const policies = x.f.track(openSqliteBattedVenueLegalPolicyStore(path, { readAcceptedPolicy: id => id === policySource.sourceId ? policySource : null }));
    return { policySource, policies, policy: policies.accept(policySource.sourceId) };
  };
  return { ...x, runtimeSources, runtimes, runtimeSource: source, register, advanceToFoul, acceptPolicy,
    inputArchiveBytes, beforePhysicalBytes, originalMatchBytes };
  } catch (error) { x.f.close(); throw error; }
};

/** Original zero-horizon roots only. Runtime registration happens explicitly in the test. */
export const originalSettledFoulRuntimeFixture = (path: string,
  original?: Pick<NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>, 'pitchPhysics' | 'originalContact'>) => {
  const x = battedWorldFieldFixture(path, true, false, undefined, {
    originalProfile: { ruleProfileId: NPB_2026_RULE_PROFILE.id },
    pitchPhysics: original?.pitchPhysics ?? { velocity: { x: 1, y: 0, z: -30 } }, originalContact: original?.originalContact,
  });
  return attachSettledFoulOwners(path,x,legacyFoulAttachmentIds);
};

import type { AcceptedActualSettledFoulStopProduction, ActualSettledFoulStopCensusQuery } from './ActualSettledFoulStopProducer';
import { openSqliteActualSettledFoulStopProducerStore } from './SqliteActualSettledFoulStopProducerStore';
export const actualSettledFoulStopProducerFixture = (path: string, legacy = false) => {
  const x = originalSettledFoulRuntimeFixture(path);
  try {
    const runtime = x.register(legacy ? 'causal_original_live_play_runtime_v1' : 'causal_original_settled_foul_runtime_v1');
    const foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
    const production: AcceptedActualSettledFoulStopProduction = { sourceId: 'foul-production', sourceVersion: 'explicit-test-v1',
      capability: 'actual_original_settled_foul_stop_producer_v1', physicalPitchSourceId: x.physical.source.sourceId,
      runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policySource.sourceId,
      baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
    const productions = new Map<string, AcceptedActualSettledFoulStopProduction>([[production.sourceId, production]]);
    const store = x.f.track(openSqliteActualSettledFoulStopProducerStore(path, {
      readAcceptedProduction: id => productions.get(id) ?? null,
    }));
    const query: ActualSettledFoulStopCensusQuery = { version: 'actual_settled_foul_stop_census_v1',
      runtimeSourceId: runtime.source.sourceId, cut: { kind: 'field_execution', baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null } };
    return { ...x, ...foul, ...policy, originalPhysicalPitch: x.physical, runtime, production, productions, store, query };
  } catch (error) { x.f.close(); throw error; }
};
