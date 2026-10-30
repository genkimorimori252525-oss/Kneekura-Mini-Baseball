import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterEntryV1 } from './LivePhysicalRosterV1';
import { getLiveTraitCatalogV77, validateLiveTraitProfileV1, type LiveTraitPhysicalSourceV54, type LiveTraitProfileV1, type LiveTraitRosterInputV1, type LiveTraitSourceV1 } from './LiveTraitProfilesV1';
import { getLiveTraitAuthoringCalibrationV54 } from './LiveTraitAuthoringCalibrationV54';

export { getLiveTraitCatalogV77 } from './LiveTraitProfilesV1';
const calibration = getLiveTraitAuthoringCalibrationV54();
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('independent live traits: ' + message); }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value;
type Entry = LivePhysicalRosterEntryV1;
type MutableEntry = { playerId: string; sourceId: string; physical?: Record<string, unknown>; workbenchPlayer?: { traits: { badBallControl: number }; decision?: unknown }; traitProfile?: LiveTraitProfileV1 };
type Migration = Readonly<{ playerId: string; fromVersion: string | null; toVersion: 'live_trait_profile_v2'; restoredPaths: readonly string[]; note: string }>;
const owner = (entry: Entry): LiveTraitPhysicalSourceV54 => entry.physical ?? (entry.workbenchPlayer ? { badBallControl: entry.workbenchPlayer.traits.badBallControl,
  ...(entry.workbenchPlayer.decision === undefined ? {} : { swingDecision: entry.workbenchPlayer.decision }) } : {});
