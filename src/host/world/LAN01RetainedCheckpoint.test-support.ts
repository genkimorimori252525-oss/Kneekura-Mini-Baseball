import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

/** Preserved LAN01-R5 cp27 delivery boundary and its earlier provenance. */
const LAN01_PRIOR_CP27 = Object.freeze({
  sourceCommit: 'b38668807c4117b3053a50e4696735842373e2a3',
  publicSourceCommit: '9ada8883bb9553b08777379e6fefd5e8609e3ea6',
  sourceTree: '58f6c35f960058451e78e7066873c33ed40d45f4',
  runControlSha256: 'f60765c5fa947248f29c05edef04f55523ac29cf3041aba05145f4b3999df304',
  receiptSha256: 'f24b161688e37f9bc71365e856ab1f9c9bc355b9249b642444bf7036d081f4b4',
  censusSha256: 'b9f288b5ffe06b73ea4ee3ddf45758a05d98e72bb867c42f3d0b804bbbd21432',
  priorRunTerminalSha256: '2896744a52c7b580bbd1495c220f9da8931d0fe3fd5da32c970d7751a14eb11f',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: '7e296210d3e8cb32dcb07160ecd6223e2b6fb7ed85449319286dda2564e9d29c', gzipBytes: 803695,
  databaseSha256: '84e88bebcd4779c4222f3f32d5b3e48fc47d6c3c3e7dc4c27e30a0661dda5579', databaseBytes: 12349440,
  tableCount: 115, checkpointSequence: 27, returnedOwnerCall: 30,
  runnerModelResultHash: '35997800a5657833158e32f402af8329e57b4f21e778ee745aa20f692b574f0c',
  viewSnapshotHash: 'd6d7cd1cc61228cc13e68cc50e2310f3dda0cc55dd02d6af7396a1717c33452b',
  firstPitchSnapshotHash: '68e29c4cd60a0c7d3410156046228c5b38572a6d5b47a8bcd5113e0e1bab6d08',
  secondPitchSnapshotHash: '25c0ed5ec3217eb9df99da312fe5a9ea78df76f4247a8d65e272fa0f63d55ec7',
  anchorViewSnapshotHash: '5c08bc1c38f9a668153bd3d0bbe9c7d679d57b50120f0250edb23aa54466c0f9',
  cut0ViewSnapshotHash: '568fa0da5a5de99433ebac948f632126943af5cc21ca825c92e0695a288217c1',
  secondPostureSnapshotHash: '11c1f85eef98f38a8a1af82dd840e94ff58a79a6e21c8f4a9d17e53dad3fc0dd',
  returnedDeliveryHash: '5f830eee747970f9ff1ab96c3fd694f840e3a9ee7fefae26e628e76495e9fa3c',
  deliveryBoundary: Object.freeze({
    postureReference: { owner: 'batting_observation_v1_postures' as const, sourceId: 'lan01:swing:posture', sourceHash: '82606c4f3b619e8d953e7c86aa296f3d009f3f486ad3f61433ee0289598a17f4', snapshotHash: '911abceea086956bab311509f6dfdbd292e8921764b2c7d2aa68dfdd01d0a147' },
    intentReference: { owner: 'batting_execution_v1_intents' as const, sourceId: 'lan01:swing:intent', sourceHash: 'facfec19572a71e974d746ded4c3313f1b56c411212f299df69c37da38162c40', snapshotHash: 'af28a8bcf00b23e24fbbcac2ce4361bd4ad942235ed4f0429531803bba93e985' },
    launchReference: { owner: 'pa_physical_v1_launches' as const, sourceId: 'lan01:swing:launch', sourceHash: '86e6f2ec29849ce53ea2f5c60fe9352cb877fdd21b84ed9950542d0e17a60125', snapshotHash: 'f795d16d79150bc52295b1dcdbdfb12fdd1d45ccee8dcec46b493a862cc7fc55' },
    captureCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:capture-cut', sourceHash: 'd58821eae3289e93a28dbaab49bdafa4603af5968daea54d56d9b021faef9a85', snapshotHash: '957a204c0b084132e398c9699ef3b55b481e13d5c183103cfb79a41bde92a1bd' },
    observationReference: { owner: 'batting_observation_v1_observations' as const, sourceId: 'lan01:swing:capture', sourceHash: 'a485edf179288fd151988f1f227d30fd026b4eb4735f0afd4e72644124818c7c', snapshotHash: '2bbe48c45033678822606d4926abd63584aee6dacea42446e18182a26135f26d' },
    deliveryCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:delivery-cut', sourceHash: 'a387d3a515548989e80e151a62de57d2fd477e4b92a152cfaa1df752a3f003a0', snapshotHash: '4efb6dc64fa98a1e10dde2bf1c5d8da95de09ce88043c72aae45a9396af6cf15' },
    deliveryReference: { owner: 'batting_observation_v1_deliveries' as const, sourceId: 'lan01:swing:delivery', sourceHash: 'ad139f8c2323d89a9956e9a280e3eb4848447f4b8d0de7a1a393b130e2bd917d', snapshotHash: 'e89cff6d316ac087e2b0331f8f53ca6e6a87fcad725f459cc3a24dacc297ead8' },
    fieldCalibrationReference: { owner: 'pa_physical_v1_field_calibrations' as const, sourceId: 'lan01:field:calibration', sourceHash: '0e166b7e541b3f366456517af104532adbd0775d7dfc3d474d26657fbbd02cbe', snapshotHash: '59ebcd47d379609f23624e36edc7ad0978435c333ea49057bb16b61b9072cc15' },
    cut5ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut5:view', sourceHash: 'e4167fa24fe30c577b3c6354b9ece63d13cd81f55737f2f25373efa3949c2a23', snapshotHash: '40ff1dc543c78790031480d9666c8c21782bc306bc6cd77fb08034ed181fe430' },
  }),
  priorCp23: Object.freeze({
    sourceCommit: 'b1a8c797fe1b293663a94d3c259498760c20b190', publicSourceCommit: '5c5e4b1dbdb039ed70e673b80284c933fd878ee7',
    sourceTree: 'f1543cc585cc2181c40e39a17bb4731f49268f2d',
    gzipSha256: '20eb34335f9256a4237bfebfb1c0736bb9cf05b56d39947785243c2cd7a9f95d',
    databaseSha256: 'd0505072f55baf7a073563814e5fd82c643f7b8a8ab39b8d36f096ada5fb79b7',
    receiptSha256: '9ee4d4d324637d4e23a9905b7a18d1bd68a299319978dbd1c659d172c3c822ec',
    boundary: 'both occupied TAKEs and complete cut0; third action absent',
  }),
  priorCp5: Object.freeze({
    sourceCommit: '4d452cea7ee37d41ca4f517612ffa96a7bb878d2', sourceTree: '3dcc76c69323fdd3461d4af7ec7f61bafe646e2a',
    gzipSha256: 'fac97a92b42c858860babd827d975a693e1754f6498686edbd15928a3d612e6f',
    databaseSha256: '9476906a4cfc2728c6b968baf90763fdf0a1bae58595d409a345016cc813f177',
    receiptSha256: '9b8d372485d6c60e95794e0b58f6a5bae03f7e003a030e2c4c56d877c7bf285d',
    originalRunOutcome: 'FAILED_QUERY_ONLY_FIXTURE_READ',
  }),
  failedCp11Continuation: Object.freeze({
    terminalSha256: '268f81c2c4109734473d56533fbf3e9e3a2b402ad5f80a200602914c7ab44ea9',
    reportSha256: 'dafebb63b30883923c875c5061378da2837909021841d73be360d94a88597ace',
    originalRunOutcome: 'FAILED_IMMUTABLE_HOLD_EXHAUSTED', reusableAsCorrectedPrefix: false,
  }),
});

