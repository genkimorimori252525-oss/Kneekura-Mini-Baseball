import {transformLiveV52} from './v52-live-presentation.mjs';
function once(source,before,after){
 if(source.split(before).length!==2)throw Error('v53 running instruction guard: '+before.slice(0,90));
 return source.replace(before,after);
}
export function transformLiveV53(source,runtime){
 runtime=once(runtime,"location:$('location-choice').value,managedTeam:Number($('managed-team').value)",
  "location:$('location-choice').value,managedTeam:Number($('managed-team').value),baserunning:$('baserunning-choice').value");
 runtime=once(runtime,"['batting-choice','pitch-choice','location-choice','managed-team']",
  "['batting-choice','pitch-choice','location-choice','managed-team','baserunning-choice']");
 let html=transformLiveV52(source,runtime);
 html=once(html,'presentationVersion:52','presentationVersion:53');
 return once(html,'<label>投球の指示<select id="pitch-choice">',
  '<label>走塁の指示<select id="baserunning-choice"><option value="balanced">バランス</option><option value="conservative">保守的</option><option value="aggressive">積極的</option></select></label><label>投球の指示<select id="pitch-choice">');
}
