import { createRequire } from 'node:module';
import { Session } from 'node:inspector';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Opt-in diagnostic only. A bounded interrupted original proof cannot count
 * as admission or replay. No Source, simulation clock or owner is replaced. */
export function startNativeActorCpuV127(stage: string) {
  const folder = process.env.BASEBALL_ACTOR_CPU;
  if (!folder || stage !== (process.env.BASEBALL_ACTOR_CPU_STAGE ?? 'fixture-start')) return null;
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, '.gitignore'), '*.cpuprofile\n');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const original = DatabaseSync.prototype.prepare, session = new Session(), start = performance.now(), limitMs = 8_000;
  let stopped = false, calls = 0;
  session.connect(); session.post('Profiler.enable'); session.post('Profiler.start');
  const stop = () => {
    if (stopped) return;
    stopped = true; DatabaseSync.prototype.prepare = original;
    session.post('Profiler.stop', (error, result) => {
      if (error) throw error;
      writeFileSync(resolve(folder, stage + '.cpuprofile'), JSON.stringify(result.profile), { flag: 'wx' });
      writeFileSync(resolve(folder, 'capture.json'), JSON.stringify({
        boundary: 'INTENTIONALLY_INTERRUPTED_NATIVE_ACTOR_DIAGNOSTIC', nativeAdmission: false,
        stage, sqlPrepareCalls: calls, limitMs, elapsedMs: performance.now() - start,
      }, null, 2) + '\n', { flag: 'wx' });
    });
    session.disconnect();
  };
  DatabaseSync.prototype.prepare = function (...args: Parameters<typeof original>) {
    calls++;
    if (performance.now() - start >= limitMs) { stop(); throw Error('intentional Native actor CPU diagnostic interruption'); }
    return Reflect.apply(original, this, args);
  };
  return stop;
}
