import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { RuleProfileId } from '../model/RuleProfileRef';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import type { BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import { deriveBallWorldFieldTerritory, type BallWorldFieldTerritory, type BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import { resolvePitchCountRule, type PitchCountState } from './PitchCountRule';
import { resolveFoulBallRule } from './FoulBallRule';
import { getRuleProfile, NPB_2026_RULE_PROFILE } from './RuleProfile';

export type BallWorldSettledFoulDeadEvidenceInput = Readonly<{
  field: BallWorldFieldTerritoryInput;
  count: PitchCountState;
  policy: Readonly<{ version: 'untouched_settled_foul_dead_v1'; ruleProfileId: RuleProfileId; rulesRevision: string }>;
}>;

export type BallWorldSettledFoulDeadEvidence = Readonly<{
  version: 'settled_foul_dead_evidence_v1';
  territory: BallWorldFieldTerritory;
  physicalContacts: readonly BallWorldBattedRuleContactFrame[];
  interpretation: Readonly<{ kind: 'dead_ball'; reason: 'untouched_settled_foul'; moment: BallWorldMoment }>
    | Readonly<{ kind: 'unresolved'; reason: string }>;
  countEffect: Readonly<{ kind: 'unresolved'; reason: 'bunt_intent_pending' }> | null;
}>;

const fields = (value: unknown, names: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const exactMomentShape = (moment: BallWorldMoment) => fields(moment, ['originTick', 'elapsedSeconds', 'ball'])
  && fields(moment.ball, ['tick', 'position', 'velocity', 'spin'])
  && (['position', 'velocity', 'spin'] as const).every(key => fields(moment.ball[key], ['x', 'y', 'z']));
const sameMoment = (first: BallWorldMoment, second: BallWorldMoment) => first.originTick === second.originTick
  && first.elapsedSeconds === second.elapsedSeconds && first.ball.tick === second.ball.tick
  && (['position', 'velocity', 'spin'] as const).every(key => (['x', 'y', 'z'] as const)
    .every(axis => first.ball[key][axis] === second.ball[key][axis]));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Interpret only an untouched actual foul stop. Native owns policy and physical provenance;
 * this evidence neither changes the World nor selects bunt/count or official consequences. */
export const deriveBallWorldSettledFoulDeadEvidence = (
  raw: BallWorldSettledFoulDeadEvidenceInput,
): BallWorldSettledFoulDeadEvidence => {
  const input = cloneInert(raw);
  if (!fields(input, ['field', 'count', 'policy']) || !fields(input.policy, ['version', 'ruleProfileId', 'rulesRevision'])
    || !fields(input.count, ['balls', 'strikes']) || input.policy.version !== 'untouched_settled_foul_dead_v1') {
    throw new Error('invalid settled-foul evidence policy or scope');
  }
  const profile = getRuleProfile(input.policy.ruleProfileId);
  if (profile.id !== NPB_2026_RULE_PROFILE.id || input.policy.rulesRevision !== profile.rulesRevision) {
    throw new Error('unsupported settled-foul evidence RuleProfile revision');
  }
  // Validate the original count through the existing no-transition count rule.
  // Its result is not adopted as a physical event or published interpretation.
  resolvePitchCountRule(input.count, { kind: 'ball_in_play' });
  const territory = deriveBallWorldFieldTerritory(input.field), evidence = input.field.evidence;
  const moments = [evidence.horizon, ...evidence.contacts.map(frame => frame.moment),
    ...input.field.baseContacts.map(contact => contact.moment),
    ...evidence.acquisitions.flatMap(acquisition => [acquisition.contactMoment,
      acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment])];
  if (moments.some(moment => !exactMomentShape(moment))) throw new Error('settled-foul physical moment metadata differs');
  const result = (interpretation: BallWorldSettledFoulDeadEvidence['interpretation']): BallWorldSettledFoulDeadEvidence => freeze({
    version: 'settled_foul_dead_evidence_v1', territory, physicalContacts: evidence.contacts, interpretation,
    countEffect: interpretation.kind === 'dead_ball' ? { kind: 'unresolved', reason: 'bunt_intent_pending' } : null,
  });
  if (territory.kind === 'unresolved') return result({ kind: 'unresolved', reason: territory.reason });
  if (territory.territory !== 'foul') return result({ kind: 'unresolved', reason: 'fair_territory_outside_policy' });
  if (territory.basis !== 'settling') return result({ kind: 'unresolved', reason: 'settling_evidence_pending' });
  const stop = territory.moment, throughStop = evidence.contacts.filter(frame => frame.moment.elapsedSeconds <= stop.elapsedSeconds);
  const decisive = throughStop.at(-1);
  if (!decisive || !sameMoment(decisive.moment, stop) || decisive.contacts.length !== 1 || decisive.contacts[0].kind !== 'rolling_stop') {
    return result({ kind: 'unresolved', reason: 'stop_contact_pending' });
  }
  if (!throughStop.some(frame => frame.moment.elapsedSeconds < stop.elapsedSeconds && frame.contacts.some(contact => contact.kind === 'ground'))) {
    return result({ kind: 'unresolved', reason: 'ground_contact_pending' });
  }
  if (throughStop.some(frame => frame.contacts.length !== 1 || !['ground', 'rolling_stop'].includes(frame.contacts[0].kind))
    || input.field.baseContacts.some(contact => contact.moment.elapsedSeconds <= stop.elapsedSeconds)
    || evidence.acquisitions.some(acquisition => acquisition.contactMoment.elapsedSeconds <= stop.elapsedSeconds)) {
    return result({ kind: 'unresolved', reason: 'untouched_history_required' });
  }
  // Both intent alternatives are evaluated, but neither is selected as an owned
  // bunt fact. Publish only their shared dead-ball conclusion; count stays pending.
  const alternatives = [false, true].map(buntAttempt => resolveFoulBallRule({ territory: 'foul',
    buntAttempt, count: input.count, flyCatch: null }));
  if (!alternatives.every(alternative => alternative.kind === 'uncaught_foul' && alternative.ballDead)) {
    return result({ kind: 'unresolved', reason: 'foul_rule_conclusion_pending' });
  }
  return result({ kind: 'dead_ball', reason: 'untouched_settled_foul', moment: stop });
};
