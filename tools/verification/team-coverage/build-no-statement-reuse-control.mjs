import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const input = resolve(process.argv[2]), output = resolve(process.argv[3]);
assert.ok(!existsSync(output));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = readFileSync(input, 'utf8');
assert.equal(sha(original), 'fd6aab65f7c90049da228ead8a5a5fc22d56a71a02cbe57683b64c7553b4a371');
const moduleStart = original.indexOf('// src/host/world/SqliteMetadataStatementScope.ts\n');
assert.ok(moduleStart >= 0);
const readStart = original.indexOf('var read = (db, sql, execute) => {\n', moduleStart);
const readEnd = original.indexOf('\nvar sqliteMetadataGet = ', readStart);
assert.ok(readStart > moduleStart && readEnd > readStart);
const before = original.slice(readStart, readEnd);
assert.equal(before, `var read = (db, sql, execute) => {
  const statements = scopes.get(db), cached = statements?.get(sql);
  statements?.delete(sql);
  const statement = cached ?? db.prepare(sql);
  try {
    return execute(statement);
  } finally {
    statements?.set(sql, statement);
  }
};`);
const after = 'var read = (db, sql, execute) => execute(db.prepare(sql));';
const modified = original.slice(0, readStart) + after + original.slice(readEnd);
// Transform the retained bundle, not current shared imports: this controls for
// concurrent production changes. The plugin changes this module's read alone.
await build({ entryPoints: [input], outfile: output, platform: 'node', format: 'esm', target: 'node26',
  bundle: false, sourcemap: false,
  plugins: [{ name: 'diagnostic-no-metadata-statement-reuse', setup(builder) {
    builder.onLoad({ filter: /team-retained-readonly-entry-20261016\.mjs$/ }, args => {
      assert.equal(resolve(args.path), input); return { contents: modified, loader: 'js' };
    });
  } }],
});
assert.equal(sha(readFileSync(input)), sha(original));
const receipt = { status: 'BUILT_DIAGNOSTIC_ONLY_NO_STATEMENT_REUSE', input, inputHash: sha(original),
  output, outputHash: sha(readFileSync(output)), before, after, modifiedPreTransformHash: sha(modified),
  changedModule: 'src/host/world/SqliteMetadataStatementScope.ts', productionEdited: false,
  resultCache: false, ownerValidationChanges: false, teamExecutionCredit: 0 };
writeFileSync(output + '.build.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
