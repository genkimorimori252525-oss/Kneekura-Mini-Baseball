import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldBattedRuleEvidenceInput } from './BallWorldBattedRuleEvidence';
import { deriveBallWorldBattedRuleChronology } from './BallWorldBattedRuleChronology';
import { resolveBallWorldFirstBaseRace, type BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';

/** Correct-rule interpretation over owned closed histories; later legal questions do not erase a completed earlier race. */
export const deriveBallWorldGroundFirstBaseRace = (raw: Readonly<{ ball: BallWorldBattedRuleEvidenceInput; race: BallWorldFirstBaseRaceInput }>) => {
  const input = cloneInert(raw), ball = input.ball, race = input.race;
  if (!ball || !race || ball.originTick !== race.originTick || ball.ticksPerSecond !== race.ticksPerSecond
    || ball.horizon.elapsedSeconds !== race.horizonElapsedSeconds || ball.batterRunnerId !== race.batterRunnerId
    || JSON.stringify([...ball.defenderIds].sort()) !== JSON.stringify([...race.defenderIds].sort())) throw new Error('actual ground first-base original scope differs');
  const chronology = deriveBallWorldBattedRuleChronology(ball), actualRace = resolveBallWorldFirstBaseRace(race);
  let groundRule: ReturnType<typeof resolveBallWorldFirstBaseRace> | null = null;
  if (chronology.ballEvidence.kind === 'grounded' && chronology.ballEvidence.territory === 'fair'
    && chronology.ballDecisionMoment && chronology.firstGroundMoment) {
    const decisionSeconds = Math.max(chronology.ballDecisionMoment.elapsedSeconds, chronology.firstGroundMoment.elapsedSeconds,
      actualRace.actualChronology.decisionMoment?.elapsedSeconds ?? ball.horizon.elapsedSeconds);
    if (!chronology.ballEvidence.pendingContacts.some((contact) => contact.elapsedSeconds <= decisionSeconds)) groundRule = actualRace;
  }
  return { ...chronology, groundRule };
};
