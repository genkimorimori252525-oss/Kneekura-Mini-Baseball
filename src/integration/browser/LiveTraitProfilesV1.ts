import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';

/** Local authoring, not a Native TraitState, learned-mastery proof or Match
 * multiplier. The retained source is written into the existing execution
 * control once. A display tier never adds another effect to that control. */
export type LiveTraitProfileV1 = Readonly<{
  version: 'live_trait_profile_v1';
  selections: readonly Readonly<{ familyId: string; stateId: string | null;
    source: Readonly<{ badBallControl: number }> }>[];
}>;
export type LiveTraitRosterInputV1 = Omit<LivePhysicalRosterInputV1, 'entries'> & Readonly<{
  entries: readonly (LivePhysicalRosterInputV1['entries'][number] & Readonly<{ traitProfile?: LiveTraitProfileV1 }>)[];
}>;
type TraitColor = 'blue' | 'red' | 'green' | 'gold' | 'neutral';
export type LiveTraitDefinitionV1 = Readonly<{
  familyId: string; label: string; lifecycleClass: string; sourceRoute: 'SOURCE_EXECUTION' | 'PREFERENCE';
  states: readonly Readonly<{ stateId: string; label: string; color: TraitColor }>[];
  sourcePaths: readonly string[]; effectOwner: string; sourceDefinition: string;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const catalog: readonly LiveTraitDefinitionV1[] = freeze([{
  familyId: 'bad_ball_hitting', label: '悪球打ち', lifecycleClass: 'LEARNED_MASTERY_PERSISTENT', sourceRoute: 'SOURCE_EXECUTION',
  states: [{ stateId: 'LEARNED', label: '悪球打ち', color: 'blue' }],
  sourcePaths: ['physical.badBallControl', 'workbenchPlayer.traits.badBallControl'],
  effectOwner: 'LivePitchV1 awkward execution error / BattingWorkbench execution error',
  sourceDefinition: 'canonical09 §5.2.1 / 2026-10-14 USER-DIRECTED REFINEMENT; no chase or result-probability bonus',
}]);
export const getLiveTraitCatalogV1 = (): readonly LiveTraitDefinitionV1[] => catalog;
const assert = (value: unknown, message: string): void => { if (!value) throw new Error('live trait profiles: ' + message); };
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value && value.length <= 160;
const object = (value: unknown, fields: readonly string[], path: string): Record<string, unknown> => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid ' + path);
  const record = value as Record<string, unknown>;
  assert(Object.keys(record).length === fields.length && fields.every(key => Object.hasOwn(record, key)), 'invalid fields ' + path);
  return record;
};
const control = (value: unknown): number => {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'invalid bad-ball technique source');
  return value as number;
};
const readProfile = (raw: unknown): LiveTraitProfileV1 => {
  const profile = object(cloneInert(raw), ['version', 'selections'], 'profile');
  assert(profile.version === 'live_trait_profile_v1' && Array.isArray(profile.selections), 'unsupported profile');
  const seen = new Set<string>();
  const selections = (profile.selections as unknown[]).map(rawSelection => {
    const selection = object(rawSelection, ['familyId', 'stateId', 'source'], 'selection'),
      definition = catalog.find(item => item.familyId === selection.familyId);
    assert(definition && !seen.has(definition.familyId), 'unknown or duplicate trait family');
    seen.add(definition!.familyId);
    assert(selection.stateId === null || definition!.states.some(state => state.stateId === selection.stateId), 'unsupported family state');
    const source = object(selection.source, ['badBallControl'], 'source');
    return { familyId: definition!.familyId, stateId: selection.stateId as string | null,
      source: { badBallControl: control(source.badBallControl) } };
  });
  return { version: 'live_trait_profile_v1', selections };
};
/** The host supplies its final merged physical source, after any workbench
 * projection. Labels cannot contradict the numerical owner that will execute. */
