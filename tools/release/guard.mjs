// Runs a command and kills its whole process tree once it stops making progress, so a hung
// child can never hold a background job open silently.
// usage: node guard.mjs --idle=SECONDS --max=SECONDS [--watch=PATH]... -- <command line>
// Progress means new stdout/stderr bytes or a change to a watched file (size or mtime).
// exit: the child's own code, or 124 after a stall or the hard limit.
import {spawn, spawnSync} from 'node:child_process';
import {statSync} from 'node:fs';

const argv = process.argv.slice(2), split = argv.indexOf('--');
if (split < 0 || split === argv.length - 1) {
  console.error('usage: node guard.mjs --idle=S --max=S [--watch=PATH]... -- <command line>');
  process.exit(2);
}
const options = argv.slice(0, split), command = argv.slice(split + 1).join(' ');
const pick = name => options.filter(a => a.startsWith(`--${name}=`)).map(a => a.slice(name.length + 3));
const idleSeconds = Number(pick('idle')[0] ?? 300), maxSeconds = Number(pick('max')[0] ?? 3600), watched = pick('watch');

const stamp = path => {
  try { const s = statSync(path); return `${s.size}:${s.mtimeMs}`; } catch { return 'missing'; }
};
const started = Date.now();
let lastProgress = started, stamps = watched.map(stamp), stopped = false;

const child = spawn(command, {shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
for (const [from, to] of [[child.stdout, process.stdout], [child.stderr, process.stderr]])
  from.on('data', chunk => { lastProgress = Date.now(); to.write(chunk); });

const killTree = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], {stdio: 'ignore'});
  else child.kill('SIGKILL');
};
const stop = reason => {
  if (stopped) return;
  stopped = true;
  console.log(`GUARD STOPPED ${reason} after ${Math.round((Date.now() - started) / 1000)}s: ${command.slice(0, 160)}`);
  killTree();
};
const timer = setInterval(() => {
  const next = watched.map(stamp);
  if (next.some((s, i) => s !== stamps[i])) { stamps = next; lastProgress = Date.now(); }
  if (Date.now() - lastProgress > idleSeconds * 1000) stop(`no progress for ${idleSeconds}s`);
  else if (Date.now() - started > maxSeconds * 1000) stop(`hard limit ${maxSeconds}s`);
}, 2000);

child.on('close', code => {
  clearInterval(timer);
  process.exit(stopped ? 124 : code ?? 1);
});
