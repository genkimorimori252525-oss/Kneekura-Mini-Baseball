import { getTechnicalTraitDefinitionsV75, isTechnicalTraitV75, resolveValidatedTechnicalProfileV75 } from './LiveTechnicalTraitsV75';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { deriveLiveThrowAccuracyGradeV54, getLiveThrowAccuracySourceV54, getLiveTraitAuthoringCalibrationV54 } from './LiveTraitAuthoringCalibrationV54';

/** Local authoring only. Neither colors nor saved labels add another execution
 * effect or authenticate Native persistent mastery. v1 bad-ball packets retain
 * their exact family, state and source shape. */
export type LiveTraitSourceV1 = Readonly<Record<string, number | string>>;
export type LiveTraitProfileV1 = Readonly<{
  version: 'live_trait_profile_v1';
  selections: readonly Readonly<{ familyId: string; stateId: string | null; source: LiveTraitSourceV1 }>[];
}>;
export type LiveTraitRosterInputV1 = Omit<LivePhysicalRosterInputV1, 'entries'> & Readonly<{
  entries: readonly (LivePhysicalRosterInputV1['entries'][number] & Readonly<{ traitProfile?: LiveTraitProfileV1 }>)[];
}>;
type TraitColor = 'blue' | 'red' | 'green' | 'gold' | 'neutral';
export type LiveTraitDefinitionV1 = Readonly<{
  familyId: string; label: string; lifecycleClass: string; sourceRoute: 'SOURCE_EXECUTION' | 'PREFERENCE';
  states: readonly Readonly<{ stateId: string; label: string; color: TraitColor }>[];
  sourcePaths: readonly string[]; effectOwner: string; sourceDefinition: string;
  editor?: 'OWNERSHIP' | 'PREFERENCE' | 'GRADE' | 'TECHNIQUE'; availability?: 'EXECUTABLE' | 'SOURCE_DERIVED'; calibrationId?: string;
}>;
export type LiveTraitPhysicalSourceV54 = Readonly<{
  badBallControl?: number; throwDirectionStdRadians?: number; baserunningSafetyMarginSeconds?: number;
  fieldingPursuitCostWeight?: number; swingDecision?: Readonly<{ approach: 'AUTO' | 'TAKE' | 'SWING'; threshold: number; aggressionWeight: number }>;
}>;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const calibration = getLiveTraitAuthoringCalibrationV54();
const state = (stateId: string, label: string, color: TraitColor = 'green') => ({ stateId, label, color });
const legacyCatalog: readonly LiveTraitDefinitionV1[] = freeze([
  { familyId: 'bad_ball_hitting', label: '悪球打ち', lifecycleClass: 'LEARNED_MASTERY_PERSISTENT', sourceRoute: 'SOURCE_EXECUTION',
    states: [state('LEARNED', '悪球打ち', 'blue')], editor: 'OWNERSHIP', availability: 'EXECUTABLE',
    sourcePaths: ['physical.badBallControl', 'workbenchPlayer.traits.badBallControl'],
    effectOwner: 'LivePitchV1 awkward execution error / BattingWorkbench execution error',
    sourceDefinition: 'canonical09 §5.2.1 / 2026-10-14 USER-DIRECTED REFINEMENT; no chase or result-probability bonus' },
  { familyId: 'throw_accuracy', label: '送球', lifecycleClass: 'GRADED_DYNAMIC', sourceRoute: 'SOURCE_EXECUTION',
    states: ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'GOLD'].map(id => state(id, id === 'GOLD' ? 'ストライク送球' : '送球' + id,
      id === 'GOLD' ? 'gold' : ['A', 'B'].includes(id) ? 'blue' : ['F', 'G'].includes(id) ? 'red' : 'neutral')),
    editor: 'GRADE', availability: 'SOURCE_DERIVED', calibrationId: calibration.throwAccuracy.id,
    sourcePaths: ['physical.throwDirectionStdRadians'], effectOwner: 'LiveThrowDirectionV1 angular release error',
    sourceDefinition: 'canonical09 §5.7 + versioned LOCAL_AUTHORING_ONLY SI thresholds, not a league or mastery assessment' },
  { familyId: 'plate_aggression', label: '打撃積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極打法'), state('BALANCED', '標準', 'neutral'), state('CAUTIOUS', '慎重打法')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.plateAggression.id,
    sourcePaths: ['physical.swingDecision.threshold', 'physical.swingDecision.aggressionWeight', 'physical.swingDecision.approach'],
    effectOwner: 'LivePitchV1 AUTO swing decision', sourceDefinition: 'canonical09 §5.11 / §6; no recognition or forced-swing bonus' },
  { familyId: 'running_aggression', label: '走塁積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極走塁'), state('BALANCED', '標準', 'neutral')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.runningAggression.id,
    sourcePaths: ['physical.baserunningSafetyMarginSeconds'], effectOwner: 'LiveRunnerAdvancePolicyV1 safety margin',
    sourceDefinition: 'canonical09 §5.11 / §6; no speed, reaction or rounding boost' },
  { familyId: 'fielding_aggression', label: '守備積極性', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('AGGRESSIVE', '積極守備'), state('BALANCED', '標準', 'neutral')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', calibrationId: calibration.fieldingAggression.id,
    sourcePaths: ['physical.fieldingPursuitCostWeight'], effectOwner: 'LiveFieldHandlerSelectionV1 feasible-candidate pursuit cost',
    sourceDefinition: 'canonical09 §6; does not create a feasible catch or improve physical reach' },
  { familyId: 'pitch_approach', label: '投球傾向', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('FASTBALL', '速球中心'), state('BALANCED', '標準', 'neutral'), state('BREAKING', '変化球中心')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', sourcePaths: [], effectOwner: 'Host AUTO pitch selection',
    sourceDefinition: 'canonical09 §5.11 / §6; accepted explicit pitch commands take priority' },
  { familyId: 'swing_mode_preference', label: '打撃傾向', lifecycleClass: 'GREEN_SLOW_PREFERENCE', sourceRoute: 'PREFERENCE',
    states: [state('POWER', '強振多用'), state('BALANCED', '標準', 'neutral'), state('CONTACT', 'ミート多用')],
    editor: 'PREFERENCE', availability: 'EXECUTABLE', sourcePaths: [], effectOwner: 'Host AUTO batting motor selection',
    sourceDefinition: 'canonical09 §5.11 / §6; accepted explicit batting commands take priority' },
]);
const catalog: readonly LiveTraitDefinitionV1[] = freeze([...legacyCatalog, ...getTechnicalTraitDefinitionsV75()]);
export const getLiveTraitCatalogV1 = (options?: Readonly<{includeTechnical?:boolean}>): readonly LiveTraitDefinitionV1[] => options?.includeTechnical ? catalog : legacyCatalog;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('live trait profiles: ' + message); }
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value && value.length <= 160;
const object = (value: unknown, fields: readonly string[], path: string): Record<string, unknown> => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'invalid ' + path);
  const record = value as Record<string, unknown>;
  assert(Object.keys(record).length === fields.length && fields.every(key => Object.hasOwn(record, key)), 'invalid fields ' + path);
  return record;
};
const range = (value: unknown, min: number, max: number): number => {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'invalid technical source');
  return value;
};
const virtual = (id: string) => id === 'pitch_approach' || id === 'swing_mode_preference' || isTechnicalTraitV75(id);
const scalarKey = (id: string): string | null => ({ bad_ball_hitting: 'badBallControl', throw_accuracy: 'throwDirectionStdRadians',
  running_aggression: 'baserunningSafetyMarginSeconds', fielding_aggression: 'fieldingPursuitCostWeight' } as Record<string, string>)[id] ?? null;
