import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  frozenScoutingCopy, rejectUnknownScoutingFields,
  type ClubScoutingKnowledge, type PlayerKnowledgeReport,
  type ScoutingEvidenceRecord } from './ScoutingKnowledge';

export type ScoutPersonalNetworkEntry = Readonly<{
  regionId: string;
  sourceEventId: string;
  lastActiveDay: number;
}>;
export type ScoutExperienceEntry = Readonly<{
  regionId: string;
  sourceEventId: string;
  occurredAtDay: number;
}>;
export type ScoutPersonState = Readonly<{
  personId: string;
  careerId: string;
  careerState: 'ACTIVE' | 'RETIRED';
  employmentClubId: string | null;
  personalNetwork: readonly ScoutPersonalNetworkEntry[];
  experience: readonly ScoutExperienceEntry[];
}>;
export type ScoutingDepartmentState = Readonly<{
  clubId: string;
  scoutIds: readonly string[];
  knowledge: ClubScoutingKnowledge;
}>;
export type ScoutStaffState = Readonly<{
  careerId: string;
  revision: number;
  effectiveDay: number;
  scouts: readonly ScoutPersonState[];
  departments: readonly ScoutingDepartmentState[];
}>;

const id = (value: string): boolean =>
  typeof value === 'string' && value.length > 0;
const day = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const unique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const validatePerson = (person: ScoutPersonState, careerId: string): void => {
  rejectUnknownScoutingFields(person, ['personId', 'careerId', 'careerState',
    'employmentClubId', 'personalNetwork', 'experience'], 'scout person');
  if (!id(person.personId) || person.careerId !== careerId
    || person.careerState !== 'ACTIVE' || person.employmentClubId !== null
    || !Array.isArray(person.personalNetwork)
    || !Array.isArray(person.experience)) {
    throw new Error('invalid free scout person');
  }
  for (const entry of person.personalNetwork) {
    rejectUnknownScoutingFields(entry, ['regionId', 'sourceEventId',
      'lastActiveDay'], 'scout personal network');
    if (!id(entry.regionId) || !id(entry.sourceEventId)
      || !day(entry.lastActiveDay)) {
      throw new Error('invalid scout personal network source');
    }
  }
  for (const entry of person.experience) {
    rejectUnknownScoutingFields(entry, ['regionId', 'sourceEventId',
      'occurredAtDay'], 'scout experience');
    if (!id(entry.regionId) || !id(entry.sourceEventId)
      || !day(entry.occurredAtDay)) {
      throw new Error('invalid scout experience source');
    }
  }
};

const validateTransition = (
  state: ScoutStaffState, expectedRevision: number, atDay: number,
): void => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale scout staff revision');
  }
  if (!day(atDay) || atDay < state.effectiveDay) {
    throw new Error('backdated scout staff transition');
  }
};

const personAt = (state: ScoutStaffState, personId: string): ScoutPersonState => {
  const person = state.scouts.find((item) => item.personId === personId);
  if (!person) throw new Error('unknown scout person');
  return person;
};

const departmentAt = (state: ScoutStaffState, clubId: string,
): ScoutingDepartmentState => {
  const department = state.departments.find((item) => item.clubId === clubId);
  if (!department) throw new Error('unknown scouting department');
  return department;
};

const transition = (
  state: ScoutStaffState, person: ScoutPersonState,
  destinationClubId: string | null, careerState: 'ACTIVE' | 'RETIRED',
  atDay: number,
): ScoutStaffState => Object.freeze({
  careerId: state.careerId,
  revision: state.revision + 1,
  effectiveDay: atDay,
  scouts: Object.freeze(state.scouts.map((item) => item.personId === person.personId
    ? Object.freeze({ ...item, employmentClubId: destinationClubId,
      careerState }) : item)),
  departments: Object.freeze(state.departments.map((department) => {
    if (department.clubId !== person.employmentClubId
      && department.clubId !== destinationClubId) return department;
    return Object.freeze({ ...department,
      scoutIds: Object.freeze([
        ...department.scoutIds.filter((id) => id !== person.personId),
        ...(department.clubId === destinationClubId ? [person.personId] : []),
      ]) });
  })),
});

