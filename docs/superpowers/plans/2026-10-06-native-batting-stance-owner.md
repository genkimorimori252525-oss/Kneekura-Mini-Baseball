# Native batting stance owner implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept the explicit prospective stance from the actual registered actor and qualified exact Native model, retaining original historical evidence.

**Architecture:** Add one original-main SQLite stance archive. Reuse existing model/body/Person and physical-actor readers, open-frame proof and body composition transaction/ownership helpers. New admission requires the actual current pre-pitch actor and applicable model; read/retry reconstructs exact original evidence without selecting today's model or requiring the play to remain unstarted.

**Tech Stack:** TypeScript, Node26.10.0 node:sqlite, Vitest2.1.9.

**Spec:** Unchanged23-case `src/host/world/BattingStanceNative.test.ts` and `NativeBattingModelStanceFixtures.test-support.ts`; approved Native batting model/stance contract.

## Global constraints

- Start from9952dfb with exact qualified model srcb8682677; preserve all67 original cases and four model guard cases.
- Stance initial-World owner only. Explicit body readiness, eye/center, handedness, clock, zone and validity inputs remain exact accepted Source values.
- No new general body/psychology/perception authority, sensing result, prediction, emotion, motor result, pitch producer or swing/physical adoption.
- Original actor and model evidence are read on the same main connection; aliases/mirror corruption reject and write-time dependency mutation rolls back.
- Runtime, locks and publication remain coordinator-owned; no workflow/home CI/design/UI work.

## Review focus

Check actor scope aliases across all mirrors, current write versus original history after legitimate later model or legacy pitch, strict inert geometric/timing inputs, same-connection actor/model dependency replay and atomic rollback. Existing23-case contract protects the stated boundary; any distinct uncovered review counterexample requires a separate focused regression and genuine RED.

## Task 1: Explicit stance ownership

**Files:** Create `src/host/world/BattingStance.ts`, `BattingStanceEvidence.ts`, `SqliteBattingStanceStore.ts`; add only stance exports to `PlayerMaterializationRuntime.ts`. Preserve the qualified model files and all existing tests.

**Interfaces:** `openSqliteBattingStanceStore(path: string, authority?: BattingStanceAuthority): BattingStanceStore`, exact accepted/durable fixture types with `.accept/.read/.close`.

- [x] Verify actual model115/full-compiler GREEN terminal301ee80b on unchanged author source.
- [x] Observe genuine stance RED532d84f8 on9952/srcb868: actual registered body/model acceptance precedes exact missing opener188;1RED/22held, no error/drift/guard/signal/survivor.
- [ ] Implement only stance input/evidence/archive/transaction/facade ownership.
- [ ] Obtain independent source review and address concrete findings with relevant guard evidence.
- [ ] Prepare held full compiler, stance23, model34, preservation14 and related owner regressions with existing finite controls and measured budgets.
- [ ] Qualify only after coordinator runtime release; record exact source/result checkpoint, leaving wholeSuite/Pipeline false.
