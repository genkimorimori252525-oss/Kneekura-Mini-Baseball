import { describe, expect, it } from 'vitest';
import { parseNativeContactReportArgsV192 } from './native-contact-report-v192.mjs';
describe('V229 optional CLI envelope', () => {
  const base=['export','--database=db','--career=c','--player=p','--output=out'];
  it('accepts one explicit envelope flag only for export and leaves the default shape alone', () => {
    expect(parseNativeContactReportArgsV192(base)).not.toHaveProperty('envelope');
    expect(parseNativeContactReportArgsV192([...base,'--envelope']).envelope).toBe(true);
    expect(() => parseNativeContactReportArgsV192([...base,'--envelope','--envelope'])).toThrow();
    expect(() => parseNativeContactReportArgsV192(['collect','--database=db','--career=c','--player=p','--envelope'])).toThrow();
  });
});
import { readFileSync } from 'node:fs';
it('reconstructs the complete pre-edit CLI bytes after removing the opt-in changes', () => {
  let s=readFileSync('tools/native-contact-report-v192.mjs','utf8');
  const changes=[
    ['[--projection-revision=N] [--envelope]','[--projection-revision=N]'],
    ["    if(option==='--envelope' && operation==='export'){if(Object.hasOwn(values,'envelope'))throw Error('Duplicate argument: envelope');values.envelope=true;continue;}\n",''],
    ['projectionRevision:Number(revision),...(values.envelope?{envelope:true}:{})};','projectionRevision:Number(revision)};'],
    ["      result=input.envelope?runtime.readNativeContactReportEnvelopeV229FromSqlite(databaseHandle,{scope,model,policy,worldRevision:input.projectionRevision})\n        :runtime.readNativeContactReportV192FromSqlite(databaseHandle,{scope,model,policy,worldRevision:input.projectionRevision});", "      result=runtime.readNativeContactReportV192FromSqlite(databaseHandle,{scope,model,policy,worldRevision:input.projectionRevision});"],
    ["    const report=input.envelope?result.report:result;\n    return {operation:input.operation,scope,...(output===null?{collection:result}:{output,status:report.status,reasons:report.reasons}),", "    return {operation:input.operation,scope,...(output===null?{collection:result}:{output,status:result.status,reasons:result.reasons}),"],
  ];
  for(const [a,b] of changes){expect(s.split(a)).toHaveLength(2);s=s.replace(a,b);}
  expect(Buffer.from(s)).toEqual(readFileSync('work/contact-envelope-v229-cli-baseline/worktree.mjs'));
  expect(readFileSync('work/contact-envelope-v229-cli-baseline/worktree.mjs')).toEqual(readFileSync('work/contact-envelope-v229-cli-baseline/git-parent.mjs'));
});
