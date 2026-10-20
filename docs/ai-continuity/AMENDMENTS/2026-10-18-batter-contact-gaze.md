# Human correction — batter gaze through swing completion

The human asks the batter to continue looking at the location where they decided to hit the ball until the swing finishes, then use the existing batted-ball tracking camera. This directly authorizes this bounded Presentation change to current v41. Keep the other cameras, game UI, canonical physics, measured swing execution and official results unchanged.

Use the actual motor's planned sweet-spot target (forecast position plus aim error), and its finite measured reference end. Do not use the eventual actual impact position, a future ball position, or the static body-sprite hold as authority. Retain first-person self-body hiding when Core changes the batter's role to runner during follow-through; reuse existing close-body raster clipping so the nearby catcher does not obscure the target.

Deliver a separate v43 HTML; preserve v41 and unrelated v42 prototype files. This records explicit chat scope, not Charter approval. Original plan, CHARTER_UNAPPROVED/HOLD, historical FAIL/UNKNOWN and prior evidence remain.