const sourceKeys = (id: string): readonly string[] => isTechnicalTraitV75(id) ? ['effectScale'] : virtual(id) ? [] : id === 'plate_aggression'
  ? ['swingDecision.threshold', 'swingDecision.aggressionWeight', 'swingDecision.approach'] : [scalarKey(id)!];
function readSource(raw: unknown, id: string): LiveTraitSourceV1 {
  const source = object(raw, sourceKeys(id), 'source');
  if (isTechnicalTraitV75(id)) range(source.effectScale, 0, 2);
  else if (id === 'bad_ball_hitting') range(source.badBallControl, 0, 1);
  else if (id === 'throw_accuracy') range(source.throwDirectionStdRadians, 0, .12);
  else if (id === 'running_aggression') range(source.baserunningSafetyMarginSeconds, 0, 3);
  else if (id === 'fielding_aggression') range(source.fieldingPursuitCostWeight, .25, 4);
  else if (id === 'plate_aggression') {
    range(source['swingDecision.threshold'], 0, 1); range(source['swingDecision.aggressionWeight'], 0, 1);
    assert(source['swingDecision.approach'] === 'AUTO', 'forced plate source cannot become a green preference');
  }
  return source as LiveTraitSourceV1;
}
const readProfile = (raw: unknown): LiveTraitProfileV1 => {
  const profile = object(cloneInert(raw), ['version', 'selections'], 'profile');
  assert(profile.version === 'live_trait_profile_v1' && Array.isArray(profile.selections), 'unsupported profile');
  const seen = new Set<string>();
  const selections = (profile.selections as unknown[]).map(rawSelection => {
    const selection = object(rawSelection, ['familyId', 'stateId', 'source'], 'selection'),
      definition = catalog.find(item => item.familyId === selection.familyId);
    assert(definition && !seen.has(definition.familyId), 'unknown or duplicate trait family');
    seen.add(definition.familyId);
    assert(definition.editor !== 'GRADE', 'a source-derived grade must not be saved as a second trait effect');
    assert(selection.stateId === null || definition.states.some(value => value.stateId === selection.stateId), 'unsupported family state');
    return { familyId: definition.familyId, stateId: selection.stateId as string | null, source: readSource(selection.source, definition.familyId) };
  });
  return { version: 'live_trait_profile_v1', selections };
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type Selection = LiveTraitProfileV1['selections'][number];
function effectiveSource(selection: Selection): LiveTraitSourceV1 {
  const { familyId: id, source, stateId } = selection;
  if (id === 'bad_ball_hitting') return { badBallControl: stateId === null ? 0 : source.badBallControl };
  if (id === 'running_aggression') return { baserunningSafetyMarginSeconds: stateId === 'AGGRESSIVE'
    ? clamp(Number(source.baserunningSafetyMarginSeconds) + calibration.runningAggression.offsetSeconds, 0, 3) : source.baserunningSafetyMarginSeconds };
  if (id === 'fielding_aggression') return { fieldingPursuitCostWeight: stateId === 'AGGRESSIVE'
    ? clamp(Number(source.fieldingPursuitCostWeight) * calibration.fieldingAggression.costMultiplier, .25, 4) : source.fieldingPursuitCostWeight };
  if (id === 'plate_aggression') return { ...source, 'swingDecision.threshold': clamp(Number(source['swingDecision.threshold'])
    + (stateId === 'AGGRESSIVE' ? -calibration.plateAggression.thresholdOffset : stateId === 'CAUTIOUS' ? calibration.plateAggression.thresholdOffset : 0), 0, 1) };
  return {};
}
const getPath = (source: unknown, path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, source);
const sameSource = (a: LiveTraitSourceV1 | null, b: LiveTraitSourceV1 | null) => a === null || b === null ? a === b
  : Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
/** The final merged execution source is checked, never multiplied again. */
export function validateLiveTraitProfileV1(raw: unknown, physical: LiveTraitPhysicalSourceV54): LiveTraitProfileV1 {
  const profile = readProfile(raw), source = cloneInert(physical);
  for (const selection of profile.selections) for (const [key, expected] of Object.entries(effectiveSource(selection)))
    assert(getPath(source, key) === expected, 'trait profile contradicts the executed technical source');
  return freeze(profile);
}
type Entry = LiveTraitRosterInputV1['entries'][number];
function physicalSource(entry: Entry): LiveTraitPhysicalSourceV54 {
  assert(!(entry.physical && entry.workbenchPlayer), 'ambiguous physical and workbench sources');
  return entry.physical ?? (entry.workbenchPlayer ? { badBallControl: entry.workbenchPlayer.traits.badBallControl,
    ...(entry.workbenchPlayer.decision === undefined ? {} : { swingDecision: entry.workbenchPlayer.decision }) } : {});
}
function currentSource(entry: Entry, id: string): LiveTraitSourceV1 | null {
  const source = physicalSource(entry), key = scalarKey(id);
  if (isTechnicalTraitV75(id)) return entry.traitProfile?.selections.find((s:Selection)=>s.familyId===id)?.source??{effectScale:1};
  if (virtual(id)) return {};
  if (id === 'plate_aggression') {
    const decision = source.swingDecision ?? { approach: 'AUTO', threshold: calibration.plateAggression.defaultThreshold,
      aggressionWeight: calibration.plateAggression.defaultAggressionWeight };
    range(decision.threshold, 0, 1); range(decision.aggressionWeight, 0, 1);
    assert(['AUTO', 'TAKE', 'SWING'].includes(decision.approach), 'invalid plate approach source');
    return { 'swingDecision.threshold': decision.threshold, 'swingDecision.aggressionWeight': decision.aggressionWeight, 'swingDecision.approach': decision.approach };
  }
  const value = getPath(source, key!);
  if (value === undefined && (id === 'bad_ball_hitting' || id === 'throw_accuracy')) return null;
  return readSource({ [key!]: value ?? (id === 'running_aggression' ? calibration.runningAggression.defaultSource : calibration.fieldingAggression.defaultSource) }, id);
}
function context(raw: LiveTraitRosterInputV1, playerId: string, verifySources = true) {
  const roster = cloneInert(raw);
  assert(roster.version === 'live_physical_roster_v1' && text(roster.sourceId) && Array.isArray(roster.entries), 'invalid roster');
  const ids = new Set<string>();
  for (const entry of roster.entries) {
    assert(text(entry.playerId) && text(entry.sourceId) && !ids.has(entry.playerId), 'invalid or duplicate player source');
    ids.add(entry.playerId);
    const source = physicalSource(entry);
    if (entry.traitProfile !== undefined) {
      readProfile(entry.traitProfile);
      if (verifySources) validateLiveTraitProfileV1(entry.traitProfile, source);
    }
  }
  const entry = roster.entries.find(item => item.playerId === playerId);
  assert(entry, 'unknown player');
  return { roster, entry };
}
const displaySource = (id: string, source: LiveTraitSourceV1 | null): number | LiveTraitSourceV1 | null =>
  source === null ? null : scalarKey(id) ? Number(source[scalarKey(id)!]) : source;
export function projectLiveTraitProfilesV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string; includeTechnical?:boolean }>) {
  const { entry } = context(input.roster, input.playerId);
  return freeze({ boundary: 'LOCAL_TRAIT_AUTHORING_ONLY' as const, nativeMasteryAuthenticated: false as const,
    catalogVersion: input.includeTechnical ? 75 : 54, calibrationVersion: calibration.version, calibrationAuthority: calibration.authority,
    traits: getLiveTraitCatalogV1({includeTechnical:input.includeTechnical}).map(definition => {
      const current = currentSource(entry, definition.familyId), selection = entry.traitProfile?.selections.find((item: Selection) => item.familyId === definition.familyId),
        derived = definition.editor === 'GRADE' && current !== null ? deriveLiveThrowAccuracyGradeV54(Number(current.throwDirectionStdRadians)) : null,
        owned = derived !== null ? true : selection ? selection.stateId !== null : null,
        stateId = derived ?? selection?.stateId ?? null, selectedState = definition.states.find(value => value.stateId === stateId);
      return { familyId: definition.familyId, label: definition.label,
        status: derived !== null ? 'DERIVED' as const : owned === null ? 'UNASSESSED' as const : owned ? 'OWNED' as const : 'ABSENT' as const,
        owned, stateId, color: selectedState?.color ?? 'neutral',
        sourceValue: displaySource(definition.familyId, selection?.source ?? current), effectiveSourceValue: displaySource(definition.familyId, current),
        sourcePath: definition.familyId === 'bad_ball_hitting' ? entry.workbenchPlayer ? 'workbenchPlayer.traits.badBallControl' : 'physical.badBallControl'
          : definition.sourcePaths[0] ?? 'traitProfile.selections', sourceRoute: definition.sourceRoute,
        editor: definition.editor, availability: definition.availability, states: definition.states, calibrationId: definition.calibrationId ?? null };
    }) });
}
type MutableEntry = { sourceId: string; traitProfile?: LiveTraitProfileV1; physical?: Record<string, unknown>;
  workbenchPlayer?: { traits: { badBallControl: number } } };
