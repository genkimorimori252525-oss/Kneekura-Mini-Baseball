# National fixture participation variants

This extends the original Regional group connection recorded in
[the preceding status note](2026-10-09-regional-national-physical-participation.md).
It is part of the approved non-design participation/Career work. It adds no
competition calendar, host, qualification, numerical policy or gameplay model.

## Connected existing contracts

The additive `national-match-origin-v1` source follows these existing producers:

- Regional National group, quarterfinal where applicable, semifinal and final;
- Premier12 group, semifinal, bronze and final;
- WBC finals group, round of 16, quarterfinal, semifinal and final;
- WBC global qualifier semifinal and final.

The fixture reader uses the accepted schedule and the existing fixture resolver
for the exact date, venue, Nations and fixture event identity. Later-round
entrants require the original completed predecessor results. It compares the
result to the actual Match fixture on the consuming Native connection.

WBC qualification reads the existing World qualification owner for ordinal 2
and later, the two immediately preceding accepted WBC histories, Regional
placements, coefficient and direct/qualifier berth owners. Finals also replay
the accepted draw, host and Edition owners. Qualifier fixtures and callups use
the accepted qualifier Edition, entrant selection, pinned roster eligibility,
World infrastructure and access evidence. Missing source owners or inputs fail
closed. No descriptor supplied by a participation caller replaces this graph.

Existing tournament owners expose borrowed Native read capabilities. Their
path-based writers keep schema and connection ownership. The borrowed facades
neither create schemas nor expose writes or close the consuming connection.
The World qualification reader also borrows its coefficient and direct-berth
readers instead of opening writer connections.

## Original evidence and consumers

Fixture-input readers stop before the target round's result and later tournament
outcomes. Full tournament/history readers still authenticate those outcomes.
This prevents an original participant proof from depending on the same Match
final or a later history adoption. Original qualification, roster, Person,
legal eligibility and representation prefixes remain authenticated.

The source feeds the already connected initial World, batter/pitch and ordinary
physical closure owners, then `NATIONAL_PHYSICAL_PLAY_V1` participation,
National appearance adoption and the existing Career game fact. It does not
change Club assignment or invent a running fact. Existing binary game/Player
collision behavior, receipt identities, private-connection replay, retry and
fresh-current admission boundaries remain in force.

`national-regional-group-origin-v1` retains its original derivation and bytes.
Domestic and legacy participation encodings are unchanged. Foul/terminal and
batted National participation are separate connections; this note does not
claim them complete.

## Input boundary still open

[National persistence, “Remaining implementation boundaries”](2026-09-30-national-competition-persistence.md#remaining-implementation-boundaries),
in particular its first-two-historical-cycle paragraphs, explicitly leaves
bootstrap qualification/draw, eligibility lists, World facility/access facts
and numerical policies as test inputs. A production bootstrap owner for those
first two WBC cycles is absent. The new reader does not invent one, seed fake
histories or accept test descriptors as production history. The existing
ordinal-2-and-later wiring is implemented independently; a fully rooted Native
WBC physical participation acceptance still requires those accepted production
inputs. No new calibration or bootstrap approval is implied by this change.

## Verification scope

Author checks use small explicit qualification fixtures and the existing WBC
owner tests. Regional checks exercise both two- and four-group knockout forms.
Premier12 checks cover the original group, semifinal and medal inputs, later
ranking adoption and actual initial World/batter membership. WBC owner controls
exercise borrowed query-only readers, each original knockout stage, qualifier
finals, accepted-history drift and omitted current/future result dependencies.
Those WBC owner fixtures are not a claim of a rooted production WBC run.

Final counts and source attribution are in the consolidated batch record.
No full physical tournament, genuine regeneration or broad isolated gate was
run for this delta. The initial Premier schedule fixture exceeded its accepted
window at two games per venue/day; it now uses the existing explicit three-game
fixture policy. This is a test input correction, not a production default.

The Native graph reuses Match reads only within the existing synchronous source
read phase; it keeps no cross-operation cache. Changed original result and
ranking checks run in later traversals to ensure new writes remain visible.