/** Exact LAN01-R6 cp21 after accepted third-pitch input and complete cut9.
 * The first remaining writer is commitment; earlier checkpoints are provenance only. */
const LAN01_PRIOR_CP21 = Object.freeze({
  ...LAN01_PRIOR_CP27,
  sourceCommit: '7d04312564243f83d9db94e0f692693ab94a6b30',
  publicSourceCommit: '7b989ef996035c0ad2fc1bbaf549b12f7d45634a',
  sourceTree: '4f67963c020d6768cfd9d90468cda7f15ef9c105',
  runControlSha256: 'b508b5b94f604203c303cdaf6a939ec762f5c274f56243c23c815f42904bff4c',
  receiptSha256: '1a154dc1cc0c8e027495d819e3349eccb1d806eaadd7e46bd5953602a6a4e506',
  censusSha256: 'c7f1af266abe03727895125ecb3e3fbe11baaeb306f66b9072551612c2b0705e',
  priorRunTerminalSha256: null,
  priorRunObservationSha256: 'fa60da67d0796f6594de6ea31cb5bdb870daaafa9e337092c5f0d57fee4e20d6',
  priorRunOutcome: 'INTERRUPTED_AFTER_ENVIRONMENT_CHANGE_TERMINAL_UNKNOWN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: 'c11060ee2789fb3a3e4414975731d561beb0779d2e3822016c87a5e95dae7974', gzipBytes: 921724,
  databaseSha256: 'd6db63ca4b6302e7810db064de3b9fda451d67b25a453299b8a7334de946f85a', databaseBytes: 14417920,
  tableCount: 117, rowCount: 1290, checkpointSequence: 21, returnedOwnerCall: 21,
  returnedInputHash: 'bebb859a96ba407d7db163cf84e7c1a8cc4c77d9444a5092a9c072ca17511797',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearancePhysicalEpisode', method: 'acceptOperation', sourceId: 'lan01:swing:commitment',
    argumentsHash: '55ca606ba61b079c7f08142b1223ac14fc1944d70a50907dd7c51335ecf466c1',
  }),
  inputBoundary: Object.freeze({
    ...LAN01_PRIOR_CP27.deliveryBoundary,
    predictionReference: { owner: 'batting_prediction_v1_predictions' as const, sourceId: 'lan01:swing:forecast', sourceHash: '9b8b53ddc17cc89b6d74e04911fa371d95a86a836261a34d393288515c078f07', snapshotHash: '9c6210faa4c84e2bd6897e7f554d1d3776c954c4b561b1abc27686672eeaf93e' },
    scoreReference: { owner: 'batting_score_v1_assessments' as const, sourceId: 'lan01:swing:score', sourceHash: 'a8610d3eceda2cce6d1d13a918ac467cc1a8099537a2e295ebb2922c9fdbf91f', snapshotHash: 'a35aa83fcd40f2e9be9b6910dee638625828a4fe629221efdf8265f7e3c9cea3' },
    emotionReference: { owner: 'batting_emotion_execution_v1_executions' as const, sourceId: 'lan01:swing:emotion', sourceHash: '09a5b9e01139682591c791b55facf60e88b7d0e06568772d37ed24cd5927236b', snapshotHash: '5fe4af53843d48d480b4435890bab7e9637950414d312ebe9194a04ee048a521' },
    decisionCutReference: { owner: 'pa_physical_v1_cuts' as const, sourceId: 'lan01:swing:decision-cut', sourceHash: '9929d9c3b6500cc47ec0336a86eb8bf3414dfc21c629cc19bc1db9778b2176a6', snapshotHash: '7a93f018c4233f3ac5d063f340026b2c8e289ff2a854a8a0192f19f7a1d385cc' },
    decisionPrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut9:prefix', sourceHash: '3ff1726d0067cd9afb251350f028b5bfcf70ec70434091780259a8ab4ec3c7ac', snapshotHash: 'c9127809ec5dc94ee06950e7696421eb4852fe3e6cfb5a4243a29e168a1a8e87' },
    inputReference: { owner: 'batting_execution_v1_inputs' as const, sourceId: 'lan01:swing:input', sourceHash: '45f087b14a3e9ff81a23b885df411f24698fc1210d08ef71b82e7e41dbb5428d', snapshotHash: 'e9ee71e4525091ac0942ef60f7240fa092703e971294492e796a4885d31301ac' },
    cut9ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut9:view', sourceHash: 'fc9cdadb774d5834cff2f166793c3b5271a5da822402884292ee1c24d30e4b6e', snapshotHash: '9e83c718644d104c39bf8b35e553b5ad88975d2a21bf04f9e5cb73403607455e' },
  }),
  priorCp27: LAN01_PRIOR_CP27,
});
/** Exact LAN01-R7 cp14 after cut12 prefix, eleven TOTALs and view.
 * The first remaining writer is the original complete calibration set. */
