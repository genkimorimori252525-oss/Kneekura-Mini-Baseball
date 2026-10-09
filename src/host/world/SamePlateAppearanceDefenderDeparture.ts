import type { LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import type { BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { samplePiecewiseFieldActor, validatePiecewiseFieldActors } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { classifyPointAgainstFairTerritory, classifyBallAgainstFairTerritory } from '../../core/sim/ball/FairTerritoryGeometry';
import type { ActualObservationMoment } from './ActualFieldObservation';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { battedVenueLegalCoveragePolicyInput, type SamePaDefenseExit } from './BattedVenueLegalCoveragePolicy';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { getRuleProfile } from '../../core/rules/RuleProfile';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Pair = Extract<ReturnType<typeof readSamePaFieldRuleEvidenceWithInputsFromSqlite>, { kind: 'same_pa_field_rule_read_pair_v1' }>;
type FieldRef = SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
type StepRef = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaDefenderDeparturePurposeRequest = Readonly<{ kind: 'defender_departure_purpose_v1'; member: SamePaDispatchMember; exitId: string }>;
export type SamePaDefenderDeparturePurpose = Readonly<{ kind: 'defender_departure_purpose_v1'; playerId: string; exitId: string; declaredAt: ActualObservationMoment }>;
const ref = (f: Field): FieldRef => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const at = (f: Field): ActualObservationMoment => { const m = f.field.motion.world.moment; return { originTick: m.originTick, elapsedSeconds: m.elapsedSeconds, tick: m.ball.tick }; };
const same = (a: unknown, b: unknown, detail = 'dependency') => { if (json(a) !== json(b)) throw new Error('defender departure original ' + detail + ' differs'); };
const result = (f: Field) => f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;
const pending = (reason: string) => freeze({ kind: 'pending' as const, reason });
const roles = ['body', 'left_foot', 'right_foot'] as const;
// This original ordinary alignment explicitly distinguishes C from the four
// infield roles. No catcher or outfielder animation is an expiry prerequisite.
const requiredPositions = ['P', '1B', '2B', '3B', 'SS'] as const;
const originalPositions = [...requiredPositions, 'C', 'LF', 'CF', 'RF'];
const playerParts = (root: SamePaPhysicalFieldRoot, f: Field, playerId: string) => {
  validatePiecewiseFieldActors(root.response, f.field.motion.world.moment, f.field.motion.actors);
  const values = f.field.motion.actors.filter(a => a.playerId === playerId && roles.includes(a.primitive.role as typeof roles[number]));
  if (values.length !== roles.length || new Set(values.map(a => a.primitive.role)).size !== roles.length) throw new Error('defender departure original body/feet coverage differs');
  return values;
};
const insideExit = (actors: readonly BallWorldMotionActor[], moment: BallWorldMoment, exit: SamePaDefenseExit) => actors.every(a => {
  const position = samplePiecewiseFieldActor(a, moment).center, radius = a.primitive.radius;
  return (['x', 'y', 'z'] as const).every(axis => position[axis] > exit.minimum[axis] + radius && position[axis] < exit.maximum[axis] - radius);
});
const outsideFair = (root: SamePaPhysicalFieldRoot, actors: readonly BallWorldMotionActor[], moment: BallWorldMoment) => actors.every(a => {
  // Reuse the existing circular-footprint kernel and its conservative edge
  // handling for each original spherical primitive.
  return classifyBallAgainstFairTerritory(root.geometry.baseGeometry.field, samplePiecewiseFieldActor(a, moment).center, a.primitive.radius).kind === 'outside_fair_wedge';
});
/** A strict ray/interior intersection certifies displacement toward the
 * named accepted exit. Its dimensionless parameter is not a future trajectory,
 * chosen target, arrival promise, or elapsed-time calculation. */
const directedTowardExit = (start: ReturnType<typeof samplePiecewiseFieldActor>['center'], end: typeof start, radius: number, exit: SamePaDefenseExit) => {
  let enter = 1, leave = Infinity, moved = false;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = end[axis] - start[axis], low = exit.minimum[axis] + radius, high = exit.maximum[axis] - radius;
    if (!Number.isFinite(delta) || !(low < high)) return false;
    if (delta === 0) { if (!(start[axis] > low && start[axis] < high)) return false; continue; }
    moved = true;
    const first = (low - start[axis]) / delta, second = (high - start[axis]) / delta;
    if (!Number.isFinite(first) || !Number.isFinite(second)) return false;
    enter = Math.max(enter, Math.min(first, second)); leave = Math.min(leave, Math.max(first, second));
  }
  return moved && enter < leave;
};
const departedAt = (root: SamePaPhysicalFieldRoot, declaration: SamePaPhysicalFieldStep, purpose: SamePaDefenderDeparturePurpose, f: Field, exit: SamePaDefenseExit) => {
  if (at(f).elapsedSeconds <= purpose.declaredAt.elapsedSeconds) return false;
  const current = playerParts(root, f, purpose.playerId), initial = playerParts(root, declaration, purpose.playerId);
  // A wholly fair original primitive and later wholly outside body/feet certify
  // a crossing somewhere in this actual continuous prefix. Straddling starts
  // remain unresolved; this is sufficient evidence, not a minimal legal edge.
  const certainlyStartedFair = initial.some(part => {
    const point = classifyPointAgainstFairTerritory(root.geometry.baseGeometry.field, samplePiecewiseFieldActor(part, declaration.field.motion.world.moment).center);
    return point.firstBaseLineSignedSide > part.primitive.radius && point.thirdBaseLineSignedSide > part.primitive.radius;
  });
  const directed = current.every(part => {
    const prior = initial.find(a => a.primitive.role === part.primitive.role)!;
    return directedTowardExit(samplePiecewiseFieldActor(prior, declaration.field.motion.world.moment).center,
      samplePiecewiseFieldActor(part, f.field.motion.world.moment).center, part.primitive.radius, exit);
  });
  return certainlyStartedFair && directed && outsideFair(root, current, f.field.motion.world.moment);
};
const originalPolicy = (root: SamePaPhysicalFieldRoot, actor: DurablePhysicalPlateAppearanceActor) => {
  if (!root.source.venueLegalCoveragePolicy || !root.venueLegalCoveragePolicyBinding) return null;
  const policy = battedVenueLegalCoveragePolicyInput(root.source.venueLegalCoveragePolicy), binding = root.venueLegalCoveragePolicyBinding;
  if (binding.policyHash !== hash(policy) || binding.fixtureHash !== actor.fixtureHash || binding.geometryBindingHash !== root.geometryBindingHash
    || binding.ruleProfileHash !== hash(getRuleProfile(policy.rulePolicy.ruleProfileId)) || policy.geometryBindingHash !== root.geometryBindingHash
    || policy.baseFieldSourceId !== root.source.sourceId || policy.physicalPitchSourceId !== root.physicalPitchSourceId
    || policy.gameId !== actor.source.gameId || policy.careerId !== actor.binding.careerId || policy.playId !== actor.match.playId
    || policy.fixtureEventId !== actor.binding.fixtureEventId || policy.availableAtDay > actor.binding.gameDay
    || policy.rulePolicy.ruleProfileId !== actor.match.ruleProfileId) throw new Error('defender departure original accepted venue binding differs');
  return policy;
};
export const samePaDefenderDeparturePurposeInput = (a: SamePaDefenderDeparturePurposeRequest): void => {
  if (!fields(a, ['kind', 'member', 'exitId']) || a.kind !== 'defender_departure_purpose_v1'
    || !samePaDispatchMemberValid(a.member) || !samePaText(a.exitId)) throw new Error('invalid explicit defender departure purpose');
};
/** This accepted current-cut purpose does not select a motor, create movement,
 * assert a third out, or label already traversed physical history. */
export const deriveSamePaDefenderDeparturePurpose = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, actor: DurablePhysicalPlateAppearanceActor): SamePaDefenderDeparturePurpose => {
  const a = source.action;
  if (a?.kind !== 'defender_departure_purpose_v1') throw new Error('defender departure purpose Source missing');
  samePaDefenderDeparturePurposeInput(a);
  const policy = originalPolicy(root, actor), exit = policy?.defenseExits?.find(e => e.exitId === a.exitId);
  if (!exit) throw new Error('defender departure original exit required');
  const binding = actor.defenderBindings.find(b => b.playerId === a.member.playerId), person = actor.defenderPersons.find(p => p.playerId === a.member.playerId);
  if (!binding || !person || !actor.world.defenders.some(d => d.playerId === a.member.playerId)
    || hash(binding) !== a.member.bindingHash || hash(person) !== a.member.personHash || binding.personId !== person.personId
    || source.throughTick !== previous.evaluationTick || root.physicalPitchSourceId !== previous.physicalPitchSourceId)
    throw new Error('defender departure original current member or cut differs');
  same(source.fieldRootReference, ref(root)); same(source.previousFieldReference, ref(previous));
  if (insideExit(playerParts(root, previous, a.member.playerId), previous.field.motion.world.moment, exit))
    throw new Error('defender departure purpose cannot relabel an already arrived defender');
  return freeze({ kind: a.kind, playerId: a.member.playerId, exitId: a.exitId, declaredAt: at(previous) });
};
type PurposeEntry = { purposeReference: StepRef; purpose: SamePaDefenderDeparturePurpose; status: 'active' | 'superseded' | 'completed';
  supersededBy?: FieldRef; invalidatedBy?: FieldRef; completion?: Readonly<{ fieldReference: FieldRef; at: ActualObservationMoment; basis: 'departure' | 'supersession' }> };
