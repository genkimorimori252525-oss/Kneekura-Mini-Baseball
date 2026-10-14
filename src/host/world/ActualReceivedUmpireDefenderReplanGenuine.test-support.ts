import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';

export const receivedArtifactSha = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
export type ReceivedStageFile = Readonly<{ path: string; sha256: string }>;
export const readReceivedStageFile = (file: ReceivedStageFile) => {
  expect(isAbsolute(file.path)).toBe(true); expect(realpathSync(file.path)).toBe(file.path);
  const bytes = readFileSync(file.path); expect(receivedArtifactSha(bytes)).toBe(file.sha256); return bytes;
};
export type ReceivedStageInput = Readonly<{ schema: 'received_call_stage_input_v1'; kind: 'origin' | 'received';
  database: ReceivedStageFile; receipt: ReceivedStageFile; terminal: ReceivedStageFile; report?: ReceivedStageFile }>;
export const receivedStageInput = (kind: ReceivedStageInput['kind']) => {
  const path = process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT;
  if (!path || !isAbsolute(path) || realpathSync(path) !== path) throw new Error('pinned received-call stage input required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as ReceivedStageInput;
  expect(input.schema).toBe('received_call_stage_input_v1'); expect(input.kind).toBe(kind);
  const terminal = JSON.parse(readReceivedStageFile(input.terminal).toString('utf8'));
  expect(terminal).toMatchObject({ status: 'passed', originalChildExit: 0, remainingOwnedProcesses: [],
    tests: { passedCases: 1, expectedFailedCases: 0, skipped: [] } });
  expect(terminal.failures).toEqual([]);
  const receipt = JSON.parse(readReceivedStageFile(input.receipt).toString('utf8'));
  const bytes = readReceivedStageFile(input.database);
  if (kind === 'origin') {
    expect(terminal.stage).toBe('received-call-original-artifact-authentication');
    expect(input.database.sha256).toBe('691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810');
    expect(input.receipt.sha256).toBe('42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f');
    expect(input.terminal.sha256).toBe('6b4265f730765928ec2363a3db433573e9bdcdc1ad4ac538ef9104bcaed50ed4');
    expect(receipt).toMatchObject({ schema: 'received_call_original_artifact_authentication_v1',
      originalDatabaseSha256: input.database.sha256, sourceHistoricalCredit: 0, recoveredPR350Credit: 0, bridgeCredit: 0 });
  } else {
    expect(terminal.stage).toBe('received-call-prospective-extension');
    expect(terminal.artifacts).toEqual({ database: input.database, receipt: input.receipt });
    if (!input.report) throw new Error('qualified extension test report is missing');
    expect(input.report.sha256).toBe(terminal.tests.reportSha256);
    const report = JSON.parse(readReceivedStageFile(input.report).toString('utf8'));
    expect(report).toMatchObject({ success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 });
    expect(report.testResults).toHaveLength(1);
    expect(report.testResults[0].name.endsWith('/src/host/world/ActualReceivedUmpireDefenderReplanExtension.test.ts')).toBe(true);
    expect(report.testResults[0].assertionResults).toHaveLength(1);
    expect(report.testResults[0].assertionResults[0]).toMatchObject({
      fullName: 'extends the authenticated public origin through genuine scheduled and received observations without rewriting history',
      status: 'passed', failureMessages: [] });
    expect(receipt).toMatchObject({ schema: 'received_call_prospective_extension_v1',
      originalDatabaseSha256: '691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810',
      originalAuthenticationReceiptSha256: '42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f',
      outputDatabaseSha256: input.database.sha256, bridgeCredit: 0, recoveredPR350Credit: 0 });
    expect(receipt.completedStep).toBe('expected-input');
  }
  return { input, receipt, bytes };
};
export const receivedFreshOutput = () => {
  const output = process.env.BASEBALL_RECEIVED_CALL_STAGE_OUTPUT;
  if (!output || !isAbsolute(output) || existsSync(output)) throw new Error('fresh absolute received-call stage output required');
  return output;
};
const quote = (name: string) => '"'+name.replaceAll('"', '""')+'"';
export const receivedStageCensus = (db: DatabaseSync) => {
  const schema = db.prepare("SELECT * FROM main.sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const tables = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return { schema, tables: tables.map(row => ({ name: String(row.name), rows: db.prepare(`SELECT * FROM main.${quote(String(row.name))}`).all() })) };
};
type Census = ReturnType<typeof receivedStageCensus>;
// Freeze the six existing owner layouts admitted by this prospective fixture.
// Names alone do not authorize additional columns, weaker UNIQUE constraints,
// triggers, views or a different ownership schema.
const umpireColumns = `source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,
  umpire_id TEXT NOT NULL,dependency_source_id TEXT NOT NULL,current_execution_source_id TEXT,
  source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL`;
const newOwnerLayouts: Readonly<Record<string, string>> = {
  actual_first_base_umpire_setups: `${umpireColumns},UNIQUE(physical_pitch_source_id)`,
  actual_first_base_umpire_observations: `${umpireColumns},UNIQUE(dependency_source_id)`,
  actual_first_base_umpire_calls: `${umpireColumns},UNIQUE(dependency_source_id,current_execution_source_id)`,
  actual_communication_models: `source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,
    source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL`,
  actual_call_communications: `source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
    physical_pitch_source_id TEXT NOT NULL,call_source_id TEXT NOT NULL,model_source_id TEXT,current_execution_source_id TEXT NOT NULL,
    previous_source_id TEXT,revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
    UNIQUE(call_source_id,revision)`,
  actual_call_communication_heads: 'call_source_id TEXT PRIMARY KEY,source_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL',
};
/** Only actual owner INSERTs and their declared head progression are allowed. */
export const assertReceivedStageDelta = (before: Census, after: Census, additions: Readonly<Record<string, number>>,
  heads: readonly string[] = [], newTables: readonly string[] = []) => {
  expect(after.tables.map(t => t.name)).toEqual([...before.tables.map(t => t.name), ...newTables].sort());
  for (const row of before.schema) expect(after.schema).toContainEqual(row);
  for (const row of after.schema) if (!before.schema.some(original => JSON.stringify(original) === JSON.stringify(row))) {
    expect(row.type).toBe('table'); expect(newTables).toContain(String(row.name));
    const layout = newOwnerLayouts[String(row.name)]; expect(layout).toBeTypeOf('string');
    expect(String(row.sql).replace(/\s/g, '')).toBe(`CREATE TABLE ${row.name} (${layout})`.replace(/\s/g, ''));
  }
  for (const table of after.tables) {
    const original = before.tables.find(t => t.name === table.name)?.rows ?? [];
    expect(table.rows.length, table.name).toBe(original.length + (additions[table.name] ?? 0));
    if (heads.includes(table.name)) {
      expect(original).toHaveLength(1); expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual({ ...original[0], source_id: table.rows[0].source_id, revision: Number(original[0].revision) + 1 });
      expect(table.rows[0].source_id).not.toBe(original[0].source_id);
    } else for (const row of original) expect(table.rows, table.name).toContainEqual(row);
  }
};

export const receivedOwnerSteps = ['scheduled-call', 'call-due', 'operative-call', 'send', 'before-observation',
  'reception-cut', 'receive', 'after-observation', 'expected-input'] as const;
export type ReceivedOwnerStep = typeof receivedOwnerSteps[number];
type QualifiedCheckpoint = Readonly<{ database: ReceivedStageFile; receipt: ReceivedStageFile;
  terminal: ReceivedStageFile; report: ReceivedStageFile }>;
export const receivedOwnerStageInput = () => {
  const path = process.env.BASEBALL_RECEIVED_CALL_STAGE_INPUT;
  if (!path || !isAbsolute(path) || realpathSync(path) !== path) throw new Error('pinned received owner stage input required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as { schema: string; step: ReceivedOwnerStep;
    chain: QualifiedCheckpoint[]; originAuthentication: ReceivedStageFile };
  expect(input.schema).toBe('received_call_owner_stage_input_v1');
  const index = receivedOwnerSteps.indexOf(input.step); expect(index).toBeGreaterThan(0);
  expect(input.chain).toHaveLength(index);
  const receipts = input.chain.map((checkpoint, i) => {
    const terminal = JSON.parse(readReceivedStageFile(checkpoint.terminal).toString('utf8'));
    expect(terminal).toMatchObject({ status: 'passed', originalChildExit: 0, remainingOwnedProcesses: [], failures: [],
      tests: { passedCases: 1, expectedFailedCases: 0, skipped: [] } });
    expect(terminal.artifacts).toEqual({ database: checkpoint.database, receipt: checkpoint.receipt });
    expect(checkpoint.report.sha256).toBe(terminal.tests.reportSha256);
    const report = JSON.parse(readReceivedStageFile(checkpoint.report).toString('utf8'));
    expect(report).toMatchObject({ success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 });
    const receipt = JSON.parse(readReceivedStageFile(checkpoint.receipt).toString('utf8'));
    expect(receipt).toMatchObject({ completedStep: receivedOwnerSteps[i], outputDatabaseSha256: checkpoint.database.sha256,
      originalDatabaseSha256: '691c1640471fd268eea26c61f65699b7ca1c94566f4baa70344d86e0687ab810',
      originalAuthenticationReceiptSha256: '42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f',
      bridgeCredit: 0, recoveredPR350Credit: 0 });
    if (i === 0) {
      expect(terminal.stage).toBe('received-call-scheduled-checkpoint-authentication');
      expect(checkpoint.terminal.sha256).toBe('eeeb9bac1009ce6011be5897ca1fe2ae3e0f4ddfae35938fc186e7b9e28194f1');
      expect(checkpoint.receipt.sha256).toBe('4805b72e4b90853cdda45a368045f139c173a2d0de9da789c8112dcbe703bee2');
      expect(receipt.schema).toBe('received_call_scheduled_checkpoint_v1'); expect(receipt.failedRunPassCredit).toBe(0);
    } else {
      expect(terminal.stage).toBe('received-call-prospective-extension');
      expect(receipt.schema).toBe('received_call_owner_continuation_v1');
      expect(receipt.predecessorReceiptSha256).toBe(input.chain[i - 1].receipt.sha256);
    }
    return receipt;
  });
  expect(input.originAuthentication.sha256).toBe('42f7643108db8249abe1384854af739dbd59fb4b6dff4428314cb35f3d5d189f');
  const origin = JSON.parse(readReceivedStageFile(input.originAuthentication).toString('utf8'));
  const checkpoint = input.chain.at(-1)!, receipt = receipts.at(-1)!;
  return { input, checkpoint, receipt, origin, bytes: readReceivedStageFile(checkpoint.database) };
};
