import * as ts from 'typescript';
export type DiagnosticTarget = Readonly<{ variable: string; label: string; metadata: string }>;
/** Exact, test-config-only wrapping. No production file is edited or result replaced. */
export const instrumentFieldDiagnostic = (code: string, file: string, helper: string, targets: readonly DiagnosticTarget[]) => {
  if (['__epbDiagnosticPhase', '__epbDiagnosticInput', '__epbDiagnosticCoreInput'].some(name => code.includes(name))) throw new Error('diagnostic import collision');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits: { offset: number; text: string }[] = [];
  const counts = new Map(targets.map(target => [target.variable, 0]));
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) {
      const target = targets.find(target => target.variable === node.name.getText(source));
      if (target) {
        if (node.initializer.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) throw new Error('asynchronous diagnostic target is unsupported');
        counts.set(target.variable, counts.get(target.variable)! + 1);
        const body = node.initializer.body, call = `__epbDiagnosticPhase(${JSON.stringify(target.label)}, () => (${target.metadata}), () => `;
        if (ts.isBlock(body)) {
          edits.push({ offset: body.getStart(source) + 1, text: `return ${call}{` }, { offset: body.getEnd() - 1, text: '});' });
        } else {
          edits.push({ offset: body.getStart(source), text: `${call}(` }, { offset: body.getEnd(), text: '))' });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  for (const target of targets) if (counts.get(target.variable) !== 1) throw new Error(`diagnostic target count differs: ${target.variable}`);
  let transformed = code;
  for (const edit of edits.sort((a, b) => b.offset - a.offset)) transformed = transformed.slice(0, edit.offset) + edit.text + transformed.slice(edit.offset);
  return `import { fieldDiagnosticPhase as __epbDiagnosticPhase, fieldDiagnosticInput as __epbDiagnosticInput, fieldDiagnosticCoreInput as __epbDiagnosticCoreInput } from ${JSON.stringify(helper)};\n${transformed}`;
};