const conflictingPlayers = (f: Field): readonly string[] => {
  if (f.kind !== 'same_pa_physical_field_step_v1') return [];
  const a = f.source.action;
  // A fresh adoption of a ball/hold motor after declaration is conflicting
  // action, even if its decision was older. Retained curves need no new motor.
  if (a?.kind === 'defender_motion_v1') return a.selections.map(s => s.member.playerId);
  return a?.kind === 'defender_decision_v1' || a?.kind === 'defender_catch_response_v1' || a?.kind === 'throw_plan_v1' ? [a.member.playerId] : [];
};
const supersedingPlayers = (f: Field): readonly string[] => {
  if (f.kind !== 'same_pa_physical_field_step_v1') return [];
  const a = f.source.action, r = f.actionResult;
  if (a?.kind === 'defender_motion_v1' || a?.kind === 'throw_plan_v1') return conflictingPlayers(f);
  if (a?.kind === 'defender_catch_response_v1' && r?.kind === a.kind && r.issuedBySourceId === f.source.sourceId
    && r.replan.selectedAt && json(r.replan.selectedAt) === json(at(f))) return [a.member.playerId];
  return [];
};
/* An issued purpose stays in the existing live-work inventory until actual
 * individual departure or genuine supersession, never elapsed time or a missing
 * queue. This inventory does not create an autonomous departure controller. */
