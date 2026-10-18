import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import type { LivePlayerV1 } from './LiveBaseballMatchV1';

/** Reversible authoring controls around explicit individual SI anchors. These
 * are not an inverse of an official league projection or empirical scouting. */
export type LivePublicAbilityReferenceV1 = Readonly<{
  version: 'live_public_ability_reference_v1'; policyId: 'individual-profile-public-authoring-v1';
  players: readonly LivePlayerV1[];
  anchors: readonly Readonly<{ playerId: string; leagueId: string; role: string;
    ratings: Readonly<Record<string, number>>; entry: LivePhysicalRosterInputV1['entries'][number] }>[];
}>;
type Component = Readonly<{ path: string; direction: 1 | -1; floor: number }>;
type Spec = Readonly<{ id: string; label: string; section: 'common' | 'batter' | 'pitcher';
  mode: 'group' | 'percent' | 'pitchSpeed'; components: readonly Component[]; note: string }>;
const up = (path: string): Component => ({ path, direction: 1, floor: 0 });
const down = (path: string, floor: number): Component => ({ path, direction: -1, floor });
const specs: readonly Spec[] = [
  { id: 'contact', label: 'ミート', section: 'batter', mode: 'group', components: [down('aimStdMeters', .001), down('timingStdSeconds', .001)], note: '狙う位置とタイミングの精度' },
  { id: 'power', label: 'パワー', section: 'batter', mode: 'group', components: [up('targetSweetSpotSpeedMps'), up('maximumSweetSpotSpeedMps')], note: '芯の目標速度と最大速度' },
  { id: 'vision', label: '選球眼', section: 'batter', mode: 'group', components: [down('zoneJudgmentStdMeters', .001)], note: 'コース判断の精度。積極性は詳細で別に設定' },
  { id: 'run', label: '走力', section: 'common', mode: 'group', components: [up('topSpeedMps'), up('accelerationMps2')], note: '最高速度と加速' },
  { id: 'arm', label: '肩力', section: 'common', mode: 'group', components: [up('throwSpeedMps')], note: '実際の送球初速' },
  { id: 'field', label: '守備力', section: 'common', mode: 'group', components: [down('reactionSeconds', .01), down('defensiveDecisionSeconds', .01), down('transferSeconds', .01)], note: '初動・状況判断・持ち替え。走力と捕球は別' },
  { id: 'catching', label: '捕球', section: 'common', mode: 'group', components: [up('gloveSpeedMps'), up('retentionCapacityJ'), up('captureDissipationPowerW')], note: 'グラブの動作と衝撃の吸収・保持' },
  { id: 'throwingAccuracy', label: '送球精度', section: 'common', mode: 'group', components: [down('throwDirectionStdRadians', .0001)], note: 'リリース方向の精度' },
  { id: 'maxSpeedKmh', label: '球速', section: 'pitcher', mode: 'pitchSpeed', components: [up('maximumPitchSpeedMps'), up('releaseSpeedMps')], note: '最高初速。基準初速との比率を維持' },
  { id: 'control', label: '制球', section: 'pitcher', mode: 'group', components: [down('commandStdMeters', .001)], note: '投球の狙い位置の精度' },
];
const policyId = 'individual-profile-public-authoring-v1' as const;
const pointsPerLogUnit = 100;
const assert = (value: unknown, message: string): void => { if (!value) throw new Error('public abilities: ' + message); };
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
type MutablePacket = { version: 'live_physical_roster_v1'; sourceId: string; entries: { playerId: string; sourceId: string; physical?: Record<string, unknown> }[] };
const physical = (entry: LivePhysicalRosterInputV1['entries'][number]): Readonly<Record<string, unknown>> => {
  assert(entry.physical && !entry.workbenchPlayer && entry.maximumPitchSpeedKmh === undefined, 'explicit SI entry without competing speed source required');
  return entry.physical as Readonly<Record<string, unknown>>;
};
function numeric(entry: LivePhysicalRosterInputV1['entries'][number], path: string): number {
  // An old v40 SI packet omitted the new sensory error and meant perfect
  // local course estimation. Keep that exact behavior when importing it.
  const value = physical(entry)[path] ?? (path === 'zoneJudgmentStdMeters' ? 0 : undefined);
  assert(typeof value === 'number' && Number.isFinite(value), 'missing SI control: ' + path);
  return value as number;
}
function context(input: Readonly<{ roster: LivePhysicalRosterInputV1; reference: LivePublicAbilityReferenceV1; playerId: string }>) {
  const reference = input.reference;
  assert(reference?.version === 'live_public_ability_reference_v1' && reference.policyId === policyId, 'unsupported authoring reference');
  assert(Array.isArray(reference.players) && Array.isArray(reference.anchors)
    && reference.players.length === reference.anchors.length
    && new Set(reference.anchors.map(a => a.playerId)).size === reference.anchors.length, 'invalid reference bindings');
  const ids = new Set(reference.players.map(p => p.playerId));
  assert(reference.anchors.every(a => ids.has(a.playerId) && a.entry.playerId === a.playerId && typeof a.leagueId === 'string' && typeof a.role === 'string'
    && specs.filter(s => s.mode === 'group').every(s => Number.isFinite(a.ratings[s.id]) && a.ratings[s.id] >= 0 && a.ratings[s.id] <= 100)), 'invalid reference anchor');
  applyLivePhysicalRosterV1({ players: reference.players, roster: input.roster });
  assert(input.roster.entries.length === ids.size && input.roster.entries.every(e => ids.has(e.playerId)), 'complete reference roster required');
  applyLivePhysicalRosterV1({ players: reference.players, roster: { version: 'live_physical_roster_v1', sourceId: policyId, entries: reference.anchors.map(a => a.entry) } });
  const entry = input.roster.entries.find(e => e.playerId === input.playerId), anchor = reference.anchors.find(a => a.playerId === input.playerId);
  assert(entry && anchor, 'unknown player');
  return { entry: entry!, anchor: anchor! };
}
function quality(entry: LivePhysicalRosterInputV1['entries'][number], spec: Spec): number {
  const components = spec.mode === 'pitchSpeed' ? spec.components.slice(0, 1) : spec.components;
  return components.reduce((sum, c) => {
    const value = numeric(entry, c.path) + c.floor;
    assert(value > 0, 'nonpositive ability component: ' + c.path);
    return sum + c.direction * Math.log(value);
  }, 0) / components.length;
}
function abilityValue(entry: LivePhysicalRosterInputV1['entries'][number], anchor: LivePublicAbilityReferenceV1['anchors'][number], spec: Spec): number {
  if (spec.mode === 'percent') return numeric(entry, spec.components[0].path) * 100;
  if (spec.mode === 'pitchSpeed') return numeric(entry, spec.components[0].path) * 3.6;
  return anchor.ratings[spec.id] + pointsPerLogUnit * (quality(entry, spec) - quality(anchor.entry, spec));
}
export function projectLivePublicAbilitiesV1(input: Readonly<{ roster: LivePhysicalRosterInputV1; reference: LivePublicAbilityReferenceV1; playerId: string }>) {
  const { entry, anchor } = context(input);
  return freeze({ policyId, abilities: specs.map(spec => ({ id: spec.id, label: spec.label, section: spec.section,
    value: abilityValue(entry, anchor, spec), min: spec.mode === 'pitchSpeed' ? 54 : 0, max: spec.mode === 'pitchSpeed' ? 306 : 100,
    unit: spec.mode === 'pitchSpeed' ? 'km/h' : '', linkedPaths: spec.components.map(c => c.path), note: spec.note })) });
}
export function editLivePublicAbilityV1(input: Readonly<{ roster: LivePhysicalRosterInputV1; reference: LivePublicAbilityReferenceV1;
  playerId: string; abilityId: string; value: number }>) {
  const projection = projectLivePublicAbilitiesV1(input), spec = specs.find(s => s.id === input.abilityId), old = projection.abilities.find(a => a.id === input.abilityId);
  assert(spec && old && Number.isFinite(input.value), 'invalid public ability value');
  assert(input.value === old!.value || input.value >= old!.min && input.value <= old!.max, 'invalid public ability value');
  const copy = cloneInert(input.roster) as unknown as MutablePacket;
  const selected = copy.entries.find(e => e.playerId === input.playerId)!;
  const before = input.roster.entries.find(e => e.playerId === input.playerId)!;
  const changes: { path: string; before: number; after: number }[] = [];
  // An exact no-op preserves all SI bytes and source identifiers.
  if (input.value !== old!.value) {
    for (const component of spec!.components) {
      const previous = numeric(before, component.path);
      const next = spec!.mode === 'percent' ? input.value / 100
        : spec!.mode === 'pitchSpeed' ? previous * input.value / old!.value
        : (previous + component.floor) * Math.exp(component.direction * (input.value - old!.value) / pointsPerLogUnit) - component.floor;
      assert(Number.isFinite(next) && next >= 0, 'requested value exceeds this individual profile; inspect detailed controls');
      selected.physical![component.path] = next;
      changes.push({ path: component.path, before: previous, after: next });
    }
    if (!selected.sourceId.split(':').includes('public-edited')) selected.sourceId += ':public-edited';
    copy.sourceId = input.roster.sourceId.split(':').includes('public-edited') ? input.roster.sourceId : input.roster.sourceId + ':public-edited';
  }
  const roster = copy as unknown as LivePhysicalRosterInputV1;
  // Reject the entire edit rather than clipping SI, changing unrelated values,
  // or making a cosmetic rating which the actual simulation cannot consume.
  applyLivePhysicalRosterV1({ players: input.reference.players, roster });
  return freeze({ policyId, roster, projection: projectLivePublicAbilitiesV1({ ...input, roster }), changes });
}
export function previewLivePublicLeagueV1(input: Readonly<{ roster: LivePhysicalRosterInputV1; reference: LivePublicAbilityReferenceV1; playerId: string; leagueId: string }>) {
  const { entry, anchor } = context(input);
  assert(['MLB', 'NLB', 'NPB', 'KBO', 'CUSTOM'].includes(input.leagueId), 'unsupported preview league');
  const candidates = input.reference.anchors.filter(a => a.leagueId === input.leagueId);
  const byId = new Map(input.roster.entries.map(e => [e.playerId, e]));
  return freeze({ leagueId: input.leagueId, sampleCount: candidates.length, metrics: specs.map(spec => {
    const peers = candidates.filter(a => spec.section !== 'pitcher' || a.role === 'P')
      .filter(a => spec.section !== 'batter' || a.role !== 'P');
    const values = peers.map(a => spec.mode === 'percent' ? numeric(byId.get(a.playerId)!, spec.components[0].path) : quality(byId.get(a.playerId)!, spec));
    const mean = values.reduce((sum, n) => sum + n, 0) / (values.length || 1);
    const sd = Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (values.length || 1));
    const actual = spec.mode === 'percent' ? numeric(entry, spec.components[0].path) : quality(entry, spec);
    return { id: spec.id, label: spec.label, sampleCount: values.length,
      value: values.length >= 2 && sd > 0 ? Math.max(0, Math.min(100, 50 + 20 * (actual - mean) / sd)) : null };
  }), sourceLeagueId: anchor.leagueId, basis: 'SUPPLIED_LOCAL_SAMPLE_NOT_OFFICIAL_LEAGUE_POPULATION' as const });
}
