// Headless maker for calibration: the maker's public abilities, traits and swing angle, written through the same
// Core functions the maker page calls, so the two never drift apart.
// usage: node tools/maker/kbm-maker.mjs <native.js> <base-config.json> <spec.json> <out-config.json>
//
// Scale: every player's anchor is himself in the base config, rated ANCHOR_RATING on every group ability.
// With the MLB-average standard league as the base, 84 means MLB average (A); 100 points is a factor of e in the
// physical controls. Vision is the Core's own absolute 1-100 value. NPB is meant to sit in B and NLB in S (decided 2026-11-03).
//
// spec.json: {"players": {"<playerId>": {
//   "name", "heightMeters", "bats", "throws",            (optional identity)
//   "abilities": {"contact": 84, "power": 90, "run", "arm", "field", "transfer", "catching", "throwingAccuracy",
//                 "vision", "maxSpeedKmh", "control"},  (public maker values)
//   "attackAngleDegrees": 12,                            (swing angle at the middle of the zone; replaces the 4-step trajectory)
//   "traits": {"<familyId>": "<stateId>" | null},        (maker traits; null turns one off)
//   "physical": {...}                                    (raw SI for anything the maker shows only in detail)
// }}}
import {readFileSync, writeFileSync} from 'node:fs';

export const ANCHOR_RATING = 84;
const GROUP_ABILITIES = ['contact', 'power', 'run', 'arm', 'field', 'transfer', 'catching', 'throwingAccuracy', 'control'];

export function loadCore(nativePath) {
  globalThis.self = globalThis;
  (0, eval)(readFileSync(nativePath, 'utf8') + ';globalThis.__kbmCore=KneekuraNativeMatchCore;');
  return globalThis.__kbmCore;
}

export function makeRoster(core, base, spec) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const players = base.players.map(p => ({...clone(p), ...pick(spec.players?.[p.playerId], ['name', 'heightMeters', 'bats', 'throws'])}));
  const reference = {version: 'live_public_ability_reference_v1', policyId: 'individual-profile-public-authoring-v1', players,
    anchors: base.players.map(p => ({playerId: p.playerId, leagueId: 'MLB', role: /-p\d+$/.test(p.playerId) ? 'P' : 'B',
      ratings: Object.fromEntries(GROUP_ABILITIES.map(id => [id, ANCHOR_RATING])), entry: {playerId: p.playerId, sourceId: 'kbm-maker-anchor', physical: clone(p.physical)}}))};
  let roster = {version: 'live_physical_roster_v1', sourceId: 'kbm-maker', entries: players.map(p => {
    const physical = {...clone(p.physical), ...(spec.players?.[p.playerId]?.physical ?? {})};
    return {playerId: p.playerId, sourceId: 'kbm-maker', physical, ...(p.traitProfile ? {traitProfile: clone(p.traitProfile)} : {})};
  })};
  const log = [];
  for (const [playerId, want] of Object.entries(spec.players ?? {})) {
    if (!players.some(p => p.playerId === playerId)) throw Error('kbm-maker: unknown player ' + playerId);
    for (const [abilityId, value] of Object.entries(want.abilities ?? {})) {
      const result = core.editLivePublicAbilityV1({roster, reference, playerId, abilityId, value});
      roster = clone(result.roster);
      log.push({playerId, abilityId, value, changes: result.changes});
    }
    if (want.attackAngleDegrees !== undefined) {
      const entry = roster.entries.find(e => e.playerId === playerId);
      entry.physical.attackAngleDegrees = want.attackAngleDegrees;
      delete entry.physical.impactTrajectory;
      log.push({playerId, attackAngleDegrees: want.attackAngleDegrees});
    }
    for (const [familyId, stateId] of Object.entries(want.traits ?? {})) {
      roster = clone(core.setLiveTraitProfileV77({roster, playerId, familyId, stateId}).roster);
      log.push({playerId, familyId, stateId});
    }
  }
  core.applyLivePhysicalRosterV1({players, roster});
  return {players, roster, reference, log};
}

export function publicAbilities(core, made, playerId) {
  return core.projectLivePublicAbilitiesV1({roster: made.roster, reference: made.reference, playerId}).abilities
    .map(a => ({id: a.id, label: a.label, value: Math.round(a.value * 10) / 10}));
}

function pick(object, keys) {
  return Object.fromEntries(keys.filter(k => object?.[k] !== undefined).map(k => [k, object[k]]));
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/maker/kbm-maker.mjs')) {
  const [nativePath, basePath, specPath, outPath] = process.argv.slice(2);
  const core = loadCore(nativePath), base = JSON.parse(readFileSync(basePath, 'utf8')), spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const made = makeRoster(core, base, spec);
  const byId = new Map(made.roster.entries.map(e => [e.playerId, e]));
  const out = {...base, players: made.players.map(p => {const e = byId.get(p.playerId); const {traitProfile, ...rest} = p;
    return {...rest, physical: e.physical, ...(e.traitProfile ? {traitProfile: e.traitProfile} : {})};})};
  writeFileSync(outPath, JSON.stringify(out));
  for (const playerId of Object.keys(spec.players ?? {}))
    console.log(playerId, publicAbilities(core, made, playerId).map(a => `${a.label}${a.value}`).join(' '));
}
