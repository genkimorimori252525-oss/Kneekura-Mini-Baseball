import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {recoverRetainedTerminalPrefix,type RetainedRecoveryInput} from './TerminalRetainedPrefixRecovery.test-support';
it('TR-N01 authenticates and closes the exact retained one-pitch WAL prefix without admitting another pitch',()=>{
 const path=process.env.TERMINAL_RETAINED_PREFIX_RECOVERY_INPUT;if(!path)throw new Error('reviewed retained-prefix recovery input required');
 const receipt=recoverRetainedTerminalPrefix(JSON.parse(readFileSync(path,'utf8'))as RetainedRecoveryInput);
 expect(receipt.allHandlesClosed).toBe(true);expect(receipt.reopened).toBe(true);expect(receipt.ownerReceipts.physical.progressRevision).toBe(1);expect(receipt.aggregateP1Credit).toBe(0);
},1_700_000);
