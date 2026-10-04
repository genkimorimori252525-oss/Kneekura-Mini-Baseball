import { expect, it, vi } from 'vitest';
import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { battedFirstFielderTouchEvidenceFromSqlite } from './SqliteBattedFirstFielderTouchStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { battedWorldResponseInput, battedWorldContinuationEvidenceFromSqlite } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionPrimitiveCommands } from './SqliteBattedWorldMotionStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
const state = vi.hoisted(() => ({ flight: null as any, world: null as any, response: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedWorldContactStore', async load => ({ ...await load<object>(),
  battedWorldContactEvidenceFromSqlite: vi.fn() }));
// Upstream owners are mocked only for direct downstream admission tests. The supplied physical contact is genuine Core output.
vi.mock('./SqliteBattedFirstFielderTouchStore', async load => ({ ...await load<object>(),
  battedFirstFielderTouchEvidenceFromSqlite: vi.fn() }));
vi.mock('./SqliteBattedContactResponseStore', async load => ({ ...await load<object>(),
  battedContactResponseEvidenceFromSqlite: vi.fn() }));

it.each(['touch', 'response', 'continuation', 'response_input', 'motion', 'field_prefix'])
('fails closed for unsupported owned-runner %s before consuming physical state', async kind => {
  const x = prePitchRunnerContactFixture(); state.flight = x.flight;
  const contactModule = await vi.importActual<typeof import('./SqliteBattedWorldContactStore')>('./SqliteBattedWorldContactStore');
  const touchModule = await vi.importActual<typeof import('./SqliteBattedFirstFielderTouchStore')>('./SqliteBattedFirstFielderTouchStore');
  const responseModule = await vi.importActual<typeof import('./SqliteBattedContactResponseStore')>('./SqliteBattedContactResponseStore');
  try {
    state.world = contactModule.battedWorldContactEvidenceFromSqlite(x.db).derive(x.source, x.model, null);
    state.response = { source: { sourceId: 'response' }, touch: { worldContact: state.world }, model: { actors: [], surfaces: [] } };
    vi.mocked(battedWorldContactEvidenceFromSqlite).mockReturnValue({ read: () => state.world } as any);
    vi.mocked(battedFirstFielderTouchEvidenceFromSqlite).mockReturnValue({ read: () => state.response.touch } as any);
    vi.mocked(battedContactResponseEvidenceFromSqlite).mockReturnValue({ read: () => state.response } as any);
    x.db.exec(`CREATE TABLE batted_world_continuations(physical_pitch_source_id TEXT, revision INTEGER);
      CREATE TABLE batted_world_continuation_heads(physical_pitch_source_id TEXT);`);
    const run = () => {
      if (kind === 'touch') return touchModule.battedFirstFielderTouchEvidenceFromSqlite(x.db).derive({ sourceId: 'touch', sourceVersion: 'v1', worldContactSourceId: 'contact' });
      if (kind === 'response') return responseModule.battedContactResponseEvidenceFromSqlite(x.db).derive({ firstFielderTouchSourceId: 'touch' } as any, {} as any);
      if (kind === 'continuation') return battedWorldContinuationEvidenceFromSqlite(x.db).derive({ sourceId: 'continuation', sourceVersion: 'v1', responseSourceId: 'response', previousContinuationSourceId: null, throughTick: 9_000_000 });
      if (kind === 'response_input') return battedWorldResponseInput(state.response);
      if (kind === 'motion') return battedWorldMotionPrimitiveCommands(state.response, []);
      return battedWorldFieldPhysicalPrefix({ baseField: { response: state.response } as any, fields: [], executions: [] });
    };
    expect(run).toThrow(/unsupported original pre-pitch runner consumer/);
  } finally { x.db.close(); }
});
