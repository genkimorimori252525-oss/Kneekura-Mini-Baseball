import { receivedEnrollmentInput, receivedAvailabilityInput, receivedReplanInput } from './ActualReceivedUmpireDefender';
import { receivedOwnerSchema, receivedOwnerTables, type ReceivedOwnerTable } from './ActualReceivedUmpireDefenderSchema';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { renewalOwnerSchema, renewalOwnerTables } from './ActualReceivedUmpireRenewalSchema';
import { renewalEnrollmentInput, renewalDecisionInput, renewalMotorInput } from './ActualReceivedUmpireRenewal';
type Db = Pick<import('node:sqlite').DatabaseSync, 'prepare'>;
export type ReceivedClaimScope = Readonly<{gameId: string; playId: number; physicalPitchSourceId?: string}>;
export type ReceivedDefenderClaim = Readonly<{owner: ReceivedOwnerTable; row: Record<string, unknown>}>;
const E = 'actual_received_umpire_defender_enrollments', A = 'actual_received_umpire_defender_policy_availabilities',
  R = 'actual_received_umpire_defender_replans', H = 'actual_received_umpire_defender_replan_heads', J = 'actual_received_umpire_defender_admissions';
const P = 'physical_pitch_progress_actions', T = 'actual_live_play_runtimes', X = 'batted_world_field_executions', O = 'actual_field_observations',
  D = 'actual_defensive_decisions', M = 'actual_locomotion_receipts', C = 'actual_call_communications', U = 'actual_first_base_umpire_calls';
const NE = 'actual_received_umpire_renewal_enrollments', ND = 'actual_received_umpire_renewal_decisions', NM = 'actual_received_umpire_renewal_motors',
  NH = 'actual_received_umpire_renewal_heads', NJ = 'actual_received_umpire_renewal_admissions';
const originals = [P, T, X, O, D, M, C, U] as const;
const referenceFields: Readonly<Record<string, string>> = {
  runtimeSourceId: T, runtime_source_id: T, physicalPitchSourceId: P, physical_pitch_source_id: P,
  currentExecutionSourceId: X, current_execution_source_id: X, executionSourceId: X, execution_source_id: X,
  predecessorAdoptionSourceId: X, adoptionSourceId: X, predecessorDecisionSourceId: D, decisionSourceId: D, decision_source_id: D,
  predecessorMotorSourceId: M, motorSourceId: M, motor_source_id: M, observationSourceId: O, observation_source_id: O, originObservationSourceId: O,
  communicationSourceId: C, communication_source_id: C, originCommunicationSourceId: C, origin_communication_source_id: C,
  callSourceId: U, call_source_id: U, enrollmentSourceId: E, enrollment_source_id: E,
  previousReplanSourceId: R, originProcessSourceId: R, processSourceId: R, origin_process_source_id: R,
  policySourceId: A, policy_source_id: A,
  receivedEnrollmentSourceId: E, received_enrollment_source_id: E, receivedReplanSourceId: R, received_replan_source_id: R,
  renewalEnrollmentSourceId: NE, renewal_enrollment_source_id: NE, renewalDecisionSourceId: ND, renewal_decision_source_id: ND,
  renewalMotorSourceId: NM, renewal_motor_source_id: NM, physicalPredecessorSourceId: X, physical_predecessor_source_id: X,
  adoption_source_id: X,previousExecutionSourceId:X,
};
const anchorFields: Readonly<Record<string, string>> = {runtime: T, execution: X, observation: O, originObservation: O,
  decision: D, motor: M, adoption: X, communication: C, call: U,physicalPredecessor:X,receivedEnrollment:E,receivedReplan:R};
const reference = (owner: string, sourceId: unknown) => typeof sourceId === 'string' && sourceId.trim() === sourceId && sourceId.length
  ? JSON.stringify([owner, sourceId]) : null;