const LAN01_PRIOR_CP14 = Object.freeze({
  ...LAN01_PRIOR_CP21,
  sourceCommit: 'c8c9e657faf94b4a2e02d51d38b97297429732da',
  publicSourceCommit: '092b768cb5c8b3072031df9400c87f88814fbc54',
  sourceTree: '06af20f366aa46a820c3bc9eabb03f657097c30e',
  runControlSha256: 'a7db84bafc85358c2a073ead4d6e12fcfea10c769e74468ea12a124391d8de19',
  receiptSha256: 'be09d528d29b47b5e381f7d6137762f37a60fd2702f72cba151504681ad4caed',
  censusSha256: '686ba32106185fec35a310e035b99a6206190fb999efbf4ffb81d758c357837b',
  contentAuditSha256: '419b559b02ff6a316b94d1378963172de4536238d14b1b2ed6c969f19ecb70e2',
  priorRunTerminalSha256: '8a48d3907ac9924c50f65ca063dd002edc08024bc8060d594532324c8319592c',
  priorRunObservationSha256: null,
  priorRunOutcome: 'FAILED_WALL_AFTER_CUT12_VIEW_BEFORE_CALIBRATION_RETURN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: 'c28e883a9cbc2317e3e629e99807c26715b56d41e22f85deb4d1435761883128', gzipBytes: 999475,
  databaseSha256: '17698377c8347d6ddcb145852cafda439193512de56b2f206f2f894c3171fd9f', databaseBytes: 15671296,
  tableCount: 117, rowCount: 1397, checkpointSequence: 14, returnedOwnerCall: 14,
  returnedViewHash: 'c0a7eef8ddba81d5ad3c83bcc296bfdf5541985583290504ae8676ce3245459f',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearanceLifecycle', method: 'acceptCalibrationSet', sourceIdPrefix: 'lan01:occupied:cut12:',
    argumentsHash: 'f3bcf512bce0a0727213fd030e508dc720796a93a694d5a5c17b541d4c960434',
  }),
  fieldBoundary: Object.freeze({
    ...LAN01_PRIOR_CP21.inputBoundary,
    commitmentReference: { owner: 'pa_physical_v1_commitments' as const, sourceId: 'lan01:swing:commitment', sourceHash: 'd36e1b99f292fb5dd7a52704a50a883126fc90712283804a54c08d765ef682a2', snapshotHash: '0894002904f06790980a82e52dfafc42716549f393b051fead3d268a2e66d745' },
    resolutionReference: { owner: 'pa_physical_v1_resolutions' as const, sourceId: 'lan01:swing:resolution', sourceHash: '8062c5b5277518ce2c5165fa43647c37c3094ab6d1baef67d010e44c5d9c36bc', snapshotHash: '134455d5b5757feff4c72f5045a7cbb849928a4e2f50a6b849b61fe824a44339' },
    fieldRootReference: { owner: 'pa_physical_v1_field_roots' as const, sourceId: 'lan01:field:field-root', sourceHash: 'b061e6493a86d9d6219679aadc6fe2522b21a7523c0c1abbc5069e916e1bffd4', snapshotHash: '57426980d03f9f3172d1c9f0b56e2647a1cc545cf045e5eae39052488b4bcab5' },
    cut12PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut12:prefix', sourceHash: '6ba6a8203df2bfb8a1506586daad5890fac8a60461adc7aca1502d418fbd16f7', snapshotHash: '1f3517002d2ea47133cba4e7ed661b19b9b4f2e78a43fded9ad2cefd28387cca' },
    cut12ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut12:view', sourceHash: 'e084f63c11021cd970dc86737d72b6a614ba600d3bbee6a4da7528fed95cb067', snapshotHash: 'f1917289244c16440081790b0e6b2a57d9059dc4c1013e2421995b405729bf69' },
  }),
  priorCp21: LAN01_PRIOR_CP21,
});
/** Exact LAN01-R6 cp19: the cut9 view is accepted but its calibration set is
 * absent. The later ground-contact lineage remains failed evidence only. */
