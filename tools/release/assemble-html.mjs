// Rebuilds a single-file HTML from release parts.
// usage: assemble-html.mjs <parts-dir> <output.html> [slot=path ...]
// A slot replaces one part's whole content with a generated file.
// --part=<file>=<path> swaps one part for a private local file that must stay out of git.
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const [dir, output, ...slotArgs] = process.argv.slice(2);
if (!dir || !output) throw Error('usage: assemble-html.mjs <parts-dir> <output.html> [--manifest=name] [slot=path ...]');
const manifestName = slotArgs.find(a => a.startsWith('--manifest='))?.slice(11) ?? 'manifest.json';
const swaps = new Map(slotArgs.filter(a => a.startsWith('--part=')).map(a => {const i = a.indexOf('=', 7); return [a.slice(7, i), a.slice(i + 1)];}));
const slots = new Map(slotArgs.filter(a => !a.startsWith('--')).map(arg => {const i = arg.indexOf('='); return [arg.slice(0, i), arg.slice(i + 1)];}));
const manifest = JSON.parse(await readFile(path.join(dir, manifestName), 'utf8'));
const chunks = [];
const used = new Set();
for (const entry of manifest.entries) {
  if (entry.slot && !slots.has(entry.slot)) throw Error('missing slot ' + entry.slot);
  if (entry.slot) used.add(entry.slot);
  let text = (await readFile(entry.slot ? slots.get(entry.slot) : swaps.get(entry.file) ?? path.join(dir, 'parts', entry.file))).toString('latin1');
  const refs = [...new Set(text.match(/@@ASSET:[0-9a-f]{24}@@/g) ?? [])];
  for (const ref of refs) {
    const bytes = await readFile(path.join(dir, 'assets', ref.slice(8, 32) + '.b64'));
    text = text.split(ref).join(bytes.toString('latin1'));
  }
  chunks.push(Buffer.from(text, 'latin1'));
}
for (const slot of slots.keys()) if (!used.has(slot)) throw Error('unused slot ' + slot);
for (const file of swaps.keys()) if (!manifest.entries.some(e => e.file === file)) throw Error('unknown part ' + file);
const html = Buffer.concat(chunks);
if (html.includes('@@ASSET:')) throw Error('unresolved asset placeholder in ' + output);
await writeFile(output, html);
console.log(JSON.stringify({bytes: html.length, sha256: createHash('sha256').update(html).digest('hex'), matchesSource: createHash('sha256').update(html).digest('hex') === manifest.sourceSha256}));