function validateRoster(raw: LiveTraitRosterInputV1): LiveTraitRosterInputV1 {
  const roster = cloneInert(raw);
  assert(roster.version === 'live_physical_roster_v1' && validText(roster.sourceId) && Array.isArray(roster.entries) && roster.entries.length > 0, 'invalid roster');
  assert(roster.entries.every(e => validText(e.playerId) && validText(e.sourceId)), 'invalid player binding');
  // Validation uses the existing adapter; its defaulted result is never saved.
  applyLivePhysicalRosterV1({ roster, players: roster.entries.map(entry => ({ playerId: entry.playerId, name: entry.playerId,
    heightMeters: entry.heightMeters ?? 1.8, bats: 'R' as const })) });
  return roster;
}
function mark(roster: LiveTraitRosterInputV1, entry: Entry) {
  const mutable = entry as unknown as MutableEntry, packet = roster as unknown as { sourceId: string };
  if (!mutable.sourceId.split(':').includes('independent-traits')) mutable.sourceId += ':independent-traits';
  if (!packet.sourceId.split(':').includes('independent-traits')) packet.sourceId += ':independent-traits';
  assert(validText(mutable.sourceId) && validText(packet.sourceId), 'source identifier exceeds authoring limit');
}
function migrateEntry(roster: LiveTraitRosterInputV1, entry: Entry): Migration | null {
  if (entry.traitProfile?.version === 'live_trait_profile_v2') return null;
  const mutable = entry as unknown as MutableEntry, restoredPaths: string[] = [];
  const selections = (entry.traitProfile?.selections ?? []).map(selection => {
    const { familyId: id, source } = selection;
    if (id === 'running_aggression' || id === 'fielding_aggression' || id === 'plate_aggression') {
      assert(mutable.physical, 'legacy green baseline requires an explicit physical owner');
      if (id === 'plate_aggression') {
        mutable.physical.swingDecision = { approach: source['swingDecision.approach'], threshold: source['swingDecision.threshold'], aggressionWeight: source['swingDecision.aggressionWeight'] };
        restoredPaths.push('physical.swingDecision');
      } else {
        const key = id === 'running_aggression' ? 'baserunningSafetyMarginSeconds' : 'fieldingPursuitCostWeight';
        mutable.physical[key] = source[key]; restoredPaths.push('physical.' + key);
      }
      return { ...selection, source: { effectScale: 1 } };
    }
    return id === 'bad_ball_hitting' ? { ...selection, source: { ...source, effectScale: 1 } } : selection;
  });
  const migration: Migration = { playerId: entry.playerId, fromVersion: entry.traitProfile?.version ?? null, toVersion: 'live_trait_profile_v2', restoredPaths,
    note: 'Existing throwing SI is retained as base ability; no independent throwing ownership is inferred. Legacy green baselines are restored from saved source, never inverted.' };
  mutable.traitProfile = { version: 'live_trait_profile_v2', selections };
  mark(roster, entry);
  return migration;
}
/** Explicit, lossless migration. Loading a v1 packet does not call this API. */
export function migrateLiveTraitRosterV77(input: Readonly<{ roster: LiveTraitRosterInputV1 }>) {
  const request = cloneInert(input), roster = validateRoster(request.roster), migrations: Migration[] = [];
  for (const entry of roster.entries) { const result = migrateEntry(roster, entry); if (result) migrations.push(result); }
  validateRoster(roster);
  return freeze({ roster, migrations, authority: 'EXPLICIT_LOCAL_TRAIT_MIGRATION_V77' as const });
}
function projectedSource(entry: Entry, id: string): LiveTraitSourceV1 {
  const selection = entry.traitProfile?.selections.find(s => s.familyId === id);
  if (id === 'throw_accuracy') return selection?.source ?? { effectScale: 1 };
  if (id === 'bad_ball_hitting') return { badBallControl: selection?.source.badBallControl ?? owner(entry).badBallControl ?? 0,
    effectScale: selection?.source.effectScale ?? 1 };
  if (['plate_aggression', 'running_aggression', 'fielding_aggression'].includes(id)) return { effectScale: selection?.source.effectScale ?? 1 };
  return selection?.source ?? (['pitch_approach', 'swing_mode_preference'].includes(id) ? {} : { effectScale: 1 });
}
/** Human-facing independent ownership; SI-derived legacy grades are not ownership. */
export function projectLiveTraitProfilesV77(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string }>) {
  const request = cloneInert(input), roster = validateRoster(request.roster), entry = roster.entries.find(e => e.playerId === request.playerId);
  assert(entry, 'unknown player');
  return freeze({ boundary: 'LOCAL_TRAIT_AUTHORING_ONLY' as const, nativeMasteryAuthenticated: false as const, catalogVersion: 77,
    calibrationVersion: 77, calibrationAuthority: 'LOCAL_AUTHORING_ONLY', profileVersion: entry.traitProfile?.version ?? null,
    traits: getLiveTraitCatalogV77().map(definition => {
      const selection = entry.traitProfile?.selections.find(s => s.familyId === definition.familyId), source = projectedSource(entry, definition.familyId),
        owned = selection ? selection.stateId !== null : null, stateId = selection?.stateId ?? null, state = definition.states.find(s => s.stateId === stateId);
      return { familyId: definition.familyId, label: definition.label, status: owned === null ? 'UNASSESSED' as const : owned ? 'OWNED' as const : 'ABSENT' as const,
        owned, stateId, color: state?.color ?? 'neutral', sourceValue: source, effectiveSourceValue: source,
        sourcePath: 'traitProfile.selections', sourceRoute: definition.sourceRoute, editor: definition.editor,
        availability: definition.availability, states: definition.states, calibrationId: definition.calibrationId ?? 'independent-local-technique-v77' };
    }) });
}
export function setLiveTraitProfileV77(input: Readonly<{ roster: LiveTraitRosterInputV1; playerId: string; familyId: string; stateId: string | null; source?: LiveTraitSourceV1 }>) {
  const request = cloneInert(input), roster = validateRoster(request.roster), entry = roster.entries.find(e => e.playerId === request.playerId),
    definition = getLiveTraitCatalogV77().find(d => d.familyId === request.familyId);
  assert(entry && definition && (request.stateId === null || definition.states.some(s => s.stateId === request.stateId)), 'unknown player, family or state');
  const migration = migrateEntry(roster, entry), previous = entry.traitProfile!.selections.find(s => s.familyId === request.familyId),
    retained = projectedSource(entry, request.familyId), source = request.source === undefined ? retained : request.familyId === 'bad_ball_hitting'
      ? { ...retained, ...request.source } : request.source;
  const selection = { familyId: request.familyId, stateId: request.stateId, source };
  const candidate = { version: 'live_trait_profile_v2' as const, selections: [...entry.traitProfile!.selections.filter(s => s.familyId !== request.familyId), selection] };
  const profile = validateLiveTraitProfileV1(candidate, owner(entry));
  const changed = JSON.stringify(previous ?? null) !== JSON.stringify(selection), changes: { path: string; before: unknown; after: unknown }[] = [];
  if (changed) {
    (entry as unknown as MutableEntry).traitProfile = profile; mark(roster, entry);
    changes.push({ path: 'traitProfile.selections.' + request.familyId, before: previous ?? null, after: selection });
  }
  validateRoster(roster);
  return freeze({ roster, migrations: migration ? [migration] : [], changes, projection: projectLiveTraitProfilesV77({ roster, playerId: request.playerId }) });
}

