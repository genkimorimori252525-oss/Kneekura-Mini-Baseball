# Club World v1 — Headless Lifecycle / Accounting API

Source: frozen docs 16/18/19/26 at `782f6b8ef2406839de5678b00040001111cd8f77`.
Implementation base: human-control PR #28, `d75be49e584129b992ec710c813f8d8e7bae1739`.
Import public operations and types from `src/core/world/club/index.ts`.

## Implemented surface

| Operation | Input | Result |
| --- | --- | --- |
| `createClubFromSeed` | `ClubCreationInput` accepted through an unknown-data parser | `ClubResult<ClubWorldState>` |
| `restoreClubState` | unknown serialized checkpoint | `ClubResult<ClubWorldState>` |
| `applyClubCommand` | current state + unknown command | accepted state/event or original state/reason |
| `replayClubEvents` | trusted checkpoint + unknown accepted-event array | complete reconstructed state, or reason without partial state |
| `getClubFinanceSummary` | current state | `ClubResult<ClubFinanceSummary>` |
| `getCurrentClubManager` | current state | `ClubResult<ClubManagerAppointment | null>` |

All operations are synchronous and side-effect-free. Successful outputs are detached, deeply frozen values. Source inputs are not frozen or mutated. There are no UI components, callbacks, rendering imports, filesystem writes, random draws or Match Core modifiers.

These APIs expect serialized plain data, not executable JavaScript objects. Unknown keys, sparse arrays, symbol fields and accessors are rejected; opaque string IDs are preserved, not split on delimiters. This is schema validation, not a sandbox for hostile Proxy objects.

## Creation and authority

`ClubCreationInput` requires a host-authenticated CREATION context, a resolved seed row with stable identity/source provenance and independent initial operating inputs. A RUNNING context or an already registered club ID is rejected. The host must atomically register the club: two concurrent creation requests cannot both be allowed by separate stale registries.

Identity is immutable: clubId, canonicalOriginId, foundingIdentityRef, originCountryId, historicalHomeCityId and sourceArchetype. Ordinary rename and relocation never create a new club or rewrite its origin.

The saved seed record pins catalog/dataset/source snapshots, confidence, optional override reason, transform version and the monetary-normalization version. There is deliberately no current-catalog argument on restore, transitions or replay.

`club-seed-direct-v1` is an explicit initial calibration, not an assertion of real-world finance:

- finance target initializes commercial-network/financing/owner-backing components;
- popularity initializes supporter and brand capital;
- development initializes institutional/academy know-how and training/academy facilities;
- scouting initializes recruitment network and scouting/analytics infrastructure;
- venue initializes stadium quality/asset capital and medical/operations infrastructure.

This simple transform has no random variance. Actual cash, debt, budgets, recurring-revenue capacity, stadium capacity and geometry reference are supplied separately. No rank is converted silently into a monetary amount or a ballpark mesh. Regional data ingestion and richer club-specific structural compositions remain separate calibration/integration work.

After creation, component states change only through explicit commands; the initial targets are never used to regenerate runtime state. L4 ranks, giant/crisis/recovery descriptors and copied player/manager internals are not valid persistent state fields.

## Commands and atomicity

Every command binds eventId, careerId, clubId, expectedRevision, effectiveDay, nonempty causeEventIds and nonempty operations. Wrong-world, stale, backdated and overflowed requests fail. One accepted batch increments revision once. A late failure returns the exact original state object, no accepted event and no historical snapshot. An all-no-op batch returns NO_CHANGE; real intermediate structural changes remain recorded even when their net result is zero.

```ts
import { applyClubCommand } from './src/core/world/club';
import type { ClubWorldState } from './src/core/world/club';

function recordSignedWageAndFirstPayment(current: ClubWorldState) {
  return applyClubCommand(current, {
    eventId: 'club-event-101', careerId: current.careerId,
    clubId: current.identity.clubId, expectedRevision: current.revision,
    effectiveDay: current.effectiveDay + 1,
    causeEventIds: ['executed-contract-101', 'bank-payment-101'],
    operations: [
      { kind: 'RECORD_COMMITMENT', commitmentId: 'wage-101',
        contractRef: 'signed-contract-101', category: 'playerWages',
        budgetBucket: 'payroll', amount: 300, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'wage-101',
        receiptId: 'payment-101', amount: 100, currency: 'SIM' },
    ],
  });
}
```

The example uses simulation units, not a real salary. The supplied currency must equal the pinned season currency. See exported `ClubOperation` for all exact required fields; unknown operations and extra fields are rejected.

Institutional operations: RENAME_CLUB, RELOCATE_CLUB, CHANGE_OWNER, REFORM_GOVERNANCE, REPLACE_STADIUM, UPDATE_FACILITIES and UPDATE_STRUCTURAL_CAPITAL. Changes require cause references, but this module does not authenticate the cause or decide investment effects, decay rates, construction completion, owner behavior or financing approval. A reference alone is not proof of economic causality; the host must provide authoritative effects.

UPDATE_REFERENCES replaces reference lists, not player/person/rivalry state. Manager lookup always reads the current MANAGER appointment. Opening manager remains a historical value. A currently known appointment cannot be reassigned to another person/role under the same appointment ID. Previous appointments and source data remain the global Person owner's responsibility.

