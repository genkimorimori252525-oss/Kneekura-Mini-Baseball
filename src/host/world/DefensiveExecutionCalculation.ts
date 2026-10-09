import { resolveDefensiveDecisionTiming } from '../../core/sim/fielding/DefensiveDecisionTiming';
import { resolveDefenderFirstStepTiming } from '../../core/sim/fielding/DefenderFirstStepTiming';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { chooseDefensiveIntentCandidate,generateDefensiveIntentCandidates,type DefensiveIdentityDecisionInput,type DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import { createPlayerDecisionCalibration,type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
export type DefensiveExecutionInput=Readonly<{decision:Omit<DefensiveIdentityDecisionInput,'minimumCueConfidence'|'communicationTrust'>;
  startedAtTick:number;ratings:Readonly<{situationalAwareness:number;firstStep:number}>}>;
export type DefensiveExecutionCalculation=Readonly<{selected:DefensiveIntentCandidate;scheduling:Readonly<{
  startedAtTick:number;decisionDelayTicks:number;decisionTick:number;firstStepDelayTicks:number;movementStartTick:number}>}>;
/** Pure Core composition. Native callers supply separately authenticated
 * perceived inputs, original ratings and independent effective calibration. */
export const calculateDefensiveExecution=(input:DefensiveExecutionInput,rawCalibration:PlayerDecisionCalibration):DefensiveExecutionCalculation=>{
  const calibration=createPlayerDecisionCalibration(rawCalibration);
  const selected=chooseDefensiveIntentCandidate(generateDefensiveIntentCandidates({...input.decision,minimumCueConfidence:calibration.minimumCueConfidence,communicationTrust:calibration.communicationTrust}));
  const decision=resolveDefensiveDecisionTiming(input.startedAtTick,input.ratings.situationalAwareness,calibration.decisionTimingParameters);
  const motor=resolveDefenderFirstStepTiming(decision.decisionTick,input.ratings.firstStep,calibration.firstStepTimingParameters);
  return freeze(structuredClone({selected,scheduling:{startedAtTick:input.startedAtTick,decisionDelayTicks:decision.decisionDelayTicks,decisionTick:decision.decisionTick,
    firstStepDelayTicks:motor.firstStepDelayTicks,movementStartTick:motor.movementStartTick}}));
};