export const createScoutStaffState = (
  careerId: string, scouts: readonly ScoutPersonState[],
  knowledge: readonly ClubScoutingKnowledge[],
): ScoutStaffState => {
  if (!id(careerId) || !Array.isArray(scouts)
    || !Array.isArray(knowledge) || knowledge.length === 0) {
    throw new Error('invalid scout staff state source');
  }
  const people = frozenScoutingCopy(scouts);
  const clubKnowledge = frozenScoutingCopy(knowledge);
  people.forEach((person) => validatePerson(person, careerId));
  if (!unique(people.map((person) => person.personId))
    || !unique(clubKnowledge.map((club) => club.clubId))
    || clubKnowledge.some((club) => club.careerId !== careerId
      || !id(club.clubId))) {
    throw new Error('duplicate or mismatched scout staff identity');
  }
  const effectiveDay = Math.max(0,
    ...clubKnowledge.map((club) => club.effectiveDay),
    ...people.flatMap((person) => [
      ...person.personalNetwork.map((entry: ScoutPersonalNetworkEntry) => entry.lastActiveDay),
      ...person.experience.map((entry: ScoutExperienceEntry) => entry.occurredAtDay),
    ]));
  return Object.freeze({ careerId, revision: 0, effectiveDay,
    scouts: people,
    departments: Object.freeze(clubKnowledge.map((club) => Object.freeze({
      clubId: club.clubId, scoutIds: Object.freeze([]), knowledge: club,
    }))) });
};

export const hireScout = (
  state: ScoutStaffState, expectedRevision: number, personId: string,
  clubId: string, day: number,
): ScoutStaffState => {
  validateTransition(state, expectedRevision, day);
  const person = personAt(state, personId);
  departmentAt(state, clubId);
  if (person.careerState === 'RETIRED') throw new Error('retired scout cannot be hired');
  if (person.employmentClubId !== null) throw new Error('scout is already employed');
  return transition(state, person, clubId, 'ACTIVE', day);
};

export const transferScout = (
  state: ScoutStaffState, expectedRevision: number, personId: string,
  clubId: string, day: number,
): ScoutStaffState => {
  validateTransition(state, expectedRevision, day);
  const person = personAt(state, personId);
  departmentAt(state, clubId);
  if (person.employmentClubId === null) throw new Error('scout is not employed');
  if (person.employmentClubId === clubId) {
    throw new Error('scout transfer needs a different club');
  }
  return transition(state, person, clubId, 'ACTIVE', day);
};

export const releaseScout = (
  state: ScoutStaffState, expectedRevision: number, personId: string,
  day: number,
): ScoutStaffState => {
  validateTransition(state, expectedRevision, day);
  const person = personAt(state, personId);
  if (person.employmentClubId === null) throw new Error('scout is not employed');
  return transition(state, person, null, 'ACTIVE', day);
};

export const retireScout = (
  state: ScoutStaffState, expectedRevision: number, personId: string,
  day: number,
): ScoutStaffState => {
  validateTransition(state, expectedRevision, day);
  const person = personAt(state, personId);
  if (person.careerState === 'RETIRED') throw new Error('scout is already retired');
  return transition(state, person, null, 'RETIRED', day);
};

export const appendDepartmentScoutingEvidence = (
  state: ScoutStaffState, expectedRevision: number, clubId: string,
  evidence: ScoutingEvidenceRecord,
): ScoutStaffState => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale scout staff revision');
  }
  const department = departmentAt(state, clubId);
  const knowledge = appendScoutingEvidence(department.knowledge,
    department.knowledge.revision, evidence);
  if (knowledge.effectiveDay < state.effectiveDay) {
    throw new Error('backdated scouting evidence for department');
  }
  return replaceDepartmentKnowledge(state, clubId, knowledge);
};

export const appendDepartmentKnowledgeReport = (
  state: ScoutStaffState, expectedRevision: number, clubId: string,
  report: PlayerKnowledgeReport,
): ScoutStaffState => {
  if (expectedRevision !== state.revision) {
    throw new Error('stale scout staff revision');
  }
  const department = departmentAt(state, clubId);
  const knowledge = appendPlayerKnowledgeReport(department.knowledge,
    department.knowledge.revision, report);
  if (knowledge.effectiveDay < state.effectiveDay) {
    throw new Error('backdated scouting report for department');
  }
  return replaceDepartmentKnowledge(state, clubId, knowledge);
};

const replaceDepartmentKnowledge = (
  state: ScoutStaffState, clubId: string, knowledge: ClubScoutingKnowledge,
): ScoutStaffState => Object.freeze({ ...state, revision: state.revision + 1,
  effectiveDay: knowledge.effectiveDay,
  departments: Object.freeze(state.departments.map((department) =>
    department.clubId === clubId
      ? Object.freeze({ ...department, knowledge }) : department)) });
