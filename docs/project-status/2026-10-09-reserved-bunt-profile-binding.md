# Reserved-PA explicit bunt profile binding

The physical commitment owner can now use an explicitly accepted existing
course profile for the original pre-launch bunt intent. A bare bunt intent
still returns `owned_bunt_physical_profile_required`. The optional commitment
Source binding pins the original intent, current lifecycle view, participant
and Person/workload hashes, normal batting model, lifecycle swing calibration,
effective repertoire identity, and exact profile identity/version/hash. Every
pin must match the authenticated prepared input and the profile used by the
existing Core calculation. A mismatched declaration rejects without selecting
another profile or changing the existing calculation.

This implements the connection permitted by
`2026-09-17-contact-physics-vertical-slice-design.md` §Bunt and
`2026-10-05-owned-batting-intent-and-same-pa-foul-resume.md` §Contract 1 / sequence 1:
bunts use the common contact mechanics, and separately accepted ordinary/bunt
intents may accompany equal physical curves. The binding does not infer intent
from speed, an action name or a Presentation label. No collision equation,
decision policy, motion parameters, body defaults or contact result is added.

The current course-profile planner retains its existing trajectory geometry.
This change does not produce a low-speed holding/pullback bunt profile, choose
production bunt parameters or qualify a broader bunt model. An authority must
explicitly accept the profile's use for that attempt. Missing accepted inputs
remain pending. A genuinely different production bunt trajectory family would
need its own approved model and accepted parameters; the shared rigid bat and
contact engines already provide the mechanical seam.

Five short Source/Core author cases passed in 5.20 seconds after the intended
Source rejection was observed. They check exact binding, missing declaration,
foreign/stale dependencies, altered effective values, TAKE/ordinary misuse,
strict shapes and accessor rejection. They do not authenticate a Native graph.
`BPN01` stages one real-owner synthetic scenario with pre-launch intent,
missing/foreign binding rejection, unchanged failed-append heads, actual
commitment/contact, World revision adoption and authority-free replay. It reuses
the existing explicit course unchanged and is not a production bunt calibration.
Native execution and compiler acceptance are reserved for the consolidated
batch; no result is claimed for them here.
