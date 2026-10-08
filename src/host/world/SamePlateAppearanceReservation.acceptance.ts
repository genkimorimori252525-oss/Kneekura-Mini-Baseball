import { mkdtempSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect,it } from 'vitest';
import { verifyGenuineSamePaReservation } from './SamePlateAppearanceReservation.test-support';

it('SP-R01 genuine ten-reference enrollment reserves one root and blocked slot with exact retry and normal reopen',()=>{
  const path=process.env.SAME_PA_RESERVATION_INPUT,sha=process.env.SAME_PA_RESERVATION_INPUT_SHA256,output=process.env.SAME_PA_RESERVATION_OUTPUT_DIRECTORY;
  if(!path||!sha||!output)throw new Error('explicit held/released reservation controller input required');
  const directory=mkdtempSync(join(output,'same-pa-reservation-'));
  const receipt=verifyGenuineSamePaReservation({inputPath:path,inputSha256:sha,destinationPath:join(directory,'reservation.sqlite')});
  writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  expect(receipt.newRootRows).toBe(1);expect(receipt.newMemberRows).toBe(10);expect(receipt.newBlockedSlotRows).toBe(1);
  expect(receipt.physicalPitchWriterInvoked).toBe(false);expect(receipt.reservationReleased).toBe(false);
});
