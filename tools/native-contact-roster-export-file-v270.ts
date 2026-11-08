import type {DatabaseSync} from 'node:sqlite';
import type {writeContactRosterFileV267} from './native-contact-roster-file-v267';

/** Disabled: arbitrary DB-to-path output cannot establish sidecar isolation. */
export function exportNativeContactRosterFileV270(_db:DatabaseSync,_input:Readonly<{careerId:string;rosterSnapshotId:string}>,_outputPath:string):Readonly<{version:'native-contact-roster-export-file-v270';file:ReturnType<typeof writeContactRosterFileV267>}> {
 throw Error('native contact roster file V270 is unavailable; use V272 bytes API');
}