## Accounting semantics

Money is a nonnegative safe integer in one pinned currency. Exact BigInt accumulation prevents rounding; exposed values remain JSON-compatible numbers. Unrepresentable aggregates return OVERFLOW rather than approximate totals.

- Approved budgets are plans, not cash. RECORD_COMMITMENT records a real, already contracted obligation without moving cash.
- Obligations may exceed approved budgets: the liability is retained and negative authorization headroom is reported. This is NOT permission to sign a contract or register a player.
- SETTLE_COMMITMENT supports partial payment, reduces cash and retains the paid allocation. RELEASE_COMMITMENT cancels only an unpaid portion; it never refunds an earlier payment.
- RECORD_REVENUE increases actual revenue and cash. Owner-backing capacity by itself does not credit cash.
- DRAW_DEBT increases principal and cash, not revenue. REPAY_DEBT reduces principal and cash, not operating cost. Interest/fees belong to explicitly recorded operating obligations.
- Insufficient cash, excessive repayment, over-settlement/release, duplicate current-period receipt IDs, duplicate live commitment IDs and currency mismatch reject the entire batch. There is no implicit borrowing.
- The minimum reserve is exposed as signed cashAfterReserve. Paying an already owed bill may reduce cash below reserve, but never below zero.

`ACCOUNTING_ONLY` summary exposes current balances, received revenue, cash-paid operating costs, outstanding commitments and allocation/headroom per budget bucket. Budget allocation means **obligations authorized in this season, including amounts already paid, minus cancellations**. Old unpaid obligations are exposed separately and are not re-authorized merely by opening another season. Therefore budgetHeadroom is not available cash, a wage-cap calculation, or a legal signing/registration decision. Long-term wages need authoritative installment/schedule records from contract services; this slice does not invent those schedules.

Later headless services bind matchday revenue to official results and observed attendance,
domestic prizes to finalized season outcomes and calibrated awards, and player-wage
payments to signed annual schedules. `applyClubEconomyBatch` applies these sources in
order against one replayed club history. A failure returns no partial result. The host
still authenticates source events and commits the returned club state and all events
atomically; this pure function does not write the database.

A checkpoint is checked against opening balances, category totals and per-obligation current-season payments. Receipts must be chronologically nondecreasing, belong to the current period and stay within representable nonnegative cash/principal at every step, not just at the final total. This catches internal inconsistency; it does not prove that a bank transaction actually happened.

## Season history and continuation

CLOSE_SEASON requires host-provided result/summary references. It emits a historical snapshot containing the current plan, institutional state, complete period accounting, opening/closing managers and appointment-event references. The snapshot is not accepted as runtime state. A closed financial period cannot accept further transactions or another closure.

OPEN_SEASON requires closure first, the next consecutive season and a start no earlier than the current checkpoint and no later than the command day. It preserves current identity, institutions, source pins, current global references, cash/debt and unpaid obligations. Prior payments move to paidBeforeSeason; current receipts/revenue and manager-change references reset. Fully settled obligations remain in archived snapshots rather than accumulating forever in live state. Opening manager is selected anew from the current appointment.

The new season accepts a separately pinned financial profile. An adjacent reuse of the same profileId/version with different rule contents is rejected. Currency changes require a separate explicit migration, not this command. There is no in-season rule-edit operation. A global profile registry must prevent reuse of any historical version with conflicting contents across the entire career; this local comparison is not that registry. Luxury tax, sharing, insolvency, salary caps and registration enforcement remain with their rule owners.

Institutional/person changes can occur during a closed offseason without mutating its already emitted snapshot. There is no annual seed reset, automatic supporter collapse, name-based giant protection or derived-label penalty.

## Event persistence, replay and integration responsibilities

Store the accepted state, complete event (including emitted season history) and the host's deduplication indexes in one transaction using the expected world revision. Cross-club transfers, global Player/Person changes and Club changes must commit together when an operation spans owners. A readonly module cannot enforce database atomicity.

Use checkpoint + subsequent accepted events for replay. The command is re-executed; afterRevision and recomputed historical snapshots must equal the saved event. Reordered, stale or internally inconsistent events fail with no partial replay output. Replay is **consistency checking, not cryptographic authenticity**: a fully rewritten valid command/event requires trusted storage or authenticated logs to detect.

The host must authenticate producers; verify all cause, geometry, contract, registration and result references; ensure global event/receipt/commitment/snapshot ID uniqueness across checkpoints and retired periods; retain immutable historical data; serialize changes against the current world revision; and supply global version/appointment registries. IDs only present in retired snapshots cannot be deduplicated using this bounded live ledger alone.

No UI connection is needed to use these functions. Later services can translate structured rejection codes and returned values into their own presentation. This module does not choose screens, button labels, interactions, sorting rules, visual ranks or a user-facing financial-management workflow.

## Explicitly not completed

Uncovered income/expense source flows, complete contract authorization, regulation enforcement, global persistence/transactions, autonomous structural rise/decline, lineage events, team traits, whole-career competition orchestration, development and manager AI/market remain separate work. The source-backed functions above do not make these systems complete.
