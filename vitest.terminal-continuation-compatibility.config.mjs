const cacheDir=process.env.BASEBALL_GATE_CACHE;
export default {...(cacheDir?{cacheDir}:{}),test:{cache:false,include:["src/host/world/SqlitePhysicalPlayClosureStore.test.ts", "src/host/world/SqlitePhysicalPitchProgressStore.test.ts", "src/host/world/SqlitePhysicalPlateAppearanceActorStore.test.ts"]}};
