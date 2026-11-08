import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaDefensiveActorSelectionResultV1 } from './SamePlateAppearanceDefensiveCandidateSourceV1';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Selection = Extract<SamePaPhysicalFieldAction, { kind: 'defender_motion_v1' }>['selections'][number];
const result = (field: Field) => field.kind === 'same_pa_physical_field_step_v1' ? field.actionResult : undefined;
const actionKind = (field: Field) => field.kind === 'same_pa_physical_field_step_v1' ? field.source.action?.kind : undefined;
const ref = (field: Field) => reference(field.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', field);
function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error('original team motor selection: ' + reason);
}

/** A seam over an ALREADY owner-authenticated prefix, not an authority reader.
 * A team assignment is indivisible. Its motor may start only after metadata
 * siblings and event-free free-ball progress retaining every owned body curve.
 * Legacy individual/catch selections remain on their original path. */
export const originalTeamMotorSelectionsV1 = (prefix: readonly Field[], selections: readonly Selection[],
  defenderIds: readonly string[]): readonly SamePaDefensiveActorSelectionResultV1[] | null => {
  const linked = (original: Selection['decisionReference']) => prefix.find(field => json(ref(field)) === json(original));
  const fields = selections.map(selection => linked(selection.decisionReference));
  if (!fields.some(field => field && result(field)?.kind === 'defender_actor_selection_v1')) return null;
  const team = [...prefix].reverse().find(field => result(field)?.kind === 'defender_team_selection_v1'), plan = team && result(team);
  assert(team && actionKind(team) === 'defender_team_selection_v1' && plan?.kind === 'defender_team_selection_v1', 'latest owned team is missing');
  const ids = selections.map(selection => selection.member.playerId), sorted = (values: readonly string[]) => json([...values].sort());
  assert(selections.length === 9 && new Set(ids).size === 9 && defenderIds.length === 9 && new Set(defenderIds).size === 9
    && sorted(ids) === sorted(defenderIds) && sorted(plan.plan.assignments.map(assignment => assignment.playerId)) === sorted(defenderIds), 'requires the complete original nine-member team');
  const chosen = fields.map((field, index) => {
    const value = field && result(field), playerId = selections[index].member.playerId;
    assert(field && actionKind(field) === 'defender_actor_selection_v1' && value?.kind === 'defender_actor_selection_v1'
      && value.playerId === playerId && json(value.teamSelectionReference) === json(ref(team)), 'mixed or foreign actor selection');
    const latest = (kind: string) => [...prefix].reverse().find(row => { const r = result(row); return r?.kind === kind && 'playerId' in r && r.playerId === playerId; });
    assert(field === latest('defender_actor_selection_v1'), 'actor selection is stale');
    const decision = latest('defender_decision_v1'), observation = latest('defender_observation_v1'), caught = latest('defender_catch_response_v1');
    assert(decision && observation && json(ref(decision)) === json(value.originalDecisionReference)
      && json(ref(observation)) === json(value.observationReference), 'perception or decision superseded the assignment');
    assert(!caught || prefix.indexOf(caught) < prefix.indexOf(decision), 'received catch response superseded the assignment');
    return value;
  });
  const first = Math.min(...fields.map(field => prefix.indexOf(field!))), start = prefix[first].field.motion;
  let elapsed = start.world.moment.elapsedSeconds;
  for (const field of prefix.slice(first)) {
    const value = result(field), motion = field.field.motion;
    assert(motion.carrierPlayerId === null && motion.world.moment.originTick === start.world.moment.originTick
      && motion.world.moment.elapsedSeconds >= elapsed && json(motion.actors) === json(start.actors), 'body ownership, custody or clock changed');
    elapsed = motion.world.moment.elapsedSeconds;
    if (actionKind(field) === 'defender_actor_selection_v1') {
      assert(value?.kind === 'defender_actor_selection_v1' && json(value.teamSelectionReference) === json(ref(team))
        && json(motion.world) === json(start.world), 'foreign team metadata or changed assignment cut');
    } else assert(field.kind === 'same_pa_physical_field_step_v1' && !field.source.action && !value
      && (motion.world.kind === 'moving' || motion.world.kind === 'resting'), 'assignment crossed new work or a physical boundary');
  }
  return chosen;
};