export const deriveSamePaDefenderDepartureCensus = (prefix: readonly Field[]) => {
  const root = prefix[0];
  if (root?.kind !== 'same_pa_physical_field_root_v1') throw new Error('defender departure census original root missing');
  const rawPolicy = root.source.venueLegalCoveragePolicy;
  const policy = rawPolicy ? battedVenueLegalCoveragePolicyInput(rawPolicy) : null;
  if (policy && (root.venueLegalCoveragePolicyBinding?.policyHash !== hash(policy)
    || policy.baseFieldSourceId !== root.source.sourceId || policy.geometryBindingHash !== root.geometryBindingHash))
    throw new Error('defender departure census original venue binding differs');
  const purposes: PurposeEntry[] = [], declarations = new Map<string, SamePaPhysicalFieldStep>();
  for (const [index, f] of prefix.entries()) {
    const a = f.kind === 'same_pa_physical_field_step_v1' ? f.source.action : undefined, r = result(f);
    const supersededPlayers = a?.kind === 'defender_departure_purpose_v1' ? [a.member.playerId] : supersedingPlayers(f);
    // An unissued candidate invalidates positive purpose evidence but has not
    // yet consumed the issued work. Keep that obligation until real succession.
    for (const entry of purposes) if (entry.status === 'active' && conflictingPlayers(f).includes(entry.purpose.playerId)) entry.invalidatedBy = ref(f);
    for (const entry of purposes) if (entry.status === 'active' && supersededPlayers.includes(entry.purpose.playerId)) {
      entry.status = 'superseded'; entry.supersededBy = ref(f);
      entry.completion = { fieldReference: ref(f), at: at(f), basis: 'supersession' };
    }
    if (a?.kind === 'defender_departure_purpose_v1' || r?.kind === 'defender_departure_purpose_v1') {
      if (a?.kind !== 'defender_departure_purpose_v1' || r?.kind !== a.kind || f.kind !== 'same_pa_physical_field_step_v1' || !prefix[index - 1])
        throw new Error('defender departure original purpose Source/result differs');
      samePaDefenderDeparturePurposeInput(a);
      same(f.field, prefix[index - 1].field, 'purpose physical state');
      same(r, { kind: a.kind, playerId: a.member.playerId, exitId: a.exitId, declaredAt: at(f) }, 'purpose receipt');
      const exit = policy?.defenseExits?.find(e => e.exitId === r.exitId);
      if (!exit || insideExit(playerParts(root, f, r.playerId), f.field.motion.world.moment, exit))
        throw new Error('defender departure census original exit or unarrived purpose required');
      purposes.push({ purposeReference: ref(f) as StepRef, purpose: r, status: 'active' }); declarations.set(f.source.sourceId, f);
    }
    for (const entry of purposes) if (entry.status === 'active' && !entry.invalidatedBy) {
      const declaration = declarations.get(entry.purposeReference.sourceId)!, exit = policy!.defenseExits!.find(e => e.exitId === entry.purpose.exitId)!;
      if (departedAt(root, declaration, entry.purpose, f, exit)) {
        entry.status = 'completed'; entry.completion = { fieldReference: ref(f), at: at(f), basis: 'departure' };
      }
    }
  }
  const sources: LivePlaySource[] = purposes.map(entry => {
    const sourceId = json(['defender_departure', entry.purposeReference.sourceId]), completion = entry.completion;
    return { sourceId, revision: completion ? 2 : 1, queue: null, physical: [], information: [], decisions: [], ruleWindows: [],
      intents: completion ? [] : [{ workId: sourceId, kind: 'issued_intent', actorId: entry.purpose.playerId,
        dueTick: entry.purpose.declaredAt.tick, actionKey: json(entry.purposeReference) }],
      ...(completion ? { completion: { completedAtTick: completion.at.tick, basisEventId: completion.fieldReference.sourceId } } : {}) };
  });
  return freeze({ purposes, sources });
};
/** Native authenticates this complete pair on its own connection. Actual body and
 * both feet wholly outside fair territory, directed toward a named exit, supply
 * a sufficient closed-by bound. All five ordinary infield roles must satisfy it
 * at the same actual future cut. Bench arrival and exact crossing stay distinct;
 * neither an exit face nor fair-line contact receives new legal semantics. */
