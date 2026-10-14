# Accepted actor producer completion and reconsideration

This implements the moving-play completion policy approved on 2026-10-10 at 02:22:07 UTC: consume issued instructions, reactions and actions; reconsider newly received action-relevant information before closing. Capture and custody still require their independent factual proofs. The policy supplies actor observation/controller disposition, not a new motion, posture, baseball rule or automatic official result.

The boundary remains [canonical adjudication §3](../game-design/07-world-first-adjudication-contracts.md#3-two-closure-boundaries): physical PlayEnd comes from ActionFrontier; official closure still resolves its separate windows. `LivePlayRegistry` source completion and actor settlement retain their existing contracts.

## Explicit accepted policy

`consume_issued_work_reconsider_information_v1` is an optional policy value on an accepted defender observation, batter caught-response or occupied-runner caught-response Source. An original field-root Source may instead bind `actorProducerPolicies: [{ playerId, policy }]` to specified original participants. Root parsing requires unique, nonempty entries referring to original commands. The existing root calculation authenticates those commands against the complete original participant/body binding.

This value requests the approved behavior. It cannot claim completion. Unrecognized versions, extra completion flags and foreign root participants are rejected. Sources without this opt-in preserve their prior shape, observation refresh behavior and census/hash bytes.

The root route uses an already accepted command. `deriveSamePaPhysicalFieldRoot` requires exactly the original participant commands, zero body acceleration, five zero offset velocities/accelerations and zero original world velocity. It creates the actual five-part stationary primitives from authenticated bodies and contact time. A participant that never adopted a later motor therefore does not need a fabricated additional hold.

## Factual command consumption

`SamePlateAppearanceActorProducerPolicy` derives one of two proof bases:

- `original_stationary_command`: the opted-in original command remains in force, each original/intermediate/current part has the same exact center/radius and zero velocity/acceleration, and no later own motor replaces it. An inert reanchor may change primitive clock representation without changing that physical history.
- `executed_stopped_hold`: an accepted hold has its actual motor consumer, its reaction/start cut has passed by positive physical time, all five current parts are at rest, and any retained runner trajectory has no remaining active segment. Zero-time adoption alone does not consume a newly issued action.

Both retain original command, consumer, completion and exact time references. Neither proof substitutes for pending decisions, a newly received call, accepted run plans, another actor, contact/custody, or physical role coverage. A changed original position, a later active motor or remaining active trajectory invalidates the current hold basis.

## Observation and controller generations

The Native admitted-work reader authenticates one original field prefix, the original calls and admitted run plans, then derives the additive `actorProducerWork` sidecar. Its prefix must exactly equal the physical census prefix. No sidecar is emitted without policy opt-in; a closed/reset/outcome play cannot be reopened by reconsideration.

Every issued decision, caught-response process, received call, observation and admitted run plan retains its own causal generation. Pending or future work is not cleared when a newer hold exists. A response process keeps its original identity while its actual intermediate receipts advance. Completion carries an original field proof; queue emptiness and evaluation horizon alone cannot complete a source.

A terminal observation is derived only when prior issued same-actor decisions/responses have actual consumers, the preceding observation has been considered and the current command has factual stopped-hold proof. The real sample still consumes each outstanding refresh it actually samples. `refresh_not_due` does not consume work; absent targets keep their pending work. The policy suppresses only creation of that terminal sample's next refresh successor.

That sample itself creates controller reconsideration work. If its actual adopted decision or received-response motor starts a new non-hold action, a fresh observation generation uses the original attended/peripheral refresh deadlines until a subsequent actual sample consumes it. Completed older generations remain present. Later actual observations or received calls create new reconsideration obligations while the play is open.

`observationScheduling.complete` and `controllerRenewal.complete` require every source in their respective domain to carry completion. Exact consumed controller references are exposed with the player identity so a finalizer can discharge only those matching obligations. Other response, plan and controller-piece obligations remain independent.

## Independent end proofs and limits

The fair-catch finalizer owns the actual connection from these actor proofs to the existing producer registry. It must independently prove:

- Body motion: the current five-part state, role coverage and any retained controller pieces support rest; actor policy alone does not terminate an active curve or piece.
- Communication ingress: every accepted emitted recipient is actually delivered or dropped. A received call still requires the actor's response consumption.
- Ball/contact/custody: actual capture, retained custody and unchanged/sealed contact history remain authoritative. A held actor does not prove possession.
- Rules and other actors: every separate producer, rule window and original participant is covered before the frontier may be empty.

These are factual connections under existing contracts, not additional user policy choices. Moving runners, tag-up/force histories, unresolved acquisition, unsupported custody or future work are not qualified by this actor-policy slice. Official scoring and the next durable match state still require their established owners.

## Verification scope

The focused actor-policy tests use structural Native records with real Core field checkpoints. They check policy parsing, original stationary ownership, actual positive-time hold consumption, old pending work, refresh consumption, fresh information generations, inert reanchors, changed positions, no closed-play reopening and independent custody blocking. They do not claim a genuine complete SQLite fixture or a full occupied-play qualification. Integrated compiler/review/finite verification belongs to the combined batch.
