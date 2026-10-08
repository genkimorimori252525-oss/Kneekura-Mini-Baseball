const cacheDir=process.env.BASEBALL_GATE_CACHE;
export default {...(cacheDir?{cacheDir}:{}),test:{cache:false,include:['tools/verification/terminal-completion/TerminalCompletionObservation.acceptance.ts']}};