export const deriveSamePaDefenderDepartureEvidence = (pair: Pair) => {
  const root = pair.fields[0];
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1' || root?.kind !== 'same_pa_physical_field_root_v1' || !pair.fields.length)
    throw new Error('defender departure original authenticated pair required');
  same(pair.fields.map(ref), pair.value.fieldReferences, 'complete prefix'); same(ref(pair.fields.at(-1)!), pair.value.physicalOperationReference, 'prefix cut');
  same(root.lineage, pair.view.lineage, 'prefix lineage');
  const defenders = pair.actor.world.defenders;
  if (defenders.length !== 9 || new Set(defenders.map(d => d.playerId)).size !== 9 || new Set(defenders.map(d => d.registeredPosition)).size !== 9
    || originalPositions.some(p => !defenders.some(d => d.registeredPosition === p))) throw new Error('defender departure original role census differs');
  const requiredIds = requiredPositions.map(p => defenders.find(d => d.registeredPosition === p)!.playerId);
  const policy = originalPolicy(root, pair.actor);
  if (!policy?.defenseExits) return pending('original_defense_exit_interiors_required');
  const original: Field[] = [], active = new Map<string, { field: SamePaPhysicalFieldStep; purpose: SamePaDefenderDeparturePurpose }>();
  for (const f of pair.fields) {
    const previous = original.at(-1);
    same(f.lineage, root.lineage, 'prefix lineage');
    if (f.physicalPitchSourceId !== root.physicalPitchSourceId) throw new Error('defender departure original physical pitch differs');
    if (previous) {
      if (f.kind !== 'same_pa_physical_field_step_v1' || f.operationOrdinal !== previous.operationOrdinal + 1 || at(f).elapsedSeconds < at(previous).elapsedSeconds)
        throw new Error('defender departure original consecutive prefix differs');
      same(f.source.previousFieldReference, ref(previous), 'prefix predecessor'); same(f.source.previousOperationReference, ref(previous), 'prefix operation');
      same(f.source.fieldRootReference, ref(root), 'prefix root');
    }
    const a = f.kind === 'same_pa_physical_field_step_v1' ? f.source.action : undefined, r = result(f);
    for (const conflict of conflictingPlayers(f)) active.delete(conflict);
    if (a?.kind === 'defender_departure_purpose_v1' || r?.kind === 'defender_departure_purpose_v1') {
      if (!previous || f.kind !== 'same_pa_physical_field_step_v1' || a?.kind !== 'defender_departure_purpose_v1') throw new Error('defender departure original purpose predecessor missing');
      const purpose = deriveSamePaDefenderDeparturePurpose(f.source, root, previous, pair.actor);
      same(purpose, r, 'purpose rederivation'); same(f.field, previous.field, 'purpose physical state'); active.set(purpose.playerId, { field: f, purpose });
    }
    original.push(f);
    if (!requiredIds.every(id => active.has(id))) continue;
    const entries = requiredIds.map(id => active.get(id)!);
    const departed = entries.every(entry => departedAt(root, entry.field, entry.purpose, f, policy.defenseExits!.find(e => e.exitId === entry.purpose.exitId)!));
    if (departed) return freeze({ kind: 'same_pa_defense_departure_bound_v1' as const, closedNoLaterThan: at(f), fieldReference: ref(f),
      purposeReferences: entries.map(e => ref(e.field) as StepRef), exitPolicyHash: hash(policy) });
  }
  return pending('original_defense_departure_history_required');
};
