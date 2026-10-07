# P0 Source Inventory

Updated: 2026-09-17

## Prior engine

Repository: `genkimorimori252525-oss/Kneekura-natural-Baseball`

Architectural references inspected during planning:

- `package.json`: TypeScript + Vitest + Vite/Three renderer stack
- `src/core/rng/DeterministicRng.ts`: deterministic integer RNG design reference
- `src/core/rng/SeedRoot.ts`: match/play/phase seed separation reference
- `src/core/determinism-guard.test.ts`: Core/browser/render boundary guard reference
- `src/core/model/MatchState.ts`: legacy mutable match-state reference
- `src/core/model/events.ts`: legacy event-union reference

No root `LICENSE` or `LICENSE.md` was found during the 2026-09-17 planning pass.
Until reuse terms are explicitly recorded, do not copy implementation source verbatim. Reimplement contracts independently and use the prior engine only as behavioral/architectural evidence.

## P0 reuse decision

- Reuse concepts: yes
- Copy renderer: no
- Copy mutable legacy `MatchState` as the new canonical model: no
- Preserve deterministic phase-stream idea: yes, independently implemented
- Preserve Core-to-render dependency prohibition: yes