const LAN01_PRIOR_CP19 = Object.freeze({
  ...LAN01_PRIOR_CP27,
  sourceCommit: LAN01_PRIOR_CP21.sourceCommit, publicSourceCommit: LAN01_PRIOR_CP21.publicSourceCommit,
  sourceTree: LAN01_PRIOR_CP21.sourceTree, runControlSha256: LAN01_PRIOR_CP21.runControlSha256,
  priorRunTerminalSha256: null, priorRunObservationSha256: LAN01_PRIOR_CP21.priorRunObservationSha256,
  priorRunOutcome: LAN01_PRIOR_CP21.priorRunOutcome,
  receiptSha256: '2e684a90f3c112d217206e05470201a998311bfa1c0a627e97c614f4872863e9',
  censusSha256: '91a4f460ef426113790873993623d0c5ed2e2b4f5f5047055a4115dadd30a42b',
  contentAuditSha256: 'dec2d14ffe07d932699b80ccdc746a60a897486c0396698edf9dceeb51de5659',
  gzipSha256: '1ff55c8e79eaee682eff205541416d6fe6d4434bfde056ac11085f7a0e59c96b', gzipBytes: 897694,
  databaseSha256: 'bf869360d63a56535e0e20b97df6ad831e2dfa93e58cb6355a8b9270ce95511d', databaseBytes: 14032896,
  tableCount: 117, rowCount: 1257, checkpointSequence: 19, returnedOwnerCall: 19,
  returnedViewHash: '8d8da8ca92da7a4b0c41cfdd9fc69c7d4ce0d0a0021e99645da7acf57bf3f6cb',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearanceLifecycle', method: 'acceptCalibrationSet', sourceIdPrefix: 'lan01:occupied:cut9:',
    // The owner arguments contain the same 32 IDs. Only the not-yet-accepted
    // batter_swing Source values deliberately change at this boundary.
    argumentsHash: '34eaf330c3eec2898008592b4c72a0873bf1a93cda66c466f0a294cddf0df7e0',
  }),
  decisionBoundary: Object.freeze({
    ...LAN01_PRIOR_CP27.deliveryBoundary,
    predictionReference: LAN01_PRIOR_CP21.inputBoundary.predictionReference,
    scoreReference: LAN01_PRIOR_CP21.inputBoundary.scoreReference,
    emotionReference: LAN01_PRIOR_CP21.inputBoundary.emotionReference,
    decisionCutReference: LAN01_PRIOR_CP21.inputBoundary.decisionCutReference,
    decisionPrefixReference: LAN01_PRIOR_CP21.inputBoundary.decisionPrefixReference,
    cut9ViewReference: LAN01_PRIOR_CP21.inputBoundary.cut9ViewReference,
  }),
  priorCp21: LAN01_PRIOR_CP21,
  priorCp14: LAN01_PRIOR_CP14,
  priorCp27: LAN01_PRIOR_CP27,
  failedGroundContactLineage: Object.freeze({
    publicSourceCommit: '3dfe091e660f967e3f94f1c88ce7f8464e3b9c09', sourceTree: '002147bcb96b59188946a284859f0a27dc529583',
    terminalSha256: '76197083717093fefb2e3cf3114c6bd3554044b889c7c192c990f036a92d14ca',
    reportSha256: 'fe2420e91fa7198ebd66d77dac2886f17f2f7f134155f030b9a2d34b9aabeb71',
    resultSha256: 'bf438c9d4d2996a753ce4d690a0212eac44e771c1e615ddb381da14f56917373',
    gzipSha256: 'f1e77cdc8ced9e639fefb02a732f09e9952f6b619df8ccdd03ce5d685d658590',
    databaseSha256: '2d51b8a4a62d7f8bf2aa8d14aa4ad4bcd359eedbc55ba5fe76b68949bbba29f1',
    originalRunOutcome: 'FAILED_ACTUAL_FIELD_SOLE_GLOVE_ACQUISITION_CANDIDATE_MISSING',
    reusableAsCorrectedSuffix: false,
  }),
});
/** Exact LAN01-R9 cp39: the original throw plan is committed; cut17 is absent.
 * Transfer, release, reception and the original appeal remain future work. */
