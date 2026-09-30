import { cloneInert } from '../../adjudication/OfficialWindowPolicy';

export const NATIONAL_ELIGIBILITY_BASES = ['CITIZENSHIP', 'BIRTH', 'ANCESTRY', 'RESIDENCE'] as const;
export type NationalEligibilityBasis = typeof NATIONAL_ELIGIBILITY_BASES[number];
export type NationalEligibilityPolicy = Readonly<{
  version: string;
  acceptedBases: readonly NationalEligibilityBasis[];
  allowNationSwitch: boolean;
  seniorOfficialAppearanceLocksNation: boolean;
}>;
export type NationalEligibilityFact = Readonly<{
  evidenceId: string; playerId: string; personId: string; nationId: string;
  basis: NationalEligibilityBasis; effectiveFromDay: number;
}>;
export type NationalRepresentation = Readonly<{
  editionId: string; nationId: string; registeredAtDay: number;
  seniorOfficialAppearanceDay: number | null; evidenceId: string;
}>;
export type NationalEligibilityInput = Readonly<{
  playerId: string; personId: string; editionId: string; nationId: string;
  asOfDay: number; policy: NationalEligibilityPolicy;
  facts: readonly NationalEligibilityFact[];
  representation: readonly NationalRepresentation[];
}>;
export type NationalEligibilityDecision = Readonly<{
  eligible: boolean;
  reason: 'NO_ELIGIBILITY_BASIS' | 'EDITION_ALREADY_REPRESENTED' | 'NATION_SWITCH_FORBIDDEN' | 'SENIOR_NATION_LOCKED' | null;
  policyVersion: string;
  evidenceIds: readonly string[];
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const keys = (value: object, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');

/** Exact legal/content criteria are supplied by a versioned World policy, never Match ability. */
export const snapshotNationalEligibilityPolicy = (raw: NationalEligibilityPolicy): NationalEligibilityPolicy => {
  const policy = cloneInert(raw);
  if (!policy || !keys(policy, ['version', 'acceptedBases', 'allowNationSwitch', 'seniorOfficialAppearanceLocksNation'])
    || !id(policy.version) || !Array.isArray(policy.acceptedBases) || policy.acceptedBases.length === 0
    || new Set(policy.acceptedBases).size !== policy.acceptedBases.length
    || policy.acceptedBases.some((basis) => !NATIONAL_ELIGIBILITY_BASES.includes(basis))
    || typeof policy.allowNationSwitch !== 'boolean' || typeof policy.seniorOfficialAppearanceLocksNation !== 'boolean') {
    throw new Error('invalid national eligibility policy');
  }
  return Object.freeze({ ...policy, acceptedBases: Object.freeze([...policy.acceptedBases]) });
};

/** Evaluate only dated legal facts and accepted representative history; affiliation is unrelated. */
export const snapshotNationalEligibilityFact = (raw: NationalEligibilityFact): NationalEligibilityFact => {
  const fact = cloneInert(raw);
  if (!fact || !keys(fact, ['evidenceId', 'playerId', 'personId', 'nationId', 'basis', 'effectiveFromDay'])
    || ![fact.evidenceId, fact.playerId, fact.personId, fact.nationId].every(id) || !day(fact.effectiveFromDay)
    || !NATIONAL_ELIGIBILITY_BASES.includes(fact.basis)) throw new Error('invalid national eligibility evidence');
  return Object.freeze(fact);
};

/** The supplied history must already be backed by accepted World representation sources. */
export const evaluateNationalEligibility = (raw: NationalEligibilityInput): NationalEligibilityDecision => {
  const input = cloneInert(raw);
  if (!input || !keys(input, ['playerId', 'personId', 'editionId', 'nationId', 'asOfDay', 'policy', 'facts', 'representation'])
    || ![input.playerId, input.personId, input.editionId, input.nationId].every(id)
    || !day(input.asOfDay) || !Array.isArray(input.facts) || !Array.isArray(input.representation)) {
    throw new Error('invalid national eligibility scope');
  }
  const policy = snapshotNationalEligibilityPolicy(input.policy);
  const evidence = new Set<string>();
  for (const rawFact of input.facts) {
    const fact = snapshotNationalEligibilityFact(rawFact);
    if (evidence.has(fact.evidenceId)) throw new Error('invalid national eligibility evidence');
    if (fact.playerId !== input.playerId || fact.personId !== input.personId) throw new Error('national eligibility identity differs');
    evidence.add(fact.evidenceId);
  }
  const editions = new Set<string>();
  for (const entry of input.representation) {
    if (!entry || !keys(entry, ['editionId', 'nationId', 'registeredAtDay', 'seniorOfficialAppearanceDay', 'evidenceId'])
      || ![entry.editionId, entry.nationId, entry.evidenceId].every(id) || !day(entry.registeredAtDay)
      || (entry.seniorOfficialAppearanceDay !== null && (!day(entry.seniorOfficialAppearanceDay)
        || entry.seniorOfficialAppearanceDay < entry.registeredAtDay))
      || editions.has(entry.editionId) || evidence.has(entry.evidenceId)) {
      throw new Error('invalid national representation history');
    }
    editions.add(entry.editionId); evidence.add(entry.evidenceId);
  }
  const facts = input.facts.filter((fact) => fact.effectiveFromDay <= input.asOfDay && fact.nationId === input.nationId
    && policy.acceptedBases.includes(fact.basis));
  const history = input.representation.filter((entry) => entry.registeredAtDay <= input.asOfDay);
  let reason: NationalEligibilityDecision['reason'] = null;
  if (history.some((entry) => entry.editionId === input.editionId && entry.nationId !== input.nationId)) {
    reason = 'EDITION_ALREADY_REPRESENTED';
  } else if (policy.seniorOfficialAppearanceLocksNation && history.some((entry) => entry.nationId !== input.nationId
    && entry.seniorOfficialAppearanceDay !== null && entry.seniorOfficialAppearanceDay <= input.asOfDay)) {
    reason = 'SENIOR_NATION_LOCKED';
  } else if (!policy.allowNationSwitch && history.some((entry) => entry.nationId !== input.nationId)) {
    reason = 'NATION_SWITCH_FORBIDDEN';
  } else if (!facts.length) reason = 'NO_ELIGIBILITY_BASIS';
  return Object.freeze({ eligible: reason === null, reason, policyVersion: policy.version,
    evidenceIds: Object.freeze([...facts.map((fact) => fact.evidenceId), ...history.map((entry) => entry.evidenceId)].sort()) });
};
