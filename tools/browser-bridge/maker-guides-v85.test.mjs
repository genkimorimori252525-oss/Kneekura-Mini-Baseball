import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root={};vm.runInNewContext(readFileSync(new URL('../../docs/demos/baseball-maker-guides-v85.js',import.meta.url),'utf8'),{globalThis:root});
it('explains settings-axis gyro decomposition without rewriting the requested settings',()=>{
 const input=Object.freeze({rpm:2400.12345,gyro:.6}),before=JSON.stringify(input),r=root.KneekuraMakerGuidesV85.spinGuide(input);
 expect(r.activePercent).toBeCloseTo(80,12);expect(r.activeRpm).toBeCloseTo(1920.09876,9);
 expect(r.gyroPercent).toBe(60);expect(r.basis).toBe('SETTINGS_AXIS_ESTIMATE_NOT_MEASURED_ACTIVE_SPIN');expect(JSON.stringify(input)).toBe(before);
 expect(root.KneekuraMakerGuidesV85.spinGuide({...input,gyro:-.6})).toEqual(r);
});
it('handles zero rotation and unfinished/out-of-range inputs without clamping or fake measurements',()=>{
 expect(root.KneekuraMakerGuidesV85.spinGuide({rpm:0,gyro:.7}).activeRpm).toBe(0);
 for(const input of [{rpm:NaN,gyro:0},{rpm:-1,gyro:0},{rpm:2400,gyro:1.1},{rpm:'',gyro:0}])expect(root.KneekuraMakerGuidesV85.spinGuide(input)).toBeNull();
});
