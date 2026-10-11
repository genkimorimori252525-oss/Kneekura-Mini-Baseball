# Original first-base Positive: complete case PASS

The original `ActualFirstBasePlayEndPositive` case passed from its fixed
construction-only `bf8233fa4ce4c7a7a66be62aa757ef93642e9c29` input. No later
pre-end or already-ended database was substituted. The original callback and
all 50 assertion expressions were preserved; only the bounded timeout and
observability wrapper differ from the source entry.

The fixed execution source was local
`527ec838a703d9a121f4b96858db310817edccc0`, public
`c7928d3c5773604c21bd7b3c35eabb210344d26d`, source subtree
`25eda7eba860f766be6c6c3cdd99fa2d57ecc921`. The result is attributed to this
source, not to subsequent integration changes.

The whole original case completed: operative first-base OUT, future reception
and moving actors, the witnessed corrupt-snapshot rollback, genuine physical
end, rejection of new work after closure, closure of all original handles,
reopen/readback, unchanged same-source retry and the reusable ended backup.
The rollback attempt threw the expected corrupt-snapshot error without committing;
the later valid physical
end committed. The reopened retry also returned without changes.

Vitest reports one passed case, zero failed, pending/skipped or todo, in
899.915 seconds. The process completed in 906.119 seconds with exit 0, no
guard, peak RSS 669,416 KiB, all nine pin groups stable, complete process
enumeration and cleanup, and no remaining processes. Before/after pin
snapshots match all 4,519 entries of the released manifest. All 17 returned-owner
checkpoint receipt and compressed-backup hashes match their recorded hashes,
and each source census matches its backup census.

- Terminal SHA-256: `406b5388aeab9aba839f0bc8563619cbe2a8434bd51a289174cdae9d674c38f8`.
- Formal Vitest report SHA-256: `c767191e8a4fee89b9d47acee204a2db27d244647ff2a3f6a38d6b69620c4d39`.
- Final reusable ended database SHA-256: `026799a418a053ca00cec7b05c17dba50e57e094ef3de33b16ac8a1b1168a430`.

Earlier capped whole-case attempts and the separately completed ended-tail
test remain historical evidence with their original outcomes. This run closes
the previously uncompleted original whole Positive case. The separate LAN
continuation, forty-piece archive case and unapproved policy decisions remain
outside this result; it does not establish completion of every non-design area.