const LAN01_PRIOR_CP39 = Object.freeze({
  ...LAN01_PRIOR_CP19,
  sourceCommit: '6bab1f7bf8781458cfa55cb97385d14dd0248bbe',
  publicSourceCommit: '7b4c332f9797c3d5772d75dd958a8bc511186755',
  sourceTree: 'ce0382021de406b8c61a6eacd4cbb3f39d4e6afa',
  runControlSha256: '232a9ecff0951a0a87bd906c61a28a0776316cf322cb5e960bd0ac57b0fc3571',
  receiptSha256: '0f36afa9c07c59aa574d2c763532f8b121ed1480ec64a6a1f9bdb70987096db0',
  censusSha256: '3f5e185668ceda187eaa48bc26e0e7c677b25b210b870238f9a13897a456bea8',
  contentAuditSha256: '481b881d514dfa285f067614ef9f308db38abda841175e9696034d8c52111464',
  priorRunTerminalSha256: '8dbface89e12ce4c3da0e1a4eb366da9cfd0dabeddb6394ad626dbccd7f4164b',
  priorRunObservationSha256: null,
  priorRunOutcome: 'FAILED_WALL_AFTER_THROW_PLAN_BEFORE_CUT17_PREFIX_RETURN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: 'f308ac8c6633f2ad91c57d890f3a48761799dee56f9af92413e7db53b3183b2c', gzipBytes: 1146096,
  databaseSha256: '39b508368773cc8cfa3bf962e8fed261f097519898210640badea9b7565363ce', databaseBytes: 18231296,
  tableCount: 118, rowCount: 1615, checkpointSequence: 39, returnedOwnerCall: 39,
  returnedViewHash: null,
  returnedThrowPlanHash: '3bfc236154d6c3933729be8256fa6710ff5cc3dd0b85a8084e07df2124ec478c',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearanceLifecycle', method: 'acceptPrefix', sourceId: 'lan01:occupied:cut17:prefix',
    argumentsHash: '0f457df054a7328753c0637fe77a41b132541d9d0ea08a1f1498e42109218ac6',
  }),
  throwBoundary: Object.freeze({
    ...LAN01_PRIOR_CP19.decisionBoundary,
    inputReference: { owner: 'batting_execution_v1_inputs' as const, sourceId: 'lan01:swing:input', sourceHash: 'a606c9b9a4ef98df7b15b2132468199364533cf448e6142a91b8b68a14dea3d2', snapshotHash: '603ed4db522f48c44b33107aac176eb8cfcd25316509fa8ed8b019a07ba36d7a' },
    commitmentReference: { owner: 'pa_physical_v1_commitments' as const, sourceId: 'lan01:swing:commitment', sourceHash: '794a0916aa1e7591199a7cd35f26af318f446560483b2012e7d2c8dc3b665233', snapshotHash: '502457050be8000405d80e39ba29aa9341fcd4929873e209cfd26ca711817d3a' },
    resolutionReference: { owner: 'pa_physical_v1_resolutions' as const, sourceId: 'lan01:swing:resolution', sourceHash: 'c02a05cf45d2fa0d020304b5b06aebe10ab24d0a24210113868e523790667e4d', snapshotHash: 'dd829362333a57febc378016adb108f679a65f5ed0e8be5107c3d110199d8116' },
    fieldRootReference: { owner: 'pa_physical_v1_field_roots' as const, sourceId: 'lan01:field:field-root', sourceHash: '2e62b358ff9ef400f4efbdb55f6a67bda9812fc703a9fd7fb490db6ed835a9f0', snapshotHash: '3fa04d14205775fd29511dad31cb4fbfa1212be08bd4f0b7ba453a719e54a04f' },
    cut12ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut12:view', sourceHash: '6b18984bdf31de781a72b3bf3d036548304fe3b9e17fc7d1f5a83c360e9208ef', snapshotHash: '2e0a7474f3a770cbf520518072c8b184f2f67c74a0f545a1b8537fc4f63079a0' },
    fieldStepReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:field:field-step', sourceHash: '6cfe09b22deec53ced7d1ed0c1006e7477666f303e5fb5b83204a95738f18492', snapshotHash: '28bd04f643cf0f43c0192799f459d5517cbaa6afa2c4d32b6d80ef574ca9054d' },
    securedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:1', sourceHash: 'a83c607b6c8c4530ebed58c6444a62faefa4b620cc55c2666ed83624499eaf9c', snapshotHash: '2ed27402089af3634c9fe0aee9b218e3cfaddede0675628801b4248f2dbfdc64' },
    caughtReference: { owner: 'pa_catch_v1_work' as const, sourceId: 'lan01:caught:work:original', sourceHash: '04d0102e8af03ece2784b7e3b9921bb143acd7b0e5dd2d532241d4c43e6530ce', snapshotHash: '6a7053ee652d5b0b12cfe5434eb010928ef9a3f45b1293f76bdd3ddeb34b3375' },
    indicatedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:2', sourceHash: 'a7e8ddd66ed5aeab548c369be4b896ac7ed06f72b5552c97f544a81e74caf642', snapshotHash: '1295644411d1b44e72088dd5b9f162c27b550bb9deb20ae74cb71ece1243382a' },
    throwCalibrationReference: { owner: 'pa_lifecycle_v1_execution_calibrations' as const, sourceId: 'lan01:appeal-throw:throw-calibration', sourceHash: 'bcbec32665d98e953496b3fb1462c19a2e8721132f70470ec031a03240a8c223', snapshotHash: '181e3a940d884945d436658488f3985e06dab33eb47418cf8c8de4bbad73dfb2' },
    plannedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:3', sourceHash: 'd4bc3ebab1383b578942470e64707068a7bad5e7fc4a934270b2535daa565575', snapshotHash: 'f5b70b23c04266c2357802456faae54dedd64c004b920eb308b52a1b7d8ac6c3' },
    cut13ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut13:view', sourceHash: '54b6321f925ca2d3899c14790f3dac26ba0cc679d3fc69c81271e6fbef176ed0', snapshotHash: '68d47004735aac390dda2fa6984a1cbe50d52f9bdaf1125399a2dd6b0f4c6e15' },
    cut14ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut14:view', sourceHash: 'af30f84768ce1b3dc3490571600995de6722f1cb24ac122e05ee34467654252c', snapshotHash: '41a60760a7405e613ad9616c4338ceddae5ce54f24bb1a36150f0efeff38f866' },
    cut15ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut15:view', sourceHash: 'a9f41f85e5635c35d9cf32441e1491e082e29ab6444ce18492af9bba17ae992b', snapshotHash: '5624062b534b94453174cdbe40cffcbd8c96639baddd55fcac2726172d2bfb4c' },
    cut16ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut16:view', sourceHash: 'd6040245fbd683c3b712453a62a0e157bcfcee091385fd5f662b144476a061ee', snapshotHash: 'd4d7918e7ec87326e78acb778c7fc28475d46e76b74984d82a76d7c805b483c9' },
    cut12PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut12:prefix', sourceHash: '1537b023b988c062a4fca0cce1e30341c0249536a61479207cdc16d15b1f4981', snapshotHash: '7d442b96fcd930689cd833626997ffd5b07bf2f53a146425c7a573d1b50f4b95' },
    cut16PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut16:prefix', sourceHash: '06cff6dccdfb48db7dc58d2b73d653177f5b48b0d1bcb613e2d64cab5371828b', snapshotHash: '517337a0b493f3930f2ca7592a3e82dc3c08a918f6fec7573e70b8612b0b999f' },
  }),
  priorCp19: LAN01_PRIOR_CP19,
});
/** Exact LAN01-R11 cp24: receiver capture and complete cut21 are committed.
 * The first remaining writer is the original appeal :8, with no accepted replay. */
