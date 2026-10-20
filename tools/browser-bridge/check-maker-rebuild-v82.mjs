import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const path = '../../outputs/にーくら野球メーカー_v82_削除と入力復帰版.html';
const sha = value => createHash('sha256').update(value).digest('hex');
const files = [path, path + '.build.json', path + '.bundle-inputs.json'];
const before = await Promise.all(files.map(file => readFile(file)));
const built = spawnSync(process.execPath, ['tools/browser-bridge/build-maker-release-v82.mjs'], {encoding: 'utf8'});
if (built.error) throw built.error;
assert.equal(built.status, 0, built.stderr);
const after = await Promise.all(files.map(file => readFile(file)));
files.forEach((file, index) => assert(before[index].equals(after[index]), 'Rebuild differs: ' + file));
const report = {pass: true, files: Object.fromEntries(files.map((file, index) => [file, sha(after[index])])),
  makerSha256: sha(after[0]), scope: 'Rebuilt HTML, metadata and complete maker Core source manifest are byte-identical.'};
await writeFile('docs/verification/releases/v82/rebuild.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
