import type { DatabaseSync } from 'node:sqlite';

/** A host source owner validates evidence on the writer's connection, including uncommitted trigger changes. */
export type SqliteEvidenceGuard<T> = (database: Pick<DatabaseSync, 'prepare'>, input: T,
  phase: 'write' | 'written' | 'retry') => void;
