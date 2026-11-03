import {transformLiveV47} from './v47-live-presentation.mjs';
export function transformLiveV48(source,runtime){
 const html=transformLiveV47(source,runtime);
 if(html.split('presentationVersion:47').length!==2)throw Error('v48 presentation version guard');
 return html.replace('presentationVersion:47','presentationVersion:48');
}
