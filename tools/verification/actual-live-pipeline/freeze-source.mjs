import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { requireAbsolute, git, sourceFiles, writeNewJson, fileHash } from './pipeline-common.mjs';
const [rawRoot, commit, output] = process.argv.slice(2);
assert.match(commit ?? '', /^[a-f0-9]{40}$/);
const sourceRoot = realpathSync(requireAbsolute(rawRoot, 'sourceRoot'));
assert.equal(git(sourceRoot, 'rev-parse', 'HEAD'), commit);
assert.equal(git(sourceRoot, 'diff', '--name-only', 'HEAD'), '');
const files = sourceFiles(sourceRoot);
writeNewJson(requireAbsolute(output, 'manifest output'), { schema: 'actual_artifact_pipeline_source_v1', sourceRoot, sourceCommit: commit,
  sourceTree: git(sourceRoot, 'rev-parse', 'HEAD^{tree}'), createdAt: new Date().toISOString(), files });
console.log(JSON.stringify({ path: output, sha256: fileHash(output), files: files.length, sourceCommit: commit }));
