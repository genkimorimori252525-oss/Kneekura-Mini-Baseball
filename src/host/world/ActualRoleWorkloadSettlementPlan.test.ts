import { expect, it } from 'vitest';
import { createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { prepareActualRoleWorkloadSettlement } from './ActualRoleWorkloadSettlementPlan';
const state = (playerId: string) => createPlayerWorkloadRecovery({ careerId: 'career', playerId, createdAtDay: 1, fatigue: 0.2, recoveryCapacity: 0.5,
  policy: { policyId: 'fixture', version: '1', availableAtDay: 0, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0, recoveryPerHour: 0.1 } });
const actors = ['pitcher','catcher','runner'].map(playerId => ({ playerId, personId: `person-${playerId}`, clubId: 'club' }));
const assessment = (playerId: string, effortUnits: number) => ({ assessmentSourceId: `effort-${playerId}`, playerId,
  activity: { sourceEventId: `activity-${playerId}`, sourceVersion: 'v1', evidenceId: 'end', careerId: 'career', playerId, atDay: 2, kind: 'MATCH' as const, effortUnits } });
it('waits for every original participant assessment and baseline, treating explicit accepted zero distinctly', () => {
  const pending = prepareActualRoleWorkloadSettlement(actors, [assessment('pitcher',0)], [state('pitcher')]);
  expect(pending).toEqual({ kind:'pending', missingAssessments:['catcher','runner'], missingBaselines:['catcher','runner'] });
});
it('freezes exact settlement-time BEFORE/policy and derives AFTER for all roles without elapsed-time recovery', () => {
  const plan = prepareActualRoleWorkloadSettlement(actors, actors.map(p=>assessment(p.playerId,p.playerId==='pitcher'?0:2)), actors.map(p=>state(p.playerId)));
  expect(plan.kind).toBe('frozen'); if(plan.kind!=='frozen') throw new Error('missing');
  expect(plan.capturedAt).toBe('settlement_freeze'); expect(plan.participants.map(p=>p.after.fatigue)).toEqual([0.2,0.4,0.4]);
  expect(plan.participants.every(p=>p.before.revision===0 && p.after.revision===1)).toBe(true);
  expect(Object.isFrozen(plan.participants[0].before.policy)).toBe(true);
});
it('refuses duplicate actors/assessments, replacement identities and a later-day baseline rather than recapturing or backdating', () => {
  expect(()=>prepareActualRoleWorkloadSettlement([...actors,actors[0]],[],[])).toThrow();
  expect(()=>prepareActualRoleWorkloadSettlement(actors,[assessment('pitcher',0),assessment('pitcher',0)],[])).toThrow();
  expect(()=>prepareActualRoleWorkloadSettlement(actors,[assessment('outsider',0)],[])).toThrow();
  expect(()=>prepareActualRoleWorkloadSettlement(actors,actors.map(p=>assessment(p.playerId,1)),actors.map(p=>({...state(p.playerId),effectiveDay:3})))).toThrow();
});
