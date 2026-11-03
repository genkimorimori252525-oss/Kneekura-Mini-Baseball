# Latest direct human priority — tiny free-ball dot, batter labels, handedness

The human accepts v34 and requests a barely visible tiny white dot for distant overhead balls, while retaining invisible held/caught balls. Hide the standing batter's field name in every camera, show it in usual red once running starts, and fix the apparent right-handed swing assigned to left batters.

This explicitly authorizes these small presentation changes. Preserve v31/v34 UI/pacing and previous artifacts. Investigation found L/R measured clips and adopted sprites correctly selected; the legacy close batter camera was on the opposite side from Core's box. Correct camera x/yaw to the actual batting side, and use Core's declared battingSide for rendering. Do not mirror Source bat geometry or change collision truth to conceal a camera error.

The rest of the original plan remains in progress. Charter UNAPPROVED/HOLD and all prior FAIL evidence remain; this document records direct human scope, not machine Charter approval.