type Node = {owner: string; row: Record<string, unknown>; links: Set<string>; games: Set<string>; plays: Set<number>; pitches: Set<string>};
const add = (node: Node, owner: string, id: unknown) => { const value = reference(owner, id); if (value) node.links.add(value); };
const leaf = (node: Node, key: string, value: unknown) => {
  if (key === 'gameId' || key === 'game_id') { if (typeof value === 'string') node.games.add(value); }
  else if (key === 'playId' || key === 'play_id') { if (Number.isSafeInteger(value)) node.plays.add(value as number); }
  if (key === 'physicalPitchSourceId' || key === 'physical_pitch_source_id') { if (typeof value === 'string') node.pitches.add(value); }
  const owner = referenceFields[key]; if (owner) add(node, owner, value);
  if (key === 'previous_source_id' && node.owner === R) add(node, R, value);
  if (key === 'previous_source_id' && node.owner === X) add(node, X, value);
};
/** SQLite enumerates escaped and duplicate keys; JS never JSON.parses discovery authority. */
const document = (db: Db, node: Node, raw: unknown, snapshot: boolean) => {
  if (typeof raw !== 'string' || db.prepare('SELECT json_valid(?) AS valid').get(raw)!.valid !== 1) {
    throw new Error('received defender ownership metadata JSON is invalid');
  }
  // Select identity leaves in SQLite, without materializing physical payloads.
  const keys = [...Object.keys(referenceFields), 'gameId', 'playId',...(node.owner===X?['previous_source_id']:[])];
  const selected = db.prepare(`SELECT key,atom,type FROM json_tree(?) WHERE type IN ('text','integer') AND key IN (${keys.map(() => '?').join(',')})`).all(raw, ...keys);
  for (const item of selected) leaf(node, String(item.key), item.atom);
  const ownPaths: (string | {array: 'all'})[][] = snapshot ? [['source'], ['history', {array: 'all'}]] : [[]];
  for (const path of ownPaths) {
    const identities = db.prepare(`WITH document(value) AS (VALUES(?)) SELECT field.atom FROM (${nodes('(SELECT value FROM document)', [...path, 'sourceId'])}) field WHERE field.type='text'`).all(raw);
    for (const identity of identities) add(node, node.owner === H ? R : node.owner, identity.atom);
    const expected = node.owner === E ? 'received_umpire_defender_enrollment_v1' : node.owner === A
      ? 'received_umpire_defender_policy_availability_v1' : node.owner === R ? 'received_umpire_defender_replan_v2'
      : node.owner === NE ? 'received_umpire_renewal_enrollment_v1' : node.owner === ND ? 'received_umpire_renewal_decision_v1'
      : node.owner === NM ? 'received_umpire_renewal_motor_v1' : null;
    if (expected) {
      const capabilities = db.prepare(`WITH document(value) AS (VALUES(?)) SELECT field.type,field.atom FROM (${nodes('(SELECT value FROM document)', [...path, 'capability'])}) field`).all(raw);
      if (capabilities.some(value => value.type !== 'text' || value.atom !== expected)) throw new Error('received defender capability version metadata is unsupported');
    }
  }
  const refs: [string[], string][] = Object.entries(anchorFields).map(([key, owner]) => [['anchor', key, 'sourceId'], owner]);
  for (const root of [['input'], ['replan', 'originEvidence'], ['input', 'previous', 'originEvidence']]) {
    refs.push([[...root, 'observation', 'sourceId'], O], [[...root, 'communication', 'sourceId'], C],
      [[...root, 'predecessor', 'command', 'sourceId'], D], [[...root, 'predecessor', 'motor', 'sourceId'], M]);
  }
  refs.push([['input', 'policy', 'sourceId'], A], [['replan', 'policyBinding', 'policy', 'sourceId'], A],
    [['input', 'previous', 'policyBinding', 'policy', 'sourceId'], A]);
  if (snapshot) for (const [path, owner] of refs) {
    const identities = db.prepare(`WITH document(value) AS (VALUES(?)) SELECT field.atom FROM (${nodes('(SELECT value FROM document)', path)}) field WHERE field.type='text'`).all(raw);
    for (const identity of identities) add(node, owner, identity.atom);
  }
};
const nodeFor = (db: Db, owner: string, row: Record<string, unknown>): Node => {
  const node: Node = { owner, row, links: new Set(), games: new Set(), plays: new Set(), pitches: new Set() };
  for (const [key, value] of Object.entries(row)) leaf(node, key, value);
  if (owner === J) {
    if (![E, A, R].includes(String(row.owner))) throw new Error('received defender journal owner metadata is unsupported');
    add(node, String(row.owner), row.source_id);
  } else if (owner === NH || owner === NJ) {
    if (![NE,ND,NM,X].includes(String(row.owner))) throw new Error('received renewal head or journal owner metadata is unsupported');
    add(node,String(row.owner),row.source_id);
  } else add(node, owner === H ? R : owner, row.source_id);
  for (const [key, snapshot] of [['source_json', false], ['snapshot_json', true]] as const) if (key in row) document(db, node, row[key], snapshot);
  if ([E,A,R].includes(owner)) {
    // Discovery above uses SQLite's duplicate-preserving metadata traversal.
    // Parse only the small accepted Source to reject undecidable/unsupported
    // wires; no links or scope authority are taken from this parse.
    try {
      const validate=owner===E?receivedEnrollmentInput:owner===A?receivedAvailabilityInput:receivedReplanInput;
      const source=validate(JSON.parse(String(row.source_json)),String(row.source_id));
      if(JSON.stringify(source)!==row.source_json)throw new Error('noncanonical Source');
    } catch(error) { throw new Error('received defender pending invalid Source metadata', {cause:error}); }
  }
  if ([NE,ND,NM].includes(owner)) {
    try {
      const validate=owner===NE?renewalEnrollmentInput:owner===ND?renewalDecisionInput:renewalMotorInput;
      const source=validate(JSON.parse(String(row.source_json)),String(row.source_id));
      if(JSON.stringify(source)!==row.source_json)throw new Error('noncanonical Source');
    } catch(error) { throw new Error('received renewal pending invalid Source metadata',{cause:error}); }
  }
  if (owner === P) { const own = row.source_id; if (typeof own === 'string') node.pitches.add(own); }
  return node;
};
const direct = (node: Node, scope: ReceivedClaimScope) => scope.physicalPitchSourceId !== undefined && node.pitches.has(scope.physicalPitchSourceId)
  || node.games.has(scope.gameId) && node.plays.has(scope.playId);
