// Source-only draft. Mirrors Vitest 2.1.9 JSON names and records structural errors.
import { writeFileSync } from 'node:fs';
const error = e => ({ name: String(e.name), message: String(e.message), code: e.code ?? null });
function evidence(files) {
  const cases = [], containers = [];
  for (const file of files ?? []) {
    const visit = task => {
      const errors = (task.result?.errors ?? []).map(error);
      const hooks = task.result?.hooks ?? {};
      if (task.type === 'test') {
        const ancestorTitles = [];
        for (let suite = task.suite; suite; suite = suite.suite) ancestorTitles.push(suite.name);
        ancestorTitles.reverse();
        cases.push({ file: file.filepath, title: task.name, ancestorTitles,
          fullName: [...ancestorTitles, task.name].join(' '), mode: task.mode,
          state: task.result?.state ?? null, hooks, errors });
      } else {
        containers.push({ file: file.filepath, name: task.name, errors, hooks });
        for (const child of task.tasks ?? []) visit(child);
      }
    };
    visit(file);
  }
  return { cases, containers };
}
export default class {
  onCollected(files) {
    writeFileSync(process.env.BASEBALL_COLLECTION_LOG, JSON.stringify(evidence(files)), { flag: 'wx' });
  }
  onFinished(files, errors) {
    writeFileSync(process.env.BASEBALL_EVIDENCE_LOG,
      JSON.stringify({ ...evidence(files), unhandled: (errors ?? []).map(error) }), { flag: 'wx' });
  }
}
