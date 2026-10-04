export type SqliteJsonMetadataPath = readonly (string | Readonly<{ array: 'all' | 'last' }>)[];
type Scalar = string | number | boolean | null;
type Field = [string, string, string | number | null];
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
const validDocument = (document: string) => `CASE WHEN json_valid(${document}) THEN ${document} ELSE 'null' END`;

/** SQL expressions/paths are caller-owned schema references, never supplied identity values.
 * Enumerate every occurrence, including decoded duplicate keys and duplicate containers.
 * Invalid JSON and wrong container types yield no descendants; they are not reinterpreted.
 * Callers choose relevant rows and enforce metadata cardinality/types there, not globally.
 */
export const sqliteJsonMetadataNodes = (document: string, path: SqliteJsonMetadataPath = []): string => {
  const valid = validDocument(document);
  let query = `SELECT ${valid} AS value,json_type(${valid}) AS type,
    CASE WHEN json_type(${valid}) NOT IN ('object','array') THEN json_extract(${valid},'$') END AS atom`;
  for (const [index, step] of path.entries()) {
    const parent = `metadata_parent_${index}`, child = `metadata_child_${index}`;
    const object = typeof step === 'string';
    const container = `CASE WHEN ${parent}.type='${object ? 'object' : 'array'}'
      THEN ${parent}.value ELSE '${object ? '{}' : '[]'}' END`;
    const selection = object ? `${child}.key=${quote(step)}` : step.array === 'last'
      ? `${child}.key=json_array_length(${container})-1` : '1';
    query = `SELECT ${child}.value,${child}.type,${child}.atom FROM (${query}) ${parent},
      json_each(${container}) ${child} WHERE ${selection}`;
  }
  return query;
};

/** Project only configured metadata keys, preserving duplicates and JSON types.
 * Structured values have no projected payload; a caller can reject their type.
 * The optional SQLite path selects one container; use Nodes first whenever duplicate
 * ancestor containers must be discovered or their cardinality must be checked.
 */
export const sqliteJsonMetadataProjection = (document: string, keys: readonly string[], path = '$'): string =>
  `(SELECT json_group_array(json_array(metadata_field.key,metadata_field.type,
    CASE WHEN metadata_field.type NOT IN ('object','array') THEN metadata_field.atom END))
    FROM json_each(${validDocument(document)},${quote(path)}) metadata_field
    WHERE metadata_field.key IN (${keys.map(quote).join(',')}))`;

/** Exact selected-key metadata match; missing, duplicate and mistyped fields fail.
 * This validates metadata only, not a complete Source, payload, hash or authorization.
 */
export const sqliteJsonMetadataMatches = (projection: string | null, expected: Readonly<Record<string, Scalar>>): boolean => {
  if (projection === null) return false;
  const sort = (fields: Field[]) => fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const wanted: Field[] = Object.entries(expected).map(([key, value]) => [key,
    value === null ? 'null' : typeof value === 'string' ? 'text' : typeof value === 'boolean' ? String(value)
      : Number.isInteger(value) ? 'integer' : 'real', typeof value === 'boolean' ? Number(value) : value]);
  return JSON.stringify(sort(JSON.parse(projection) as Field[])) === JSON.stringify(sort(wanted));
};
