// Rebuilds a single-file HTML from release parts.
// usage: assemble-html.mjs <parts-dir> <output.html> [slot=path ...]
// A slot replaces one part's whole content with a generated file.
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const [dir, output, ...slotArgs] = process.argv.slice(2);
if (!dir || !output) throw Error('usage: assemble-html.mjs <parts-dir> <output.html> [slot=path ...]');
const slots = new Map(slotArgs.map(arg => {const i = arg.indexOf('='); return [arg.slice(0, i), arg.slice(i + 1)];}));
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
const chunks = [];
const used = new Set();
for (const entry of manifest.entries) {
  if (entry.slot) {
    if (!slots.has(entry.slot)) throw Error('missing slot ' + entry.slot);
    used.add(entry.slot);
    chunks.push(await readFile(slots.get(entry.slot)));
    continue;
  }
  let text = (await readFile(path.join(dir, 'parts', entry.file))).toString('latin1');
  const refs = [...new Set(text.match(/@@ASSET:[0-9a-f]{24}@@/g) ?? [])];
  for (const ref of refs) {
    const bytes = await readFile(path.join(dir, 'assets', ref.slice(8, 32) + '.b64'));
    text = text.split(ref).join(bytes.toString('latin1'));
  }
  chunks.push(Buffer.from(text, 'latin1'));
}
for (const slot of slots.keys()) if (!used.has(slot)) throw Error('unused slot ' + slot);
const html = Buffer.concat(chunks);
await writeFile(output, html);
console.log(JSON.stringify({bytes: html.length, sha256: createHash('sha256').update(html).digest('hex'), matchesSource: createHash('sha256').update(html).digest('hex') === manifest.sourceSha256}));
