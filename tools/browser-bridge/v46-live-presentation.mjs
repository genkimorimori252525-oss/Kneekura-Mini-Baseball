import { transformLiveV45 } from './v45-live-presentation.mjs';
export function transformLiveV46(source, runtime) {
 const html = transformLiveV45(source, runtime);
 if (html.split('presentationVersion:45').length !== 2) throw Error('v46 presentation version guard');
 return html.replace('presentationVersion:45', 'presentationVersion:46');
}
