import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BattingExecutionCalculation } from '../../core/world/psychology/batting/BattingCommitment';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { DurableSamePaBattingExecutionInput } from './NativeBattingExecutionInput';
import type { AcceptedOriginalBattingIntent } from './OriginalBattingIntent';

/** An explicit use declaration for an already accepted course profile. This is
 * neither a new motion model nor a profile selector. The original intent must
 * already exist before launch; the current physical owner authenticates every
 * reference and the exact effective profile before adopting any motion. */
export type SamePaBuntProfileBinding = Readonly<{
  kind: 'accepted_bunt_course_profile_v1';
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  member: SamePaDispatchMember;
  modelReference: SamePaReference<'world_player_batting_models'>;
  calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
  repertoireId: string; repertoireVersion: string;
  profileId: string; profileVersion: string; profileHash: string;
}>;

export const samePaBuntProfileBindingInput = (raw: unknown): SamePaBuntProfileBinding => {
  const b = cloneInert(raw) as SamePaBuntProfileBinding;
  if (!fields(b, ['kind', 'intentReference', 'viewReference', 'member', 'modelReference', 'calibrationReference',
    'repertoireId', 'repertoireVersion', 'profileId', 'profileVersion', 'profileHash'])
    || b.kind !== 'accepted_bunt_course_profile_v1' || !ref(b.intentReference, 'batting_execution_v1_intents')
    || !ref(b.viewReference, 'pa_lifecycle_v1_execution_views') || !samePaDispatchMemberValid(b.member)
    || !ref(b.modelReference, 'world_player_batting_models') || !ref(b.calibrationReference, 'pa_lifecycle_v1_execution_calibrations')
    || ![b.repertoireId, b.repertoireVersion, b.profileId, b.profileVersion].every(text) || !samePaHash(b.profileHash)) {
    throw new Error('invalid explicit bunt profile binding');
  }
  return freeze(b);
};

/** Only the physical owner calls this after current/historical input proof and
 * Core calculation. Missing declarations stay pending; mismatched declarations
 * cannot silently fall back to the ordinary repertoire or another profile. */
export const samePaBuntProfileAvailable = (binding: SamePaBuntProfileBinding | undefined, basis: Readonly<{
  intentReference: SamePaReference<'batting_execution_v1_intents'>;
  originalIntent: AcceptedOriginalBattingIntent;
  input: DurableSamePaBattingExecutionInput;
  modelReference: SamePaReference<'world_player_batting_models'>;
  calculation: BattingExecutionCalculation;
}>): boolean => {
  const { input, calculation, originalIntent } = basis;
  if (calculation.commitment?.action !== 'SWING' || originalIntent.attempt !== 'bunt') {
    if (binding !== undefined) throw new Error('bunt physical binding requires an actual bunt commitment');
    return true;
  }
  if (binding === undefined) return false;
  const b = samePaBuntProfileBindingInput(binding), s = input.source;
  const same = (a: unknown, expected: unknown) => {
    if (json(a) !== json(expected)) throw new Error('bunt physical binding differs from the owned input or effective profile');
  };
  if (s.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw new Error('bunt physical binding requires in-flight input');
  same(b.intentReference, basis.intentReference); same(b.intentReference, s.intentReference);
  same(b.viewReference, s.viewReference); same(b.member, s.member); same(b.modelReference, basis.modelReference);
  same(b.calibrationReference, s.calibrationReferences.find(c => c.route === 'batter_swing')!.calibrationReference);
  same(calculation.nominalRequest, input.nominalRequest); same(calculation.effectiveValues, input.effectiveValues);
  const repertoire = input.effectiveValues.repertoire, commitment = calculation.commitment;
  same([b.repertoireId, b.repertoireVersion], [repertoire.repertoireId, repertoire.repertoireVersion]);
  same([b.profileId, b.profileVersion], [commitment.profileId, commitment.profileVersion]);
  const profile = repertoire.profiles.find(row => row.profile.profileId === b.profileId && row.profile.version === b.profileVersion)?.profile;
  if (!profile) throw new Error('bunt physical profile is absent from the owned effective repertoire');
  same(b.profileHash, hash(profile));
  return true;
};
