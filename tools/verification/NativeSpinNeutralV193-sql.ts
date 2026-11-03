import { createHash } from 'node:crypto';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';

const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const scalar = (value: SQLOutputValue) => {
  if (value === null) return ['null'];
  if (typeof value === 'bigint') return ['integer', String(value)];
  if (typeof value === 'number') { const bytes = Buffer.alloc(8); bytes.writeDoubleBE(value); return ['float64', bytes.toString('hex')]; }
  if (typeof value === 'string') return ['text', value];
  if (value instanceof Uint8Array) return ['blob', Buffer.from(value).toString('hex')];
  throw Error('unexpected SQLite scalar');
};

/** Read-only forensic equality, including rowid locators. Not an owner proof. */
export const rawNativeSpinNeutralSqlDigestV193 = (db: DatabaseSync, rowidThrough?: Readonly<Record<string, bigint>>) => {
  const catalog = db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();
  const schemaTables = db.prepare('PRAGMA main.table_list').all();
  const tables: Record<string, { rows: number; columns: string[]; rowIdentity: string; sha256: string }> = Object.create(null);
  for (const row of catalog.filter(row => row.type === 'table')) {
    const info = db.prepare('PRAGMA main.table_xinfo(' + quote(String(row.name)) + ')').all();
    const columns = info.filter(column => column.hidden !== 1).map(column => String(column.name));
    const schema = schemaTables.filter(table => table.schema === 'main' && table.name === row.name);
    if (schema.length !== 1) throw Error('table schema attribute missing or ambiguous: ' + row.name);
    const withoutRowid = schema[0].wr === 1;
    const rowid = ['rowid', '_rowid_', 'oid'].find(alias => !columns.some(name => name.toLowerCase() === alias));
    if (!withoutRowid && !rowid) throw Error('no unshadowed rowid locator: ' + row.name);
    let alias = '__native_spin_rowid_v193__';
    while (columns.some(name => name.toLowerCase() === alias.toLowerCase())) alias += '_';
    const order = withoutRowid ? info.filter(column => Number(column.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk))
      .map(column => quote(String(column.name))).join(',') : quote(rowid!);
    const through = !withoutRowid && rowidThrough && Object.hasOwn(rowidThrough, String(row.name)) ? rowidThrough[String(row.name)] : undefined;
    const statement = db.prepare('SELECT ' + (withoutRowid ? '*' : quote(rowid!) + ' AS ' + quote(alias) + ',*')
      + ' FROM main.' + quote(String(row.name)) + (through === undefined ? '' : ' WHERE ' + quote(rowid!) + '<=?') + ' ORDER BY ' + order);
    statement.setReadBigInts(true);
    const hash = createHash('sha256'); let count = 0;
    for (const record of through === undefined ? statement.iterate() : statement.iterate(through)) {
      hash.update(JSON.stringify([withoutRowid ? null : scalar(record[alias]), columns.map(column => scalar(record[column]))]) + '\n'); count++;
    }
    tables[String(row.name)] = { rows: count, columns, rowIdentity: withoutRowid ? 'PRIMARY_KEY' : 'ROWID', sha256: hash.digest('hex') };
  }
  return { catalog, catalogSha256: createHash('sha256').update(JSON.stringify(catalog)).digest('hex'), tables };
};
