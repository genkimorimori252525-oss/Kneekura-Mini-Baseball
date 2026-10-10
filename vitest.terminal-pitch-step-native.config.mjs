const cacheDir=process.env.BASEBALL_GATE_CACHE;
export default {...(cacheDir?{cacheDir}:{}),test:{cache:false,include:['src/host/world/TerminalContinuationPitchStep.acceptance.ts']}};
