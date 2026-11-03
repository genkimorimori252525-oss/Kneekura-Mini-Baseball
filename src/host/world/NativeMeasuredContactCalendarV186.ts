import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { worldCalendarDateAtDay, worldCalendarDayFromDate } from '../../core/world/competition/WorldCalendarDate';
import { readNativeMeasuredBattingContactCollectionV185FromSqlite, type NativeMeasuredContactCollectionRequestV185,
  type NativeMeasuredBattingContactCollectionV185, type NativeMeasuredContactReferenceV185 } from './NativeMeasuredBattingContactCollectionV185';
import { nationalBinding, assertNationalMatchBindings, type DurableNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { actorFreeze as freeze, actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaText } from './SamePlateAppearanceWorkPrefix';
import { readDomesticCalendarOriginFromSqlite, type DurableDomesticCalendarOrigin } from './SqliteDomesticScheduleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite, type NationalCompetitionSelection } from './SqliteNationalCompetitionSelectionStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';

export type NativeMeasuredContactCalendarRequestV186 = Readonly<{
  contacts: NativeMeasuredContactCollectionRequestV185;
  careerCalendarEditionId?: string;
}>;
type DomesticCalendarScope = Readonly<{ kind: 'DOMESTIC'; seasonId: string; seasonDay: number; gameId: string; fixtureEventId: string;
  careerDayOne: string | null; careerCalendarSelection: NationalCompetitionSelection | null }>;
export type NativeContactCalendarBindingV186 = DomesticCalendarScope & (Readonly<{
  status: 'UNAVAILABLE'; reason: 'NO_DOMESTIC_CALENDAR_ORIGIN'; calendarDateISO: null; calendarYear: null; origin: null;
  careerDay: null; careerDayReason: 'NO_DOMESTIC_CALENDAR_ORIGIN';
}> | Readonly<{
  status: 'RESOLVED_DATE'; calendarDateISO: string; calendarYear: number; origin: DurableDomesticCalendarOrigin;
  careerDay: number | null; careerDayReason: 'NO_EXPLICIT_CAREER_CALENDAR_SELECTION' | null;
}>) | Readonly<{
  kind: 'NATIONAL'; status: 'RESOLVED_DATE'; editionId: string; gameId: string; fixtureEventId: string;
  calendarDateISO: string; calendarYear: number; careerDay: number; careerDayOne: string; careerDayReason: null;
  nationalOrigin: DurableNationalMatchOrigin; selection: NationalCompetitionSelection;
}>;
export type NativeMeasuredContactCalendarV186 = Readonly<{
  boundary: 'NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY'; collection: NativeMeasuredBattingContactCollectionV185;
  calendars: readonly Readonly<{ reference: NativeMeasuredContactReferenceV185; calendar: NativeContactCalendarBindingV186 }>[];
  chronology: 'UNRESOLVED'; classification: null;
}>;

/** Normal owners authenticate the subject, original references, calendars and
 * National lineage on this one snapshot. Dates do not order same-day contacts,
 * resolve cross-owner identity, or create a TraitTime/recognition observation. */
export const readNativeMeasuredContactCalendarV186FromSqlite = (
  db: DatabaseSync, raw: NativeMeasuredContactCalendarRequestV186,
): NativeMeasuredContactCalendarV186 => {
  const input = cloneInert(raw), hasCareerSelection = !!input && Object.hasOwn(input, 'careerCalendarEditionId');
  if (!samePaFields(input, ['contacts', ...(hasCareerSelection ? ['careerCalendarEditionId'] : [])])
    || hasCareerSelection && !samePaText(input.careerCalendarEditionId)) throw new Error('invalid measured contact calendar request');
  return withBattedVenueLegalReadSnapshot(db, () => {
    // Subject/ref validation and the original request records belong to V185.
    const collection = readNativeMeasuredBattingContactCollectionV185FromSqlite(db, input.contacts), careerId = collection.scope.careerId;
    let selections: ReturnType<typeof nationalCompetitionSelectionEvidenceFromSqlite> | undefined, careerDayOne: string | null = null;
    const selected = new Map<string, NationalCompetitionSelection>();
    const readSelection = (editionId: string): NationalCompetitionSelection => {
      const cached = selected.get(editionId); if (cached) return cached;
      selections ??= nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle: worldCompetitionCycleEvidenceFromSqlite(db) });
      const selection = selections.readSelection(careerId, editionId);
      if (!selection || selection.editionId !== editionId) throw new Error('formal career calendar selection is missing or differs');
      if (careerDayOne !== null && careerDayOne !== selection.careerDayOne) throw new Error('formal career calendar origins differ');
      careerDayOne = selection.careerDayOne; selected.set(editionId, selection); return selection;
    };
    const explicitSelection = input.careerCalendarEditionId === undefined ? null : readSelection(input.careerCalendarEditionId);
    const resolve = (binding: OfficialParticipantBinding): NativeContactCalendarBindingV186 => {
      if (nationalBinding(binding)) {
        const nationalOrigin = assertNationalMatchBindings(db, [binding]);
        if (!nationalOrigin || nationalOrigin.source.careerId !== binding.careerId || nationalOrigin.source.editionId !== binding.competitionEditionId
          || nationalOrigin.source.gameId !== binding.gameId || nationalOrigin.fixture.careerId !== binding.careerId
          || nationalOrigin.fixture.competitionEditionId !== binding.competitionEditionId || nationalOrigin.fixture.gameDay !== binding.gameDay
          || nationalOrigin.fixture.fixtureEventId !== binding.fixtureEventId) throw new Error('original National calendar scope differs');
        const selection = readSelection(binding.competitionEditionId);
        if (actorHash(selection) !== nationalOrigin.fixture.selectionHash) throw new Error('original National calendar selection hash differs');
        const calendarDateISO = worldCalendarDateAtDay(selection.careerDayOne, binding.gameDay);
        return { kind: 'NATIONAL', status: 'RESOLVED_DATE', editionId: binding.competitionEditionId,
          gameId: binding.gameId, fixtureEventId: binding.fixtureEventId, calendarDateISO, calendarYear: Number(calendarDateISO.slice(0, 4)),
          careerDay: binding.gameDay, careerDayOne: selection.careerDayOne, careerDayReason: null, nationalOrigin, selection };
      }
      const origin = readDomesticCalendarOriginFromSqlite(db, careerId, binding.competitionEditionId), scope: DomesticCalendarScope = {
        kind: 'DOMESTIC', seasonId: binding.competitionEditionId, seasonDay: binding.gameDay, gameId: binding.gameId, fixtureEventId: binding.fixtureEventId,
        careerDayOne: explicitSelection?.careerDayOne ?? null, careerCalendarSelection: explicitSelection };
      if (!origin) return { ...scope, status: 'UNAVAILABLE', reason: 'NO_DOMESTIC_CALENDAR_ORIGIN', calendarDateISO: null,
        calendarYear: null, origin: null, careerDay: null, careerDayReason: 'NO_DOMESTIC_CALENDAR_ORIGIN' };
      const calendarDateISO = worldCalendarDateAtDay(origin.source.seasonDayOne, binding.gameDay);
      return { ...scope, status: 'RESOLVED_DATE', calendarDateISO, calendarYear: Number(calendarDateISO.slice(0, 4)), origin,
        careerDay: explicitSelection ? worldCalendarDayFromDate(explicitSelection.careerDayOne, calendarDateISO) : null,
        careerDayReason: explicitSelection ? null : 'NO_EXPLICIT_CAREER_CALENDAR_SELECTION' };
    };
    const calendars = collection.contacts.map(item => ({ reference: cloneInert(item.reference), calendar: cloneInert(resolve(item.evidence.actor.binding)) }));
    // Detach each already-owned record separately, retaining the owners' inert
    // record budget without adding a collection-wide raw-evidence size limit.
    const detachedCollection: NativeMeasuredBattingContactCollectionV185 = { ...collection, scope: cloneInert(collection.scope),
      contacts: collection.contacts.map(item => ({ reference: cloneInert(item.reference), evidence: cloneInert(item.evidence), measurement: cloneInert(item.measurement) })),
      requests: collection.requests.map(item => cloneInert(item)) };
    return freeze({ boundary: 'NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY' as const, collection: detachedCollection, calendars,
      chronology: 'UNRESOLVED' as const, classification: null });
  });
};
