import {expect,it} from 'vitest';
import {calculateDefensiveExecution,type DefensiveExecutionInput} from './DefensiveExecutionCalculation';
import {playerDecisionCalibrationFixture} from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import {chooseDefensiveIntentCandidate,generateDefensiveIntentCandidates} from '../../core/sim/fielding/DefensiveDecision';
import {resolveDefensiveDecisionTiming} from '../../core/sim/fielding/DefensiveDecisionTiming';
import {resolveDefenderFirstStepTiming} from '../../core/sim/fielding/DefenderFirstStepTiming';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const input:DefensiveExecutionInput={startedAtTick:100,ratings:{situationalAwareness:0.5,firstStep:0.5},decision:{
  self:{playerId:'player-a'},perceivedWorld:{observerId:'player-a',observationTime:100,attention:{target:{kind:'ball'},focusedSinceTick:100},ball:null,players:[],communications:[],knownContext:null},
  prePlayPlan:{ballPursuitPriority:0,baseCoverPriorities:[],relayPriority:0,backupPriority:1,deepCoveragePriority:0,holdPriority:0.2},
  perceivedCues:[{kind:'backup_needed',target:{x:1,z:1},observedAt:100,confidence:0.5}]}};
/** Explicit fixture-only alternatives, not a measured fatigue response or an
 * accepted Native decision. Owner authentication stays outside this Core seam. */
it('CC04 effective decision and motor offsets alter actual scheduling without mutating nominal calibration',()=>{
  const nominal=playerDecisionCalibrationFixture(),before=hash(nominal);
  const effective={...nominal,decisionTimingParameters:{...nominal.decisionTimingParameters,fixedProcessingOffsetTicks:15},firstStepTimingParameters:{...nominal.firstStepTimingParameters,fixedMotorOffsetTicks:12}};
  const a=calculateDefensiveExecution(input,nominal),b=calculateDefensiveExecution(input,effective);
  expect(b.scheduling.decisionTick).toBe(a.scheduling.decisionTick+10);expect(b.scheduling.movementStartTick).toBe(a.scheduling.movementStartTick+20);expect(hash(nominal)).toBe(before);
});
it('CC05 explicit effective cue threshold feeds the existing candidate calculation',()=>{
  const nominal=playerDecisionCalibrationFixture();expect(calculateDefensiveExecution(input,nominal).selected.intent).toEqual({kind:'backup',target:{x:1,z:1}});
  expect(calculateDefensiveExecution(input,{...nominal,minimumCueConfidence:0.9}).selected.intent).toEqual({kind:'hold'});
});
it('CC06 nominal defensive calculation matches the original three Core calls byte for byte',()=>{
  const calibration=playerDecisionCalibrationFixture(),decision=resolveDefensiveDecisionTiming(input.startedAtTick,input.ratings.situationalAwareness,calibration.decisionTimingParameters),motor=resolveDefenderFirstStepTiming(decision.decisionTick,input.ratings.firstStep,calibration.firstStepTimingParameters);
  const expected={selected:chooseDefensiveIntentCandidate(generateDefensiveIntentCandidates({...input.decision,minimumCueConfidence:calibration.minimumCueConfidence,communicationTrust:calibration.communicationTrust})),
    scheduling:{startedAtTick:input.startedAtTick,decisionDelayTicks:decision.decisionDelayTicks,decisionTick:decision.decisionTick,firstStepDelayTicks:motor.firstStepDelayTicks,movementStartTick:motor.movementStartTick}};
  expect(calculateDefensiveExecution(input,calibration)).toEqual(expected);
});
it('CC09 calculated decision ownership never freezes or aliases the original perceived cue target',()=>{
  const original=structuredClone(input),before=hash(original);
  const value=calculateDefensiveExecution(original,playerDecisionCalibrationFixture());
  const cue=original.decision.perceivedCues![0];
  if(!('target' in cue)||value.selected.intent.kind!=='backup')throw new Error('fixture must select backup');
  expect(Object.isFrozen(cue.target)).toBe(false);expect(hash(original)).toBe(before);
  expect(value.selected.intent.target).not.toBe(cue.target);expect(Object.isFrozen(value.selected.intent.target)).toBe(true);
});
