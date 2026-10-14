import type { DatabaseSync } from 'node:sqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaTerminalEndpoint, SamePaTerminalProofMode, SamePaTerminalTransitionRead } from './SamePlateAppearanceTerminalEndpoint';
/** Author-lane module alias only while the separate endpoint component is in
 * development. Tests explicitly replace these throwing functions. Never an
 * accepted Source, production fallback or genuine physical proof. */
export const readSamePaTerminalEndpointFromSqlite = (_db: DatabaseSync, _reference: SamePaReference<'pa_terminal_v1_endpoints'>,
  _mode: SamePaTerminalProofMode): SamePaTerminalEndpoint => { throw new Error('structural test endpoint proof not installed'); };
export const readSamePaTerminalTransitionFromSqlite = (_db: DatabaseSync, _reference: SamePaReference<'pa_terminal_v1_endpoints'>,
  _mode: SamePaTerminalProofMode): SamePaTerminalTransitionRead => { throw new Error('structural test transition proof not installed'); };
