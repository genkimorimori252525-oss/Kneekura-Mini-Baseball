import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { classifyBallAgainstFairTerritory } from '../sim/ball/FairTerritoryGeometry';
import { deriveBallWorldBattedRuleEvidence, type BallWorldBattedRuleEvidenceInput } from './BallWorldBattedRuleEvidence';
import { resolveUntouchedGroundContactBeyondBases } from './FairFoulGroundRule';

/** Preserve legacy archived evidence while retaining actual moments independently of recorded tick quantization. */
export const deriveBallWorldBattedRuleChronology = (raw: BallWorldBattedRuleEvidenceInput) => {
  const input = cloneInert(raw), ballEvidence = deriveBallWorldBattedRuleEvidence(input);
  const ground = input.contacts.find((frame) => frame.contacts.some((contact) => contact.kind === 'ground'));
  const touched = input.contacts.find((frame) => frame.contacts.some((contact) => contact.kind === 'actor' && input.defenderIds.includes(contact.playerId)));
  let ballDecisionMoment: BallWorldMoment | null = null;
  if (ballEvidence.kind === 'fly_catch') {
    const secured = input.acquisitions.filter((value) => value.kind === 'secured').sort((a, b) => a.moment.elapsedSeconds - b.moment.elapsedSeconds)[0];
    if (!secured) throw new Error('actual batted catch chronology is missing');
    ballDecisionMoment = secured.moment;
  } else if (ballEvidence.kind === 'grounded') {
    if (!ground) throw new Error('actual batted ground chronology is missing');
    if (!touched || ground.moment.elapsedSeconds < touched.moment.elapsedSeconds) {
      const rule = resolveUntouchedGroundContactBeyondBases({ field: input.field, bases: input.bases, noPriorFielderTouch: true,
        firstGroundContact: { tick: ground.moment.ball.tick, position: { x: ground.moment.ball.position.x, z: ground.moment.ball.position.z },
          classification: classifyBallAgainstFairTerritory(input.field, ground.moment.ball.position, input.ballRadiusMeters) } });
      if (rule.kind === 'resolved') ballDecisionMoment = ground.moment;
    }
    ballDecisionMoment ??= touched?.moment ?? null;
    if (!ballDecisionMoment || ballDecisionMoment.ball.tick !== ballEvidence.decisiveTick) throw new Error('actual batted territory chronology differs');
  }
  return { ballEvidence, ballDecisionMoment, firstGroundMoment: ground?.moment ?? null };
};
