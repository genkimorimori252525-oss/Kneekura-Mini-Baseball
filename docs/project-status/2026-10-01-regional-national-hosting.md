# Regional national hosting source connection — 2026-10-01

## Approved scope

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, documents 11 section 13 and 12 section 10. Regional hosting uses one Nation or cohosts, regional rotation and facilities/logistics. Full League membership is not a hosting requirement. Hosting grants no berth or ability adjustment. No visual implementation is included.

## Implemented

- Core candidate derivation consumes explicit versioned venue minima, suitability weights, rotation penalties and host/venue counts. No production numeric defaults are supplied.
- Native regional hosting candidates consume accepted World selection/cutoff, World facilities, dated Nation membership and prior completed official regional competition evidence.
- The facility owner preserves the event-era journal and exposes a cutoff projection. The candidate owner also pins the corresponding cutoff Nation proof; a country moving to another region cannot host its former region based on stale facility membership.
- Deterministic host selection checks group, knockout and final facility feasibility before choosing one Nation or two cohosts. Exact cohosts must both supply group venues. Venue reuse across stages is allowed; no additional regional city-count rule is inferred.
- Regional history exposes accepted group and knockout metadata. Rotation includes all used group/opening/semifinal/final venues, validated against Native facilities at the predecessor selection cutoff. Current or later Editions are rejected before following metadata back into their own selection graph.
- Career hosting policy versions and Edition requests are frozen. Source/data corruption, changed earlier metadata, wrong cutoff and future source effects are covered by replay/reopen checks.

## Evidence boundary

Focused verification: 3 files / 5 tests passed in 20.73 seconds; typecheck succeeded. The existing four-region gate plays 118 actual Native Match games and feeds actual history/metadata plus Native World facilities/Nations into next-cycle hosting. Previous competition enrollment/metadata and next-cycle roster capability remain explicit fixture boundaries of that gate; generated Edition assembly is the next scope.

One independent review found a cross-stage venue-location inconsistency at the public Core boundary. A failing regression reproduced it; the fix rejects conflicting Nation/city/region locations for the same venue ID. Final reviewed `npm run verify`: catalog compilation/typecheck succeeded; 515 files / 3,096 tests passed in 262.16 seconds. No rereview was performed.

The smaller host-candidate test uses actual facility/Nation/calendar owners with explicit prior official history/metadata fixtures. Public facilities use `sourceClubId: null`; no hidden Full League or Club rating requirement is introduced.

## Remaining

Generated Regional group/knockout Edition profiles, the accepted hosting/Edition Source guards in group/knockout/schedule owners, qualified-host Pot 1 candidate treatment and a combined Native roster/hosting/Edition/Match lifecycle remain to connect. Production calibration/content, first-career historical bootstrap, population and the broader approved career/runtime/physics integrations are still unfinished. The overall nonvisual goal remains active.