export const LAN01_RETAINED_CHECKPOINT = Object.freeze({
  ...LAN01_PRIOR_CP39,
  sourceCommit: '950e6339b1d027103e8591dff17cb3578860d99d',
  publicSourceCommit: 'f79cfd633217b929d26ae5b6d9ee3e793898acfc',
  sourceTree: 'bd4f3827a9f03c48feac0ceccf9cb79fe565f120',
  runControlSha256: '53308132f9a593c64ec820b49d4f2f4636b05b64c8c626e48a102125af229693',
  receiptSha256: 'bfae561d54eb4b9d397f1ef7a3ed5465289810d2877625c14d607273ac3cde2e',
  censusSha256: '7401983e44afd2d575bdbb337e403d225e178dfa488b9bfbd25ec003e3279f4c',
  contentAuditSha256: 'd6dde99c5edd4cf4ad5dc17183224aede448df6b28e42a2af0cafb2ec8b75241',
  priorRunTerminalSha256: '0f2fcbfc829661254a3800b121c5b80acebb1748aec071e01474a58aef9c2b22',
  priorRunObservationSha256: null,
  priorRunOutcome: 'FAILED_WALL_AFTER_CUT21_BEFORE_ORIGINAL_APPEAL_RETURN',
  priorVitestReportSha256: null, priorSuffixResultPresent: false,
  gzipSha256: '71e9ba5e7d41d393dceb5f22a3047a00ed81d75a3acd6d2e3997a2d718920c44', gzipBytes: 1306612,
  databaseSha256: '7828c45d0d9f67dfee4050e4e51b463ce421f5524e593891c8186f75a165735a', databaseBytes: 21020672,
  tableCount: 118, rowCount: 1844, checkpointSequence: 24, returnedOwnerCall: 24,
  returnedCalibrationSetHash: '9cf4ce7196bd56710880d9903591b5d8eb0eb400cc8604aaab839e15cee3ae85',
  firstRemainingWriter: Object.freeze({
    owner: 'SamePlateAppearancePhysicalEpisode', method: 'acceptOperation', sourceId: 'lan01:appeal-throw:8',
    argumentsHash: '925361e75a972242e7059a78df662a8ceffeb7df47ead5a7ff41bd52d4db1aa5',
  }),
  receivedBoundary: Object.freeze({
    ...LAN01_PRIOR_CP39.throwBoundary,
    transferReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:4', sourceHash: '96d7a50427ac3b804e01bec5e819f872c442a6d238946420e51b63821ccc16cf', snapshotHash: 'e20441e4017a4a4014d21cd0d0e8458117afa32d2a739a62b3edd4b27ca99e91' },
    releasedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:5', sourceHash: 'b30a1a1c9c5e2d37e28133ecd94c396d6cef2453c1035266a85939bc5156614b', snapshotHash: '6344e122c5515f69f03a15207b442f666e912486672569360617bc03355d1a3e' },
    receptionReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:6', sourceHash: '1a01e1ca8693d86e29b5d51f10aa2fa561387fcf14969b94dcd9457849d40afd', snapshotHash: '9c752cdcc7e85efebd4facc7f2c14ef98259446f04883db9116e5992815b3c32' },
    receivedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:7', sourceHash: '8a551df71517fa9e2a11a1386fcf07f9c6be3affc28e6205373a5c24bd83cfa0', snapshotHash: '6040fe39b6721791734558905bae7c66309c509a3a0073bfbdbf91da7b1ca3c2' },
    cut17ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut17:view', sourceHash: '06f74bc4a4c43a36ca24e2044ac0b22439dc048fd1da54cbfc54582aec014709', snapshotHash: 'fdd44184724eba859687c5c51776353e9339f08b9200bdd6158fd8d7ffc4c494' },
    cut18ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut18:view', sourceHash: '43f5e6dc422cc95989e0486a6e748123b76c196483c1c0243e9ce3c6f7780f75', snapshotHash: 'c096605c622abce5e11e4aeaa84b76c33f74077c602e8ddd2aa38b9233c1b0d5' },
    cut19ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut19:view', sourceHash: 'af1f234310ad6bb0c9b83ec3b7bddc5b57538143870ddcd5f5b9d9ca3a9bf6e3', snapshotHash: '01a2181dddf45d37e794e6237672794e6e4bdbfa7c3c189bbb2578f4fe5f8468' },
    cut20ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut20:view', sourceHash: '1e5239d86f106c099d07fb9019c2044f1e6df79e07ea87024060a3bd6dc9d529', snapshotHash: 'b675e4fa9d3b1833f2c6a1ec1afd62afb017fd4d5754fb90b92f69a79205ce9e' },
    cut21ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut21:view', sourceHash: '627d3cf3b95343f9c39db745bbd2a4f358d373657376521e275e03f4fea81137', snapshotHash: '599ac218180d48edf4981d5fad58dda10f135212b870554dab60621a22ccf551' },
    cut21PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut21:prefix', sourceHash: 'c584f405bdd1550efcda722ea49909b7daf014b40b287855e0d0ed1cdae7b9ac', snapshotHash: '7f5df58d0749f19a41ffe1dc92cf16d4515d80e3dd41758d48f72e6392f83a18' },
  }),
  priorCp39: LAN01_PRIOR_CP39,
});
/** Exact LAN01-R12 cp16: cut24 and the original review session returned.
 * The interrupted import is absent; this pin cannot select an arbitrary head. */
