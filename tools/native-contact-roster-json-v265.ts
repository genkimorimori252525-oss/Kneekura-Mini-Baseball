import {isDeepStrictEqual} from 'node:util';
import {cloneInert} from '../src/core/adjudication/OfficialWindowPolicy';
import type {NativeContactRosterExportV264} from './native-contact-roster-export-v264';

/** Serialize data only. Neither this envelope nor its shape authenticates Native provenance. */
export function serializeNativeContactRosterJsonV265(payload:NativeContactRosterExportV264):string {
 const value=cloneInert(payload);
 if(value.version!=='native-contact-roster-export-v264'||value.boundary!=='LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT')throw Error('contact roster JSON payload version differs');
 const envelope={version:'native-contact-roster-json-v265',boundary:'LOCAL_JSON_DATA_ONLY',provenance:'NOT_AUTHENTICATED_BY_JSON',payload:value};
 const json=JSON.stringify(envelope,null,2)+'\n';
 if(!isDeepStrictEqual(JSON.parse(json),envelope))throw Error('contact roster JSON roundtrip differs');
 return json;
}
