import type { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { foulApplicationOwnershipRows as rows } from './ActualFoulTerminalApplicationOwnership';
import { originalFoulMetadataValues as values } from './OriginalFoulOwnershipMetadata';
import { assertSamePaTerminalEndpointStorage } from './SamePlateAppearanceTerminalStorage';
import { samePaSettlementMetadataIdentity as claim } from './SamePlateAppearanceTerminalSettlementStorage';
import { readSamePaTransitionArchive, readSamePaTerminalTransitionFromSqlite } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { readSamePaTerminalReleaseFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

type Db = Pick<DatabaseSync, 'prepare'>;
/** Shared activation/history fence. An ordinary application envelope belonging
 * to a reserved PA needs its completed transition and actual lease release. */
export const assertSamePaTerminalApplicationCompleted = (db: Db, applicationId: string, allowFinal = false): void => {
  const roots = rows(db, 'same_pa_enrollments', { game_id: 'TEXT', play_id: 'INTEGER', snapshot_json: 'TEXT' });
  const installed = assertSamePaTerminalEndpointStorage(db);
  if (!roots.length && !installed) return;
  const applications = rows(db, 'applications', { application_id: 'TEXT', match_id: 'TEXT', result_json: 'TEXT' });
  const selected = applications.filter(r => r.application_id === applicationId || values(db, String(r.result_json), ['receipt', 'applicationId']).includes(applicationId));
  const claims = roots.filter(root => selected.some(app => {
    const games = [app.match_id], plays = values(db, String(app.result_json), ['receipt', 'previousPlayId']);
    return (games.includes(root.game_id) || games.some(game => values(db, String(root.snapshot_json), ['gameId']).some(value => value === game)))
      && (plays.some(play => play === root.play_id) || plays.some(play => values(db, String(root.snapshot_json), ['playId']).includes(play)));
  }));
  const transitions = installed ? db.prepare(`SELECT source_id FROM main.pa_terminal_v1_transitions WHERE application_id=$app
    OR ${claim('source_json', ['applicationId'], '$app')} OR ${claim('snapshot_json', ['source', 'applicationId'], '$app')}
    OR ${claim('snapshot_json', ['official', 'receipt', 'applicationId'], '$app')}`).all({ app: applicationId }) : [];
  if (!claims.length && !transitions.length) return;
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || selected.length !== 1 || selected[0].application_id !== applicationId || claims.length !== 1 || transitions.length !== 1)
    throw new Error('same-PA activation has incomplete or conflicting terminal ownership');
  withBattedVenueLegalReadSnapshot(db, () => {
    const archived = readSamePaTransitionArchive(db, String(transitions[0].source_id));
    if (!archived || archived.source.applicationId !== applicationId || archived.lineage.enrollmentReference.sourceId !== claims[0].source_id)
      throw new Error('same-PA activation original transition differs');
    const transition = readSamePaTerminalTransitionFromSqlite(db, archived.source.terminalReference, 'historical');
    const release = readSamePaTerminalReleaseFromSqlite(db, archived.lineage.enrollmentReference.sourceId);
    if (transition.kind !== 'completed' || !release || json(release.transitionReference) !== json(transition.reference))
      throw new Error('same-PA activation requires completed transition and reservation release');
    if (!allowFinal && transition.completion === 'game_final') throw new Error('same-PA final transition has no activation');
  });
};