export const LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT = Object.freeze({
  ...LAN01_RETAINED_CHECKPOINT,
  sourceCommit: 'c0b62314033de11d978fcfbf91fbc01fbcfa5153',
  publicSourceCommit: '1e748d8b227afde81c2d49a0a1e16fe460ee796f',
  sourceTree: '7107950525f037364c1cf2c39770589edcf1dfec',
  runControlSha256: '019fc4c86a4c2f79f8a1d209c49369716cd3d027f1d3485baa9240fa0df54ff3',
  receiptSha256: '42d3ebf86a6b70e1a55911da7c616dd09a4931616b9675ac9d4e4e35b0df1f59',
  censusSha256: '9c108b7e97b0df30c0644c1ee6d096cf32a4fe3c6176a7621d952bfedb7d3795',
  contentAuditSha256: '5f1f23d80c1e2120f566ec759f2ea7e649945c0dd9c0337f9137658e91b60be1',
  priorRunTerminalSha256: '4c2b0790438a5fbfd3a3d2ede0478f66606b4f2f7e48230d2fcd78357b274f14',
  priorRunOutcome: 'FAILED_WALL_AFTER_REVIEW_SESSION_BEFORE_ORIGINAL_IMPORT_RETURN',
  gzipSha256: '71f3622b6f27a262bd744373ee2bb3cdc64ff5bc1439f05bd2b8cdd33388fe01',
  databaseSha256: '4b5f4a7eac0aff693cd34aaf116ac8df35aa5fc76f0e333555217edca161bccd',
  gzipBytes: 1401243, databaseBytes: 22630400, tableCount: 121, rowCount: 1984,
  checkpointSequence: 16, returnedOwnerCall: 16,
  returnedCalibrationSetHash: 'c7bc507dc1c0e38ab25ef41c38db7dda20148a3190cbd2fb9d05f1d5a81687a5',
  firstRemainingWriter: Object.freeze({ owner: 'ActualPostPlayReview', method: 'acceptEvent', sourceId: 'lan01:journal:import',
    argumentsHash: '872b5286e1b9fb07b972d95e84c22f4f86287633e48133b51d5fbd3512b9b73b' }),
  sealedBoundary: Object.freeze({
    ...LAN01_RETAINED_CHECKPOINT.receivedBoundary,
    appealedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:appeal-throw:8', sourceHash: 'cdad2482f0fde2743f4f460cbb7c31273d0a33f59526f78d033313eca90a37b4', snapshotHash: 'de37b9015482a6e4ab16d40013e8ef8fd1c8a9669dd2d935c509243f05462e55' },
    sealedReference: { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'lan01:seal', sourceHash: 'cdecfc4f30117acf5140092bf0032601d3568a2e7055849dc3a1a1dbb820416e', snapshotHash: '37545f34eaa985ee8d932b519677a1bc7cb3ab7a25e3c39510dc15e13fc72843' },
    sealedCatchReference: { owner: 'pa_catch_v1_work' as const, sourceId: 'lan01:caught:work:sealed', sourceHash: '60c37c563d05f1e79fb8a17fc1d556c3570705634443d34f00d11ae7aebd875d', snapshotHash: 'b738ff317f3ad874122c2520c5833f9e97ab17b96e59da55ea339ce583c956b3' },
    cut22ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut22:view', sourceHash: 'baa38ecc5eae6b1be93b03f581d058e88cc343bd4f759d236b1d917b244d7585', snapshotHash: '88ae3e799ee4154ca0023f19253aa52e7bd850bf465efcb37a8f3327383f8db7' },
    cut23ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut23:view', sourceHash: 'c8d0f091b39edf96f994a19c1ec2ed3304d9fc968c5d9de4f122af3dace8d019', snapshotHash: '1631f2acab7e06357086c5d42165b611477e9daa1e1438f3cd05dabc615c6928' },
    cut24ViewReference: { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'lan01:occupied:cut24:view', sourceHash: '787e1856c919f70fb6fd258dbe3609fb7cccf30802620bb22e58aee42edc113e', snapshotHash: 'c987caf4756f474d55caa1ec1a885dcea5dee204e21bba620efaa1a170365678' },
    cut24PrefixReference: { owner: 'pa_lifecycle_v1_work_prefixes' as const, sourceId: 'lan01:occupied:cut24:prefix', sourceHash: 'd5fccf8fb21301e3460192d35b6d38e093d910a7f7a19290256c730903284ac8', snapshotHash: '6d19eb420e109694de171afbac6955a633adb884efd96e9a74749063eed16d98' },
  }),
  sessionArchiveSnapshotHash: '755dab73958f28ce8d845cf6b189107be68cffaac4d4d1a2be6e4504b5b95d1d',
  reviewSession: Object.freeze({ sourceId: 'lan01:journal:session', sourceHash: 'd7650b3244fb66a57d7db36bb4b245c9afe758437c7692cc3a5bdde898a16415',
    revision: 0 as const, headSourceId: 'lan01:journal:session', headHash: '730e4e610a733eda1707b0f559c5414e7b46e7a082163e583f7b7d0e7788439b',
    projectionSnapshotHash: '608e74174f1c94eee5f2322e664d111b5ad5c66ae27e8be3a1efd301582752a5', seedSnapshotHash: 'faddad40873d7b2d04f45d104f89503078ca99cc8d84c09b77a2348e7a8a4784' }),
  priorCp24: LAN01_RETAINED_CHECKPOINT,
});

/** Exact LAN01-R15 cp1: only the original import returned after R12 cp16.
 * R15 was still running at audit time; its terminal/cleanup is not claimed. */
