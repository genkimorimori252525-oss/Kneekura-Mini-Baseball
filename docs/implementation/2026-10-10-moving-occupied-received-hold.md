# Moving occupied runner: received hold and physical completion

This is the mechanical continuation of the [approved actor completion policy](2026-10-10-actor-producer-completion-policy.md), within original nonvisual body/contact/controller scope. It does not choose a retreat, turn, route or legal final base. The accepted hold supplies the action; the original runner motion and calibration supply its physical law.

## Accepted original controller

The existing `occupied_runner_catch_response_v1` Source may add:

```ts
motionBasis: {
  kind: 'occupied_runner_motion_v1';
  motionReference: SamePaReference<'pa_physical_v1_field_steps'>;
}
```

The reference must be the latest actual original occupied-runner advance for that participant. Native authenticates the current workload member, original runner/Person/body/hold, enrollment, physical pitch, admitted caught work and actual received OUT. The moving binding preserves the incumbent route and original runner calibration. It rejects stale references, a changed body, route/model overrides, a missing moving basis and an end beyond the original hold/body authority. The incumbent trajectory must cover the actual sampling cut. An explicitly accepted replacement may choose a later finite end within that original authority; it does not renew itself automatically.

The original stationary request/result remains unchanged when `motionBasis` is absent. A moving prefix cannot use that legacy arm to relabel itself stationary. The moving arm authenticates the original participant and incumbent directly; it does not require a stationary rule-history sidecar or modify any rule result.

The additive response contains the accepted `motionBasis`, the derived `controller` and, at a fractional physical cut, `exactTrajectory`. The existing `originalHold` retains the sole body/model identity. Sampling uses the incumbent route-motion law at the actual continuous cut. The existing exact-origin law retains absolute accepted issuance and reaction time, `issuedTick + reactionDelayTicks`; it does not backdate reaction to the fractional origin.

## Actual adoption and execution

The moving `occupied_runner_catch_motion_v1` uses `deriveSamePaRunnerControllerMotion`, including original five-part continuity, straight-route bounds, reaction/braking, foreign finite coverage and exact analytic knots. Its result adds the existing `controllerSegmentIndex` and optional `exactControllerPiece` fields. No new physiology, body pose trajectory or numerical braking parameter is introduced.

An actual zero-time motor may replace the selected command and renew its own exact coverage without consuming positive-time work. Other due owners remain due. The pending-response guard distinguishes that actual adoption from a response merely being accepted. A pending response reserves its first motor; an adopted response prohibits further execution of its superseded advance.

`occupiedRunnerMotions` retains every original command/history entry. It adds `supersededBy: { responseReference, adoptionReference }` only after the actual replacement motor. Its old future work then belongs to the caught controller. Before adoption, the original advance's reaction/piece/end obligations remain present. The caught census retains pending adoption until positive execution and then retains reaction, exact-piece and finite-end work.

A numerical binding defect was exposed by real braking at a fractional stop: the analytic controller had canonical speed zero while the field polynomial retained a floating residual velocity. When a newly adopted analytic piece is stationary, the shared adapter first applies its existing position/velocity continuity check, then reanchors that actor's exact centers with the accepted canonical zero velocity. It preserves preceding records, contact history and foreign actors. There is no new epsilon or relaxed completion tolerance, and an already identical canonical state keeps its previous representation.

## Completion and downstream contract

The current-stopped-hold owner checks the occupied controller's remaining trajectory, including its actual fractional origin. A past advance no longer permanently disqualifies a later executed hold. Current body velocity and acceleration must still be exactly zero; reaction completion and future active trajectory checks remain required.

Actor completion retains each original occupied-motion source until actual held execution consumes it. `consumedControllerReferences` then includes each completed original motion step, the caught response and any inert exact caught-controller piece. The finalizer must match player and exact reference, require complete actor domains and independently prove body/contact/custody/communication/rule completion. Supersession alone is not PlayEnd.

Historical movement, base/retouch/home contacts, original accepted call meaning, appeals and final entitlement belong to the parallel rule/outcome owners. This slice provides no final base ledger, scored runs or official result. A call already accepted before movement can be received afterward without rewriting its historical view; making a call during moving history requires the separate rule/call applicability adapter.

## Verification boundary

Focused tests use structural Native dependencies with real Core route motion, five-part field execution and exact reception. They cover advance/reaction/braking/rest, residual-stop binding with unchanged preceding history, fractional zero/positive reaction delays, zero-time adoption with pending consumption, supersession and stale/body/finite-authority rejection. Existing occupied, batter, exact-piece, actor-completion and census cases are included in the affected selection. This is not a full SQLite scenario qualification; the combined batch owns review/compiler/finite verification.