function markEdited(roster: LiveTraitRosterInputV1, entry: Entry) {
  const mutable = entry as unknown as MutableEntry, mutableRoster = roster as unknown as { sourceId: string };
  if (!mutable.sourceId.split(':').includes('trait-edited')) mutable.sourceId += ':trait-edited';
  if (!mutableRoster.sourceId.split(':').includes('trait-edited')) mutableRoster.sourceId += ':trait-edited';
  assert(text(mutable.sourceId) && text(mutableRoster.sourceId), 'source identifier exceeds the authoring limit');
}
function writeSource(entry: Entry, id: string, source: LiveTraitSourceV1) {
  const mutable = entry as unknown as MutableEntry;
  if (id === 'bad_ball_hitting' && mutable.workbenchPlayer) mutable.workbenchPlayer.traits.badBallControl = Number(source.badBallControl);
  else if (!virtual(id)) {
    assert(mutable.physical, 'an explicit physical source owner is required for this trait');
    if (id === 'plate_aggression') mutable.physical.swingDecision = { approach: source['swingDecision.approach'],
      threshold: source['swingDecision.threshold'], aggressionWeight: source['swingDecision.aggressionWeight'] };
    else for (const [key, value] of Object.entries(source)) mutable.physical[key] = value;
  }
}
export function setLiveTraitProfileV1(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string;
  familyId: string; stateId: string | null; source?: LiveTraitSourceV1 }>) {
  const request = cloneInert(input), { roster, entry } = context(request.roster, request.playerId),
    definition = catalog.find(item => item.familyId === request.familyId);
  assert(definition && (request.stateId === null || definition.states.some(value => value.stateId === request.stateId)), 'unknown family or state');
  const id = definition.familyId, current = currentSource(entry, id), explicit = request.source === undefined ? null : readSource(request.source, id),
    changes: { path: string; before: unknown; after: unknown }[] = [];
  if (isTechnicalTraitV75(id)) {
    const previous=entry.traitProfile?.selections.find((s:Selection)=>s.familyId===id), source=explicit??previous?.source??{effectScale:1};
    if(previous?.stateId!==request.stateId||!sameSource(previous.source,source)){
      const selection={familyId:id,stateId:request.stateId,source:readSource(source,id)};
      (entry as unknown as MutableEntry).traitProfile={version:'live_trait_profile_v1',selections:[...(entry.traitProfile?.selections??[]).filter((s:Selection)=>s.familyId!==id),selection]};
      changes.push({path:'traitProfile.selections.'+id,before:previous??null,after:selection});markEdited(roster,entry);
    }
    return freeze({roster,projection:projectLiveTraitProfilesV1({roster,playerId:request.playerId,includeTechnical:true}),changes});
  }
  if (definition.editor === 'GRADE') {
    assert(request.stateId !== null && entry.physical, 'a source-derived grade requires an explicit physical owner and tier');
    if (explicit === null && current !== null && deriveLiveThrowAccuracyGradeV54(Number(current.throwDirectionStdRadians)) === request.stateId)
      return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
    const source = explicit ?? { throwDirectionStdRadians: getLiveThrowAccuracySourceV54(request.stateId) };
    assert(deriveLiveThrowAccuracyGradeV54(Number(source.throwDirectionStdRadians)) === request.stateId, 'throw grade contradicts its authored source');
    if (!sameSource(current, source)) {
      writeSource(entry, id, source); markEdited(roster, entry);
      changes.push({ path: 'physical.throwDirectionStdRadians', before: current?.throwDirectionStdRadians ?? null, after: source.throwDirectionStdRadians });
    }
    return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
  }
  assert(virtual(id) || entry.physical || id === 'bad_ball_hitting' && entry.workbenchPlayer, 'an explicit numerical source owner is required');
  if (id === 'plate_aggression') assert(current?.['swingDecision.approach'] === 'AUTO', 'forced plate source cannot become a green preference');
  const previousProfile = entry.traitProfile, previous = previousProfile?.selections.find((item: Selection) => item.familyId === id),
    retained = explicit ?? previous?.source ?? current ?? { badBallControl: 0 },
    selection = { familyId: id, stateId: request.stateId, source: readSource(retained, id) }, effective = effectiveSource(selection);
  if (previous?.stateId === request.stateId && sameSource(previous.source, retained) && sameSource(current, effective))
    return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
  if (id === 'bad_ball_hitting') assert(request.stateId === null || explicit !== null || Number(retained.badBallControl) > 0,
    'an explicit technique source is required for initial zero or missing control');
  const mutable = entry as unknown as MutableEntry;
  mutable.traitProfile = { version: 'live_trait_profile_v1', selections: [
    ...(previousProfile?.selections.filter((item: Selection) => item.familyId !== id) ?? []), selection] };
  changes.push({ path: 'traitProfile', before: cloneInert(previousProfile ?? null), after: cloneInert(mutable.traitProfile) });
  const beforeValues = Object.fromEntries(Object.keys(effective).map(key => [key, getPath(physicalSource(entry), key) ?? null]));
  writeSource(entry, id, effective);
  for (const [key, value] of Object.entries(effective)) if (beforeValues[key] !== value)
    changes.push({ path: id === 'bad_ball_hitting' && entry.workbenchPlayer ? 'workbenchPlayer.traits.badBallControl' : 'physical.' + key,
      before: beforeValues[key], after: value });
  markEdited(roster, entry);
  return freeze({ roster, projection: projectLiveTraitProfilesV1({ roster, playerId: request.playerId }), changes });
}
/** Stored preference is a local authoring input, not a learned career proof.
 * Runtime selection and accepted-command precedence stay with the Host. */
