# Regional national generated Edition — 2026-10-01

## Approved scope

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, documents 11 section 13 and 12 section 10. Regional Edition assembly consumes accepted enrollment, regional ranking/draw, hosting and calendar provenance. Policies and draw seeds are explicit. Hosting grants no additional berth. No design/UI connection or merge is included.

## Implemented

- Native Edition assembly generates group and knockout metadata from accepted Native draw/hosting owners and dated Nation authority. Caller profiles specify format/rules, standings/third-place/placement criteria, opening pairs and indices into selected host venues; callers cannot supply arbitrary country lists or venue IDs.
- Generated group/knockout metadata, complete draw/hosting Source evidence and a compact snapshot ID are frozen per Edition. Format profiles are separately frozen by Career/competition/format version. Reopening revalidates stored profiles and actual Source owners.
- Optional Edition Sources in group, knockout and schedule owners reject mismatched metadata. Knockout and schedule independently compare both the accepted group Edition and knockout Edition, including when their group source is a legacy owner.
- An explicit draw profile may choose ranking-only or qualified-host-first Pot 1 candidates. Qualified hosts are ordered by regional ranking; unqualified cohosts are never added to enrollment. Draw and Edition consume the same accepted hosting candidates. Omitted policy fields preserve the legacy draw DTO/hash.
- Fixture registration and downstream replay use operation source scopes/fresh writer phases. Proof reads are discarded after each operation and writer phase; no persistent evidence cache is introduced.

## Evidence boundary

The 8/12/16-country assembly tests use actual Native legal facts, callups, roster capability, calendar, Nation, facilities, hosting, ranking snapshot, draw, Edition and downstream owners. Previous ranking history and explicit policy/calibration values remain fixtures. Tests cover replay/reopen, immutable seeds, SQL/profile corruption, group/KO/schedule metadata substitution and partial connections.

The four-region gate plays 118 prior actual Match games, uses their accepted regional ranking and hosting evidence to generate next-cycle Editions, and then plays all 118 generated next-cycle Match games. Next-cycle country enrollment is an explicit capability fixture in this gate; the smaller assembly gate exercises actual Native capability. Historical first-cycle metadata remains a fixture rather than a generated new-career bootstrap. The nine-inning Match helper drives actual official state with scripted events; this is not a physical trajectory-generation gate.

One independent review found a partial-connection guard omission. A failing regression reproduced it for all three supported country counts; knockout/schedule now independently validate accepted group metadata. Focused verification: 2 files / 7 tests passed in 17.51 seconds; typecheck succeeded. Final reviewed `npm run verify`: catalog compilation/typecheck succeeded; 516 files / 3,100 tests passed in 264.81 seconds, including the four-region generated Edition/Match gate. No rereview was performed.

## Remaining

A combined actual Native national roster/participation and generated Edition/Match lifecycle, production calibration/content/bootstrap and the broader approved population/runtime/career/physics integrations remain to connect. This slice does not complete the overall nonvisual goal.
