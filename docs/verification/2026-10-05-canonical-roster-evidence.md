# Canonical persisted roster evidence

Native persistence can serialize the same roster event with a different object
key order. The previous catalyst replay comparison used `JSON.stringify` order
and rejected that valid event. The comparison now uses the existing Core
canonical evidence serializer after ordinary JSON normalization. Array order,
null/value semantics and changed or extra event facts remain significant.

The regression was observed failing before the fix: four existing/control cases
passed and the canonical round-trip case failed. The fixed author working tree
passed all five cases; its entire 2,102-file tracked content was then verified
against commit `33b57e941c67c821b050e7f749cc1b066fc8041b`. The original working-tree
receipt retains its earlier HEAD and stage label rather than being relabeled.
Independent source review found no remaining issue.

The isolated integration at `e4b9622507f780a30f0b9f474ed39ebec079d206` then passed:

- generated catalog check
- all 13 tests across roster catalyst, canonical evidence and roster-to-episode
  admission, with zero failures/skips, in 1.454 seconds
- full TypeScript compilation, exit 0, in 27.517 seconds

The 2,112-file source/generated manifest and all control/runtime hashes were
unchanged, every process was reaped, and the guarded run completed normally.
Source manifest SHA-256:
`526539f84c075fc17692f4327b0809ec0f19edf3289b608bde4267c6d131f6b5`.
Raw terminal SHA-256:
`51c7639114953f166f0921319816282ea8e5f16e1fcb42aa7eba1ffc8eecd80f`.
The verified `src` tree is `108e698f27e128deb38af39a90ba5fb221b2b996`.

This is a focused fix to two source files. It does not establish completion of
actual practice, learning adaptation, Career execution or the current cumulative
regression suite. The accompanying publication changes only documentation beyond
the verified source.
