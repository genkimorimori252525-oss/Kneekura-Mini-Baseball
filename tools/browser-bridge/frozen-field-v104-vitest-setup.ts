import { vi } from 'vitest';

/** Read-only baseline probe. The two existing assertions and their raw input
 * fixtures are unchanged. Only the simulator export is replaced with the
 * simulator and dependencies compiled into the preserved v104 HTML. */
vi.mock('../../src/core/sim/fielding/LiveFieldPlayV1', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/core/sim/fielding/LiveFieldPlayV1')>(),
    { readFileSync } = await import('node:fs'), { createHash } = await import('node:crypto'),
    { deepStrictEqual } = await import('node:assert/strict'),
    html = readFileSync('../../outputs/ばせぼーるlv104_TBD_vs_LAD_捕球視線版.html', 'utf8'),
    scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)],
    matches = scripts.filter(s => s[1].includes('var KneekuraNativeMatchCore ='));
  if (matches.length !== 1) throw Error('frozen v104 native Core script is not unique');
  const core = matches[0][1], sha = createHash('sha256').update(core.replace(/\n$/, '')).digest('hex'),
    expected = '35a50ab7730b1f4a78390cbca0506774269ec3f6c67dbd7b90a9abe7e8686052',
    boundary = '  return __toCommonJS(browser_exports);';
  if (sha !== expected || core.split(boundary).length !== 2
    || (core.match(/function simulateLiveFieldPlayV1\(/g) ?? []).length !== 1)
    throw Error('frozen v104 Core hash or diagnostic exposure seam differs');
  // The sole instrumentation exposes an existing internal function at the
  // IIFE return boundary. No simulator/dependency/fixture arithmetic changes.
  const exposed = core.replace(boundary, '  return { simulateLiveFieldPlayV1 };'),
    api = new Function(exposed + '\nreturn KneekuraNativeMatchCore;')() as Pick<typeof original, 'simulateLiveFieldPlayV1'>;
  console.log(JSON.stringify({ baseline: 'FROZEN_V104_NATIVE_CORE', sha256: sha,
    instrumentation: 'EXPOSE_EXISTING_SIMULATOR_AT_RETURN_ONLY' }));
  return { ...original, simulateLiveFieldPlayV1: (input: Parameters<typeof original.simulateLiveFieldPlayV1>[0]) => {
    const frozen=api.simulateLiveFieldPlayV1(input), current=original.simulateLiveFieldPlayV1(input),
      summary=(r: typeof current)=>({facts:r.facts,ruleFacts:r.ruleFacts,end:r.end,finalRunners:r.finalRunners}),
      before=summary(frozen),after=summary(current);
    deepStrictEqual(after,before,'current model-omitted execution differs from frozen v104');
    console.log(JSON.stringify({comparison:'CURRENT_VS_FROZEN_V104_EXACT',sameFactsRulesEndRunners:true,
      sha256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),end:frozen.end}));
    return frozen;
  } };
});
