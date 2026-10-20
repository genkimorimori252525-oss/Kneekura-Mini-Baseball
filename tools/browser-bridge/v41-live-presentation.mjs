import {transformLiveV40} from './v40-live-presentation.mjs';
export function transformLiveV41(source,runtime){
 const html=transformLiveV40(source,runtime),before='presentationVersion:40';
 if(html.split(before).length!==2)throw new Error('v41 presentation guard');
 return html.replace(before,'presentationVersion:41');
}
