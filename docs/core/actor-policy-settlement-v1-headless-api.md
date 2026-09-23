# Actor policy settlement v1 — headless API

`resolveLivePlayFromActorPolicies` derives `ActorPlayDisposition` from the existing runner and defender decision functions, a canonical world snapshot and a live-play source registry. The host supplies one accepted decision event ID and decision input for every runner and defender in the world snapshot.

A policy decision whose decision tick is still in the future stays `decision_pending`. Advance, retreat, active defensive assignments and tag-up first-touch waiting stay active. A hold decision settles an actor only after the decision tick, once all event sources have explicit completion evidence and the actor is physically stopped. The defender's canonical assignment must also be `hold`. Zero velocity alone never settles an actor.

The wrapper checks that decisions cover every world actor exactly once, observations are not from the future, match and registry play IDs agree, and a moving ball has a live physical source. It then invokes the existing registry/ActionFrontier PlayEnd resolution with the derived actor dispositions. Terminal-condition handling remains in the existing ActionFrontier.

The host still owns canonical decision-event recording and truthful physical/event-source completion. The `decisionEventId` is a provenance reference supplied by the host; this v1 does not prove that the ID appears in an external event store. Manager/team AI and official adjudication are separate layers.
