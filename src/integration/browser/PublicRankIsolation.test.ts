import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { applyLivePhysicalRosterV1, type LivePhysicalRosterInputV1 } from './LivePhysicalRosterV1';
import { editLivePublicAbilityV1, materializeLivePlateVisionV1, previewLivePublicLeagueV1,
  projectLivePublicAbilitiesV1, type LivePublicAbilityReferenceV1 } from './LivePublicAbilitiesV1';
import { resolveFieldPracticePlayersV98, runFieldPracticeV98, type FieldPracticeRequestV98 } from './FieldPracticeWorkbenchV98';
import { createWorkbenchPlayer, defaultWorkbenchPlayer, exportWorkbenchPlayerSources, type WorkbenchLeagueId } from './WorkbenchPlayer';
import { createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

const load = <T>(name: string): T => JSON.parse(readFileSync('docs/demos/' + name, 'utf8'));
const reference = load<LivePublicAbilityReferenceV1>('live-public-ability-reference-v1.json');
const roster = materializeLivePlateVisionV1({ roster: load<LivePhysicalRosterInputV1>('live-game-roster-v98.json'), reference }).roster;
const playerId = '1-b1';
const resolve = (packet = roster, ref = reference) => applyLivePhysicalRosterV1({ players: ref.players, roster: packet }).players;
const practice = (players: ReturnType<typeof resolve>) => {
  const request = load<FieldPracticeRequestV98>('field-double-play-v106.json');
  return runFieldPracticeV98({ ...request, fieldInput: { ...request.fieldInput, players: resolveFieldPracticePlayersV98(players) } });
};

it('changes a synthetic league comparison from fielding D(55) to A(85) without changing any authored player', () => {
  // Four deliberately synthetic peers; these are NOT MLB/NPB measurements.
  const copy = structuredClone(roster), ref = structuredClone(reference), before = JSON.stringify(roster), target = copy.entries.find(e => e.playerId === playerId)!.physical!;
  const peers = copy.entries.filter(e => e.playerId !== playerId).slice(0, 4);
  for (const [index, delta] of [-.125, .075, -.275, -.075].entries()) {
    const peer = peers[index], leagueId = index < 2 ? 'MLB' : 'NPB';
    const anchor = ref.anchors.find(a => a.playerId === peer.playerId)!;
    Object.assign(anchor, { leagueId });
    Object.assign(peer.physical!, {
      reactionSeconds: (target.reactionSeconds! + .01) * Math.exp(-delta) - .01,
      defensiveDecisionSeconds: (target.defensiveDecisionSeconds! + .01) * Math.exp(-delta) - .01,
    });
  }
  for (const anchor of ref.anchors) if (!peers.some(p => p.playerId === anchor.playerId)) Object.assign(anchor, { leagueId: 'CUSTOM' });
  const packetBefore = JSON.stringify(copy), referenceBefore = JSON.stringify(ref), projections = ['MLB', 'NPB'].map(leagueId =>
    previewLivePublicLeagueV1({ roster: copy, reference: ref, playerId, leagueId }).metrics.find(m => m.id === 'field')!.value);
  expect(projections[0]).toBeCloseTo(55, 10); expect(projections[1]).toBeCloseTo(85, 10);
  expect(JSON.stringify(copy)).toBe(packetBefore); expect(JSON.stringify(ref)).toBe(referenceBefore);
  expect(copy.entries.find(e => e.playerId === playerId)).toEqual(roster.entries.find(e => e.playerId === playerId));
  expect(JSON.stringify(roster)).toBe(before);
});

it('isolates changed individual display anchors from all physical players, defensive traces and ordinary pitches', () => {
  const refs = [55, 85].map(field => {
    const ref = structuredClone(reference), anchor = ref.anchors.find(a => a.playerId === playerId)!;
    // Anchor SI equals current SI, so only the descriptive origin changes.
    Object.assign(anchor, { leagueId: field === 55 ? 'MLB' : 'NPB', entry: structuredClone(roster.entries.find(e => e.playerId === playerId)) });
    Object.assign(anchor.ratings, { field });
    return ref;
  });
  expect(refs.map(ref => projectLivePublicAbilitiesV1({ roster, reference: ref, playerId }).abilities.find(a => a.id === 'field')!.value)).toEqual([55, 85]);
  const players = refs.map(ref => resolve(roster, ref));
  expect(players[0]).toEqual(players[1]);
  const plays = players.map(practice);
  expect(plays[0].field.end.complete).toBe(true);
  const rules = plays[0].rules;
  if (!rules || rules.kind === 'unresolved') throw Error('ordinary defensive play did not resolve');
  expect(rules.outcomes.length).toBeGreaterThan(0);
  expect(plays[0]).toEqual(plays[1]);
  const fixture = liveMatchFixture(1234), command = { managedTeam: 0 as const, batting: 'contact' as const, pitchType: 'auto', location: 'auto' };
  const records = players.map(resolved => createLiveBaseballMatchV1({ ...fixture, players: resolved }).issuePitch(command));
  expect(records[0].frames.length).toBeGreaterThan(1); expect(records[0]).toEqual(records[1]);
});

it('never converts imported legacy relative ratings to physical execution or glove-toss eligibility', () => {
  const packets = [55, 85].map(field => ({ ...roster, entries: roster.entries.map(e => ({ ...e, legacyRelativeRatings: { field, arm: field, contact: field } })) }));
  const applied = packets.map(packet => applyLivePhysicalRosterV1({ players: reference.players, roster: packet }));
  expect(applied[0].players).toEqual(applied[1].players); expect(applied[0].players).toEqual(resolve());
  for (const output of applied) for (const player of output.audit.players) {
    expect(player.unsupported.filter(row => row.path.startsWith('legacyRelativeRatings.'))).toHaveLength(3);
    expect(player.projected.some(row => row.inputPath.startsWith('legacyRelativeRatings.'))).toBe(false);
  }
  expect(practice(applied[0].players)).toEqual(practice(applied[1].players));
});

it('keeps workbench SI and exported execution sources identical when only affiliation league changes', () => {
  const baseline = defaultWorkbenchPlayer(), baseSources = exportWorkbenchPlayerSources(baseline);
  for (const leagueId of ['MLB', 'NPB', 'NLB', 'KBO', 'CUSTOM'] as WorkbenchLeagueId[]) {
    const maker = createWorkbenchPlayer({ ...baseline, identity: { ...baseline.identity, leagueId } });
    const sources = exportWorkbenchPlayerSources(maker);
    for (const key of ['capability', 'repertoire', 'decision', 'equipment'] as const) expect(sources[key]).toEqual(baseSources[key]);
    const packet: LivePhysicalRosterInputV1 = { version: 'live_physical_roster_v1', sourceId: 'isolation-test', entries: [{ playerId, sourceId: 'same', workbenchPlayer: maker }] };
    const original = { ...packet, entries: [{ ...packet.entries[0], workbenchPlayer: baseline }] };
    expect(applyLivePhysicalRosterV1({ players: reference.players, roster: packet }).players)
      .toEqual(applyLivePhysicalRosterV1({ players: reference.players, roster: original }).players);
  }
});

it('keeps explicit vision absolute and makes legacy materialization independent of league membership', () => {
  const old = load<LivePhysicalRosterInputV1>('live-game-roster-v2.json'), expected = materializeLivePlateVisionV1({ roster: old, reference });
  for (const leagueId of ['MLB', 'NPB', 'CUSTOM']) {
    const ref = structuredClone(reference); ref.anchors.forEach(a => Object.assign(a, { leagueId }));
    expect(materializeLivePlateVisionV1({ roster: old, reference: ref })).toEqual(expected);
    expect(materializeLivePlateVisionV1({ roster, reference: ref }).roster).toEqual(roster);
    for (const entry of roster.entries) expect(previewLivePublicLeagueV1({ roster, reference: ref, playerId: entry.playerId, leagueId })
      .metrics.find(m => m.id === 'vision')!.basis).toBe('ABSOLUTE_1_TO_100');
  }
  // Positive control: an intentional maker ability edit must still change SI.
  const edited = editLivePublicAbilityV1({ roster, reference, playerId, abilityId: 'field', value: 90 });
  expect(edited.changes.length).toBeGreaterThan(0); expect(resolve(edited.roster)).not.toEqual(resolve());
});
