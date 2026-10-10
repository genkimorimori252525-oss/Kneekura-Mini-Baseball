const cacheDir=process.env.BASEBALL_GATE_CACHE;
export default {...(cacheDir?{cacheDir}:{}),test:{cache:false,include:["src/host/world/CompletedBattedEpisodeOrigin.test.ts", "src/host/world/TerminalContinuationFixtureInputs.test.ts", "src/host/world/TerminalContinuationAttachment.test.ts", "src/host/world/TerminalFinalCapabilityFixture.test.ts"]}};