export const LAN01_RETAINED_REVIEW_IMPORT_CHECKPOINT = Object.freeze({
  ...LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT,
  sourceCommit: 'de3e5faa7beeea4bcfc0a0dca345eadfdd8afee5',
  publicSourceCommit: 'dfbb1e88017d56dc5e42f1c013b603a311f5fabd',
  sourceTree: 'b8cd9c0dfa7ed1e7b83ce8b833d03a754a21e698',
  runControlSha256: '59b123759bcabffb885144367a37ff9e80fde624052385873cc46df5bd1757d7',
  receiptSha256: '5257c2cb171ee560acb704f82062d7962c9641459d150c204c824ffe150c5a79',
  censusSha256: 'c472f14a9ac7bb3863b0df3bded93167253085a0a129e7ca64fba97a81f0c483',
  contentAuditSha256: '0c8cd920ee5ffef85605036d7ffe8ccc6f2ee915a2e20612116be1ea9f0bc666',
  priorRunTerminalSha256: null,
  priorRunOutcome: 'RUNNING_AFTER_RETURNED_IMPORT_AT_CHECKPOINT_AUDIT',
  gzipSha256: '18605d0643eb51e69c9e290fef93c436a77275c16b172d059ce869dcd83fcd50',
  databaseSha256: '60b73b1f5f5289cb9c86f128f129bde0d5ea7d8bda4be9805566589198082ee3',
  gzipBytes: 1402518, databaseBytes: 22654976, tableCount: 121, rowCount: 1985,
  checkpointSequence: 1, returnedOwnerCall: 1,
  firstRemainingWriter: Object.freeze({ owner: 'ActualPostPlayReview', method: 'acceptEvent', sourceId: 'lan01:journal:rights',
    argumentsHash: '7b560b75d07d5dca48a26e9ae8601f96bab08eed85f983cae811125d876d3538' }),
  reviewImport: Object.freeze({ ...LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT.reviewSession,
    revision: 1 as const, headSourceId: 'lan01:journal:import', headHash: '9da947d628e0f4bffd6d4b6c1ea2a5c6ae7405f37c577f98f2b7de10615c2f2a',
    projectionSnapshotHash: 'e9f260dd6d7688dac9483142855a9af0747c452a40d11d470b3d039fa3751d18',
    admissionSnapshotHash: 'f3e9c0b84480787854d8c82b2483ea4a3bba0668cc52ef46a16cdb3bb34dd935',
    importSource: Object.freeze({ sourceId: 'lan01:journal:import', sourceVersion: 'explicit-fixture-v1',
      capability: 'actual_post_play_review_event_v1' as const, sessionSourceId: 'lan01:journal:session', expectedRevision: 0,
      parent: { sourceId: 'lan01:journal:session', snapshotHash: '730e4e610a733eda1707b0f559c5414e7b46e7a082163e583f7b7d0e7788439b' },
      action: { kind: 'import_live_appeal' as const, executionReference: LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT.sealedBoundary.appealedReference } }),
  }),
  priorCp16: LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT,
});

export type LAN01RetainedSuffixInput = Readonly<{
  nativeReleased: boolean; checkpointGzip: string; destinationDirectory: string;
}>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const captureLAN01RetainedSuffixInput = (raw: LAN01RetainedSuffixInput): LAN01RetainedSuffixInput => {
  const input = cloneInert(raw);
  assert(input && Object.keys(input).sort().join('|') === ['nativeReleased', 'checkpointGzip', 'destinationDirectory'].sort().join('|'), 'LAN01 retained input fields differ');
  assert.equal(input.nativeReleased, true, 'LAN01 retained Native suffix must be reviewed and released');
  for (const value of [input.checkpointGzip, input.destinationDirectory]) {
    assert(typeof value === 'string' && isAbsolute(value), 'LAN01 retained paths must be absolute');
  }
  return input;
};

/** Authenticate before creating anything. No source database is opened, and a
 * destination is exclusive: a failed suffix always leaves inspectable evidence. */
export const prepareLAN01RetainedCheckpoint = (raw: LAN01RetainedSuffixInput) =>
  materializeLAN01RetainedCheckpoint(raw, LAN01_RETAINED_CHECKPOINT, 'lan01-cp24-pending-appeal-suffix.sqlite');

export const prepareLAN01RetainedReviewSessionCheckpoint = (raw: LAN01RetainedSuffixInput) =>
  materializeLAN01RetainedCheckpoint(raw, LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT, 'lan01-cp16-pending-import-suffix.sqlite');

export const prepareLAN01RetainedReviewImportCheckpoint = (raw: LAN01RetainedSuffixInput) =>
  materializeLAN01RetainedCheckpoint(raw, LAN01_RETAINED_REVIEW_IMPORT_CHECKPOINT, 'lan01-r15-cp1-pending-rights-suffix.sqlite');

const materializeLAN01RetainedCheckpoint = <P extends typeof LAN01_RETAINED_CHECKPOINT | typeof LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT
  | typeof LAN01_RETAINED_REVIEW_IMPORT_CHECKPOINT>(
  raw: LAN01RetainedSuffixInput, pin: P, filename: string,
) => {
  const input = captureLAN01RetainedSuffixInput(raw);
  const pinnedFile = (path: string, expected: string) => {
    assert.equal(realpathSync(path), path, 'LAN01 input must be a canonical file path');
    assert(lstatSync(path).isFile(), 'LAN01 input must be a regular file');
    const bytes = readFileSync(path); assert.equal(sha256(bytes), expected, 'LAN01 retained input hash differs'); return bytes;
  };
  // Each entry fixes its own audited bytes. The cp24 path still makes no claim
  // that its lost original witnesses were rechecked. Materialization itself
  // validates bytes; the release packet separately binds receipt and terminal.
  const gzip = pinnedFile(input.checkpointGzip, pin.gzipSha256); assert.equal(gzip.length, pin.gzipBytes);
  const bytes = gunzipSync(gzip, { maxOutputLength: pin.databaseBytes });
  assert.equal(bytes.length, pin.databaseBytes); assert.equal(sha256(bytes), pin.databaseSha256);
  assert.equal(realpathSync(dirname(input.destinationDirectory)), dirname(input.destinationDirectory), 'LAN01 output parent must be canonical');
  mkdirSync(input.destinationDirectory, { mode: 0o700 });
  const path = join(input.destinationDirectory, filename);
  writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  assert.equal(sha256(readFileSync(path)), pin.databaseSha256);
  return { input, path, pin, witnessRecheck: { originalRunControl: false, checkpointReceipt: false, tableCensus: false, priorRunTerminal: false } as const };
};
