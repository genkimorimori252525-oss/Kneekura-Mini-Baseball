import {createRequire} from 'node:module';
import {Session} from 'node:inspector';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

/** Diagnostic interruption only. A stopped partial proof never qualifies a
 * skill. Restore Native prepare BEFORE throwing, so owner cleanup still runs. */
export function startSpinExposureCpuV126(){
 const folder=process.env.BASEBALL_SPIN_EXPOSURE_CPU;
 if(!folder)return ()=>{};
 mkdirSync(folder,{recursive:true});writeFileSync(resolve(folder,'.gitignore'),'*.cpuprofile\n');
 const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),
  original=DatabaseSync.prototype.prepare,session=new Session(),start=performance.now(),limitMs=8000;
 let stopped=false,calls=0;
 session.connect();session.post('Profiler.enable');session.post('Profiler.start');
 const stop=()=>{
  if(stopped)return;stopped=true;DatabaseSync.prototype.prepare=original;
  session.post('Profiler.stop',(error,result)=>{if(error)throw error;
   writeFileSync(resolve(folder,'top-exposure.cpuprofile'),JSON.stringify(result.profile),{flag:'wx'});
   writeFileSync(resolve(folder,'capture.json'),JSON.stringify({boundary:'INTENTIONALLY_INTERRUPTED_NATIVE_PROOF_DIAGNOSTIC',
    nativeAdmission:false,sqlPrepareCalls:calls,limitMs,elapsedMs:performance.now()-start},null,2)+'\n',{flag:'wx'});
  });session.disconnect();
 };
 DatabaseSync.prototype.prepare=function(...args:Parameters<typeof original>){
  calls++;
  if(performance.now()-start>=limitMs){stop();throw Error('intentional Native exposure CPU diagnostic interruption');}
  return Reflect.apply(original,this,args);
 };
 return stop;
}
