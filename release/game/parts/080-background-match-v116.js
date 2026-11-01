/* Same Core in a bounded background queue. Only consumed records become public. */
(function(root){
 'use strict';
 const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 const aborted=()=>Object.assign(new Error('未表示の投球生成を取り消しました。'),{name:'AbortError'});
 function workerMain(){
  let configuration,continuation,command,epoch,credits=0,scheduled=false,ended=false;
  const fail=e=>self.postMessage({kind:'error',epoch,error:{name:e.name,message:e.message,stack:e.stack}});
  function run(){
   scheduled=false;if(!configuration||!credits||ended)return;credits--;
   try{
    const host=KneekuraNativeMatchCore.createLiveBaseballMatchWorkerV116(configuration,continuation),
     record=host.issuePitch(command),{history,...snapshot}=host.inspect();
    continuation=host.captureContinuationV116();const boundary=record.beforeMatch.half!==record.match.half||record.beforeMatch.inning!==record.match.inning;
    ended=record.finished||boundary;
    self.postMessage({kind:'record',epoch,record,snapshot,continuation,boundary});
    schedule();
   }catch(e){ended=true;fail(e);}
  }
  function schedule(){if(!scheduled&&credits&&!ended){scheduled=true;setTimeout(run,0);}}
  self.onmessage=({data:m})=>{
   if(m.kind==='init'){configuration=m.configuration;continuation=m.continuation;command=m.command;epoch=m.epoch;credits=m.credits;ended=false;schedule();}
   else if(m.kind==='credit'&&m.epoch===epoch){credits+=m.count;schedule();}
  };
 }
 function create({configuration,initialHost,coreSource,lookAhead=12,warmup=1,workerFactory}={}){
  if(!Number.isSafeInteger(lookAhead)||lookAhead<1||lookAhead>16||!Number.isSafeInteger(warmup)||warmup<1||warmup>lookAhead)
   throw Error('投球の先読み件数が正しくありません。');
  let snapshot=initialHost.inspect(),continuation,worker=null,url=null,epoch=0,currentCommand=null,queue=[],pending=null,disposed=false,warming=true,failure=null;
  const accepted=[],stats={generated:0,consumed:0,discarded:0,cancellations:0,underflows:0,maximumQueue:0};
  let publicSnapshot=freeze({...snapshot,history:[]});
  const source=coreSource??Array.from(root.document.scripts).find(s=>s.textContent.includes('var Knee'+'kuraNativeMatchCore =')&&s.textContent.includes('__to'+'CommonJS'))?.textContent;
  if(!source)throw Error('バックグラウンド用の共通Coreがありません。');
  const key=c=>JSON.stringify(c),same=c=>currentCommand!==null&&key(c)===key(currentCommand);
  function close(){if(worker){worker.terminate();worker=null;}if(url){root.URL.revokeObjectURL(url);url=null;}}
  function cancel(){epoch++;stats.discarded+=queue.length;queue=[];close();if(pending){pending.reject(aborted());pending=null;}warming=true;failure=null;}
  function deliver(){
   if(!pending)return;if(failure&&!queue.length){pending.reject(failure);pending=null;return;}
   if(queue.length<(warming?warmup:1)&&!queue.at(-1)?.record.finished&&!queue.at(-1)?.boundary&&!failure)return;
   const item=queue.shift();if(!item)return;
   const request=pending;pending=null;warming=false;continuation=item.continuation;snapshot=freeze(item.snapshot);
   const record=freeze(item.record);globalThis.__robinObservedWorkerRecord=record;globalThis.__robinAcceptedContinuation=item.continuation;accepted.push(record);stats.consumed++;publicSnapshot=freeze({...snapshot,history:[...accepted]});
   if(item.boundary){close();currentCommand=null;warming=true;}
   else worker?.postMessage({kind:'credit',epoch,count:1});request.resolve(record);
  }
  function start(command){
   if(disposed)throw aborted();if(snapshot.finished)return;
   if(failure&&same(command))return;
   if(failure){cancel();currentCommand=null;}
   if(worker&&same(command))return;
   if(worker||queue.length||pending){stats.cancellations++;cancel();}
   currentCommand=structuredClone(command);const ticket=++epoch;
   try{
    if(workerFactory)worker=workerFactory();
    else{url=root.URL.createObjectURL(new root.Blob([source,'\n;(',workerMain.toString(),')();'],{type:'text/javascript'}));worker=new root.Worker(url);}
    worker.onmessage=({data:m})=>{
     if(disposed||m.epoch!==epoch||ticket!==epoch)return;
     if(m.kind==='record'){
      queue.push(m);stats.generated++;stats.maximumQueue=Math.max(stats.maximumQueue,queue.length);
      if(queue.length>lookAhead){failure=Error('投球の先読み件数が上限を超えました。');close();}
      deliver();
     }else if(m.kind==='error'){failure=Object.assign(new Error(m.error.message),m.error);close();deliver();}
    };
    worker.onerror=e=>{if(ticket!==epoch)return;failure=Error(e.message||'バックグラウンドの投球生成に失敗しました。');close();deliver();};
    worker.postMessage({kind:'init',epoch:ticket,configuration,continuation,command:currentCommand,credits:lookAhead});
   }catch(e){failure=e;close();throw e;}
  }
  function issuePitch(command){
   if(disposed)return Promise.reject(aborted());if(snapshot.finished)return Promise.resolve(null);
   try{start(command);}catch(e){return Promise.reject(e);}
   if(pending)return Promise.reject(new Error('同じ投球の生成を重複して要求しました。'));
   if(!warming&&!queue.length)stats.underflows++;
   return new Promise((resolve,reject)=>{pending={resolve,reject};deliver();});
  }
  return Object.freeze({issuePitch,inspect:()=>publicSnapshot,
   prefetch:command=>{start(command);},invalidate:command=>{if(command&&same(command))return;stats.cancellations++;cancel();currentCommand=null;},
   dispose:()=>{disposed=true;cancel();},generationV116:()=>Object.freeze({...stats,queued:queue.length,pending:!!pending,
    warming,mode:'SAME_CORE_BACKGROUND_BUFFER_V116',lookAhead,warmup})});
 }
 root.KneekuraBackgroundMatchV116=Object.freeze({create});
})(globalThis);