export function resolveLiveTraitPreferencesV54(profile?: LiveTraitProfileV1) {
  const selections = profile === undefined ? [] : readProfile(profile).selections,
    pitch = selections.find(item => item.familyId === 'pitch_approach')?.stateId,
    swing = selections.find(item => item.familyId === 'swing_mode_preference')?.stateId;
  return freeze({ pitchApproach: (pitch ?? 'BALANCED') as 'FASTBALL' | 'BALANCED' | 'BREAKING',
    swingMode: (swing ?? 'BALANCED') as 'POWER' | 'BALANCED' | 'CONTACT' });
}
/** After an explicit direct SI edit, retain technical ownership only when it
 * still describes that source. Green edits remove only that axis's baseline. */
export function reconcileLiveTraitSourcesV54(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string; changedPaths: readonly string[] }>): LiveTraitRosterInputV1 {
  const request = cloneInert(input), { roster, entry } = context(request.roster, request.playerId, false);
  assert(Array.isArray(request.changedPaths) && request.changedPaths.every(text), 'invalid changed source paths');
  const paths = request.changedPaths.map(path => path.replace(/^physical\./, '')),
    touches = (id: string) => sourceKeys(id).some(key => paths.some(path => path === key || key.startsWith(path + '.') || path.startsWith(key + '.')));
  if (entry.traitProfile !== undefined) {
    const previous = readProfile(entry.traitProfile), selections = previous.selections.flatMap(selection => {
      const id = selection.familyId;
      if (virtual(id) || !touches(id)) return [selection];
      const current = currentSource(entry, id);
      if (id === 'bad_ball_hitting') {
        assert(current !== null, 'a directly edited bad-ball source must remain explicit');
        if (selection.stateId === null) {
          assert(current.badBallControl === 0, 'an absent bad-ball trait cannot infer ownership from a direct nonzero source');
          return [selection];
        }
        return [{ ...selection, source: current }];
      }
      return sameSource(current, effectiveSource(selection)) ? [selection] : [];
    });
    if (JSON.stringify(previous.selections) !== JSON.stringify(selections)) {
      (entry as unknown as MutableEntry).traitProfile = { version: 'live_trait_profile_v1', selections };
      markEdited(roster, entry);
    }
  }
  context(roster, request.playerId);
  return freeze(roster);
}

/** Public boundary uses the same strict profile parser as every other trait resolver. */
export function resolveLiveTechnicalTraitsV75(profile?: LiveTraitProfileV1) {
  return resolveValidatedTechnicalProfileV75(profile===undefined?undefined:readProfile(profile));
}