type ExecutionPhysical = Readonly<{ badBallControl?: number; throwDirectionStdRadians?: number; baserunningSafetyMarginSeconds?: number;
  fieldingPursuitCostWeight?: number; swingDecision?: Readonly<{ approach: 'AUTO' | 'TAKE' | 'SWING'; threshold: number; aggressionWeight: number }> }>;
/** One copy at the execution boundary. The returned effective values are never saved as base SI. */
export function resolveLiveExecutionPhysicalV77<T extends ExecutionPhysical>(physical: T, profile?: LiveTraitProfileV1): T {
  if (profile === undefined) return physical;
  const safe = validateLiveTraitProfileV1(profile, physical);
  if (safe.version !== 'live_trait_profile_v2') return physical;
  const patch: Record<string, unknown> = {};
  const put = (key: keyof ExecutionPhysical, value: unknown) => { if (JSON.stringify(physical[key]) !== JSON.stringify(value)) patch[key] = value; };
  for (const selection of safe.selections) {
    const { familyId: id, stateId, source } = selection, scale = Number(source.effectScale ?? 1);
    if (scale === 0) continue;
    if (id === 'bad_ball_hitting') { put('badBallControl', stateId === null ? 0 : Math.min(1, Number(source.badBallControl) * scale)); continue; }
    if (stateId === null) continue;
    if (id === 'throw_accuracy') {
      const strength = ({ G: -1, F: -.65, E: -.3, D: 0, C: .3, B: .6, A: .8, GOLD: 1 } as Record<string, number>)[stateId];
      if (strength !== 0 && physical.throwDirectionStdRadians !== undefined)
        put('throwDirectionStdRadians', clamp(physical.throwDirectionStdRadians * 2 ** (-strength * scale), 0, .12));
    } else if (id === 'running_aggression' && stateId === 'AGGRESSIVE') {
      put('baserunningSafetyMarginSeconds', clamp((physical.baserunningSafetyMarginSeconds ?? calibration.runningAggression.defaultSource) + calibration.runningAggression.offsetSeconds * scale, 0, 3));
    } else if (id === 'fielding_aggression' && stateId === 'AGGRESSIVE') {
      put('fieldingPursuitCostWeight', clamp((physical.fieldingPursuitCostWeight ?? calibration.fieldingAggression.defaultSource) * calibration.fieldingAggression.costMultiplier ** scale, .25, 4));
    } else if (id === 'plate_aggression') {
      const current = physical.swingDecision ?? { approach: 'AUTO', threshold: calibration.plateAggression.defaultThreshold, aggressionWeight: calibration.plateAggression.defaultAggressionWeight };
      // A green preference never replaces an explicit forced take/swing.
      if (current.approach !== 'AUTO') continue;
      const offset = (stateId === 'AGGRESSIVE' ? -1 : stateId === 'CAUTIOUS' ? 1 : 0) * calibration.plateAggression.thresholdOffset * scale;
      if (offset !== 0) put('swingDecision', { ...current, threshold: clamp(current.threshold + offset, 0, 1) });
    }
  }
  return Object.keys(patch).length ? { ...physical, ...patch } : physical;
}
