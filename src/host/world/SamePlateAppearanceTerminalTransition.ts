import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { GameCompletionPolicy } from '../../core/world/competition/OfficialGameCompletion';
import type { PersistOfficialPlayInput, PersistOfficialFinalInput, PersistOfficialPlayResult, PersistOfficialFinalResult } from '../SqliteOfficialStateWriter';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import type { SamePaTerminalEndpoint, SamePaTerminalTransitionProof } from './SamePlateAppearanceTerminalEndpoint';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Common = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_terminal_transition_v1';
  terminalReference: SamePaReference<'pa_terminal_v1_endpoints'>; settlementReference: SamePaReference<'pa_settlement_v1_plans'>;
  applicationId: string; scoringApplicationId: string; controllerReset: 'rule_system_retire_original_play';
  game: Readonly<{ seasonId: string; homeClubId: string; awayClubId: string; policy: GameCompletionPolicy }>;
}>;
export type AcceptedSamePaTerminalTransition = Common & (
  Readonly<{ kind: 'continuing'; nextStartedAtTick: number; worldSetup: BetweenPlayWorldSetup }>
  | Readonly<{ kind: 'game_final'; completedAtTick: number }>);
export type SamePaTransitionDefender = Readonly<{ playerId: string; personId: string; bindingHash: string; workloadRevision: number; workloadHash: string }>;
export type SamePaTerminalTransitionRecord = Readonly<{
  kind: 'same_pa_terminal_transition_v1'; source: AcceptedSamePaTerminalTransition; lineage: SamePaTerminalEndpoint['lineage'];
  officialApplication: PersistOfficialPlayInput | PersistOfficialFinalInput; official: PersistOfficialPlayResult | PersistOfficialFinalResult;
  scoring: PersistedOfficialScoring; completion: SamePaTerminalTransitionProof['completion'];
  controllerRetirement: Readonly<{ kind: 'rule_system_retire_original_play'; atTick: number; previousPlayId: number;
    basis: SamePaTerminalEndpoint['controllerRetirementBasis'] }>;
  incomingDefenders: readonly SamePaTransitionDefender[];
  earlierHistory: readonly Readonly<{ applicationId: string; scoringApplicationId: string; closureRowHash: string; scoringRowHash: string }>[];
}>;
const tick = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
export const samePaTerminalTransitionInput = (raw: unknown, id?: string): AcceptedSamePaTerminalTransition => {
  const s = cloneInert(raw) as AcceptedSamePaTerminalTransition;
  if (!s || !['continuing', 'game_final'].includes(s.kind)
    || !fields(s, ['sourceId', 'sourceVersion', 'capability', 'terminalReference', 'settlementReference', 'applicationId', 'scoringApplicationId', 'controllerReset', 'game', 'kind',
      ...(s.kind === 'continuing' ? ['nextStartedAtTick', 'worldSetup'] : ['completedAtTick'])])
    || ![s.sourceId, s.sourceVersion, s.applicationId, s.scoringApplicationId].every(text) || id !== undefined && s.sourceId !== id
    || s.capability !== 'same_pa_terminal_transition_v1' || s.controllerReset !== 'rule_system_retire_original_play'
    || !ref(s.terminalReference, 'pa_terminal_v1_endpoints') || !ref(s.settlementReference, 'pa_settlement_v1_plans')
    || !fields(s.game, ['seasonId', 'homeClubId', 'awayClubId', 'policy']) || ![s.game.seasonId, s.game.homeClubId, s.game.awayClubId].every(text)
    || !fields(s.game.policy, ['version', 'minimumInnings', 'tiesAllowed', ...(Object.hasOwn(s.game.policy, 'maximumInnings') ? ['maximumInnings'] : [])])
    || !text(s.game.policy.version) || s.game.homeClubId === s.game.awayClubId
    || !Number.isSafeInteger(s.game.policy.minimumInnings) || s.game.policy.minimumInnings < 1 || typeof s.game.policy.tiesAllowed !== 'boolean'
    || s.game.policy.maximumInnings !== undefined && (!Number.isSafeInteger(s.game.policy.maximumInnings) || s.game.policy.maximumInnings < s.game.policy.minimumInnings || !s.game.policy.tiesAllowed))
    throw new Error('invalid same-PA terminal transition Source');
  if (s.kind === 'game_final') { if (!tick(s.completedAtTick)) throw new Error('invalid same-PA final completion tick'); }
  else if (!tick(s.nextStartedAtTick) || !fields(s.worldSetup, ['baseCenters', 'defenders', 'activePreviousPlayControllerIds'])
    || !fields(s.worldSetup.baseCenters, ['first', 'second', 'third'])
    || Object.values(s.worldSetup.baseCenters).some(p => !fields(p, ['x', 'z']) || !Number.isFinite(p.x) || !Number.isFinite(p.z))
    || !Array.isArray(s.worldSetup.defenders) || s.worldSetup.defenders.length !== 9
    || s.worldSetup.defenders.some(d => !fields(d, ['playerId', 'registeredPosition', 'position']) || !text(d.playerId)
      || !fields(d.position, ['x', 'z']) || !Number.isFinite(d.position.x) || !Number.isFinite(d.position.z))
    || !Array.isArray(s.worldSetup.activePreviousPlayControllerIds) || s.worldSetup.activePreviousPlayControllerIds.length)
    throw new Error('invalid same-PA continuing setup Source');
  return freeze(s);
};
