/** The V249 10–25° descriptive reference, not an ability or official BBE classification. */
export function classifyLineDriveAngleBandV262(angle:number):'BOUNDARY_25'|'LINE_DRIVE_BAND'|'OUTSIDE' {
 return angle===25?'BOUNDARY_25':angle>=10&&angle<25?'LINE_DRIVE_BAND':'OUTSIDE';
}