/** Finite, namespace-qualified claim closure only. No receipt replay, current
 * physical qualification, queue settlement or mutation occurs in this module. */
export type ReceivedUnionClaim = Readonly<{owner:string;row:Record<string,unknown>}>;
const physicalRenewalRow=(db:Db,row:Record<string,unknown>):boolean=>['source_json','snapshot_json'].some(key=>{
  if(!(key in row))return false;
  if(typeof row[key]!=='string'||db.prepare('SELECT json_valid(?) AS valid').get(row[key])!.valid!==1)throw new Error('received renewal physical ownership metadata JSON is invalid');
  return !!db.prepare("SELECT 1 FROM json_tree(?) WHERE (key IN ('renewalEnrollmentSourceId','renewalMotorSourceId','renewalDecisionSourceId') AND type='text') OR (key='kind' AND type='text' AND atom LIKE 'received_renewal_%') LIMIT 1").get(row[key]);
});
const claims = (db: Db, scope: ReceivedClaimScope | null, references: readonly Readonly<{owner: string; sourceId: string}>[] = [], union=false): readonly ReceivedUnionClaim[] => {
  const old=receivedOwnerSchema(db);
  // Family readers keep their original five-owner census. Fresh ingress always
  // inspects both namespaces and physical survivors, independently of old state.
  if (!union && old === 'pristine') return [];
  const renewed=union?renewalOwnerSchema(db):'pristine';
  const tables=[...(old==='installed'?receivedOwnerTables:[]),...(renewed==='installed'?renewalOwnerTables:[])];
  const extension = tables.flatMap(owner => db.prepare(`SELECT * FROM main.${owner}`).all().map(row => nodeFor(db, owner, row)));
  if (!union && !extension.length) return [];
  if(union&&!extension.length){
    // With no extension rows, unrelated legacy payloads keep their own reader's
    // validation boundary. Only a surviving new physical action requires graph
    // traversal; neither family's absence can hide that action.
    const schema=db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(X);
    if(!schema.length)return [];
    if(schema.length!==1||schema[0].type!=='table'||schema[0].name!==X)throw new Error('received renewal physical owner schema differs');
    if(!db.prepare(`SELECT * FROM main.${X}`).all().some(row=>physicalRenewalRow(db,row)))return [];
  }
  const original: Node[] = [];
  for (const owner of originals) {
    const schemas = db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(owner);
    if (!schemas.length) continue;
    if (schemas.length !== 1 || schemas[0].type !== 'table' || schemas[0].name !== owner) throw new Error('received defender original owner metadata schema differs');
    for (const row of db.prepare(`SELECT * FROM main.${owner}`).all()) original.push(nodeFor(db, owner, row));
  }
  const physicalRenewals = union ? original.filter(node => node.owner===X && physicalRenewalRow(db,node.row)) : [];
  const discoverable=[...extension,...physicalRenewals];
  if (!discoverable.length) return [];
  const known = new Set<string>();
  for (const item of references) {
    if (![...originals,E,A,R,...(union?[NE,ND,NM]:[])].includes(item.owner) || !reference(item.owner, item.sourceId)) throw new Error('invalid received defender original reference');
    known.add(reference(item.owner, item.sourceId)!);
  }
  if (scope?.physicalPitchSourceId !== undefined) known.add(reference(P, scope.physicalPitchSourceId)!);
  const seeds = original.filter(node => scope !== null && direct(node, scope));
  for (const node of seeds) for (const link of node.links) known.add(link);
  if (!known.size) throw new Error('received defender original game/play scope metadata cannot be resolved');
  const all = [...original, ...extension], found = new Set<Node>(); let grew = true;
  while (grew) {
    grew = false;
    for (const node of all) if (!found.has(node) && (scope !== null && direct(node, scope) || [...node.links].some(link => known.has(link)))) {
      found.add(node); grew = true; for (const link of node.links) known.add(link);
    }
  }
  return discoverable.filter(node => found.has(node)).map(node => ({ owner: node.owner, row: node.row }));
};
export const receivedDefenderClaims = (db: Db, scope: ReceivedClaimScope) => claims(db, scope) as readonly ReceivedDefenderClaim[];
export const receivedDefenderReferenceClaims = (db: Db, references: readonly Readonly<{owner: string; sourceId: string}>[]) => claims(db, null, references) as readonly ReceivedDefenderClaim[];
export const receivedUnionClaims = (db: Db, scope: ReceivedClaimScope) => claims(db,scope,[],true);
export const receivedUnionReferenceClaims = (db: Db, references: readonly Readonly<{owner:string;sourceId:string}>[]) => claims(db,null,references,true);
/** Renewal family conservation projects only its five owner tables. The physical
 * adoption's separate namespaced receipt is checked by its journal directly. */
export const receivedRenewalClaims = (db:Db,scope:ReceivedClaimScope) => receivedUnionClaims(db,scope).filter(c=>(renewalOwnerTables as readonly string[]).includes(c.owner));
export const assertNoReceivedDefenderReferenceClaims = (db: Db, references: readonly Readonly<{owner: string; sourceId: string}>[]): void => {
  if (receivedUnionReferenceClaims(db,references).length) throw new Error('received defender pending enrollment or extension ownership blocks fresh terminal admission');
};
export const assertNoReceivedDefenderClaims = (db: Db, scope: ReceivedClaimScope): void => {
  if (receivedUnionClaims(db, scope).length) throw new Error('received defender pending enrollment or extension ownership blocks fresh live admission');
};