export function validateLiveTraitProfileV1(raw: unknown, physical: Readonly<{ badBallControl?: number }>): LiveTraitProfileV1 {
  const profile = readProfile(raw), source = cloneInert(physical);
  for (const selection of profile.selections) {
    const expected = selection.stateId === null ? 0 : selection.source.badBallControl;
    assert(source.badBallControl === expected, 'trait profile contradicts the executed bad-ball source');
  }
  return freeze(profile);
}
type Entry = LiveTraitRosterInputV1['entries'][number];
function sourceOf(entry: Entry) {
  assert(!(entry.physical && entry.workbenchPlayer), 'ambiguous physical and workbench sources');
  const value = entry.physical ? entry.physical.badBallControl : entry.workbenchPlayer?.traits.badBallControl;
  return { value: value === undefined ? null : control(value), path: entry.workbenchPlayer
    ? 'workbenchPlayer.traits.badBallControl' : 'physical.badBallControl' };
}
function context(raw: LiveTraitRosterInputV1, playerId: string) {
  const roster = cloneInert(raw);
  assert(roster.version === 'live_physical_roster_v1' && text(roster.sourceId) && Array.isArray(roster.entries), 'invalid roster');
  const ids = new Set<string>();
  for (const entry of roster.entries) {
    assert(text(entry.playerId) && text(entry.sourceId) && !ids.has(entry.playerId), 'invalid or duplicate player source');
    ids.add(entry.playerId);
    const source = sourceOf(entry);
    if (entry.traitProfile !== undefined) validateLiveTraitProfileV1(entry.traitProfile,
      source.value === null ? {} : { badBallControl: source.value });
  }
  const entry = roster.entries.find(item => item.playerId === playerId);
  assert(entry, 'unknown player');
  return { roster, entry: entry! };
}
export function projectLiveTraitProfilesV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string }>) {
  const { entry } = context(input.roster, input.playerId), source = sourceOf(entry);
  return freeze({ boundary: 'LOCAL_TRAIT_AUTHORING_ONLY' as const, nativeMasteryAuthenticated: false as const,
    traits: catalog.map(definition => {
      const selection = entry.traitProfile?.selections.find(item => item.familyId === definition.familyId),
        owned = selection ? selection.stateId !== null : null,
        state = definition.states.find(item => item.stateId === selection?.stateId);
      return { familyId: definition.familyId, label: definition.label,
        status: owned === null ? 'UNASSESSED' as const : owned ? 'OWNED' as const : 'ABSENT' as const,
        owned, stateId: selection?.stateId ?? null, color: state?.color ?? 'neutral',
        sourceValue: selection?.source.badBallControl ?? source.value, effectiveSourceValue: source.value,
        sourcePath: source.path, sourceRoute: definition.sourceRoute };
    }) });
}
export function setLiveTraitProfileV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string;
  familyId: string; stateId: string | null; source?: Readonly<{ badBallControl: number }> }>) {
  const request = cloneInert(input), { roster, entry } = context(request.roster, request.playerId),
    definition = catalog.find(item => item.familyId === request.familyId);
  assert(definition && (request.stateId === null || definition.states.some(state => state.stateId === request.stateId)), 'unknown family or state');
  assert(entry.physical || entry.workbenchPlayer, 'an explicit numerical source owner is required');
  const current = sourceOf(entry), previousProfile = entry.traitProfile,
    previous = previousProfile?.selections.find(item => item.familyId === request.familyId);
  const explicit = request.source === undefined ? null : control(object(request.source, ['badBallControl'], 'source').badBallControl),
    retained = explicit ?? previous?.source.badBallControl ?? current.value ?? 0;
  const effective = request.stateId === null ? 0 : retained,
    changes: { path: string; before: unknown; after: unknown }[] = [];
  if (previous?.stateId === request.stateId && previous.source.badBallControl === retained && current.value === effective)
    return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
  assert(request.stateId === null || explicit !== null || retained > 0, 'an explicit technique source is required for initial zero or missing control');
  type MutableEntry = { sourceId: string; traitProfile?: LiveTraitProfileV1; physical?: { badBallControl?: number };
    workbenchPlayer?: { traits: { badBallControl: number } } };
  const mutable = entry as unknown as MutableEntry,
    selections = [...(entry.traitProfile?.selections.filter(item => item.familyId !== request.familyId) ?? []),
      { familyId: request.familyId, stateId: request.stateId, source: { badBallControl: retained } }];
  mutable.traitProfile = { version: 'live_trait_profile_v1', selections };
  changes.push({ path: 'traitProfile', before: cloneInert(previousProfile ?? null),
    after: cloneInert(mutable.traitProfile) });
  if (mutable.physical) mutable.physical.badBallControl = effective;
  else mutable.workbenchPlayer!.traits.badBallControl = effective;
  if (current.value !== effective) changes.push({ path: current.path, before: current.value, after: effective });
  if (!mutable.sourceId.split(':').includes('trait-edited')) mutable.sourceId += ':trait-edited';
  const mutableRoster = roster as unknown as { sourceId: string };
  if (!mutableRoster.sourceId.split(':').includes('trait-edited')) mutableRoster.sourceId += ':trait-edited';
  assert(text(mutable.sourceId) && text(mutableRoster.sourceId), 'source identifier exceeds the authoring limit');
  return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
}
