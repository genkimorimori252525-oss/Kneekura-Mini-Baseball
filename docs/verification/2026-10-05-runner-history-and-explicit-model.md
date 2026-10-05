# Owned runner observation history and explicit decision/motion model

The owned additional runner now has an immutable sensory observation history and an explicitly accepted decision/motion model. Each history receipt reconstructs the original physical prefix, pre-pitch runner identity, observation model and predecessor. Acceptance preserves original participant ownership, writer-local rollback, historical retry and full disk reopen. The model reuses the original Player/Person intake reader, including its roster existence, revision, day and membership checks. Empty model reads do not eagerly require an unrelated intake schema.

This is input and retained-knowledge ownership. It does not generate a policy, choose a runner action, issue a motor command, or prove a general eleven-player PlayEnd. Those remain the next connections in the existing plan.

## Source-qualified evidence

The original history/model capability contracts observed 101 intended focused failures and two intended Native failures before implementation. Source review then added eight original-intake support regressions and one empty-read regression, each observed before its narrow repair.

- Source `3738ac3ad2960059c00ec755895881281486d885`: 110 focused and 112 compatibility cases passed. Receipts `0fb2c9d1c4a448c6ee1d4500d57bf760cdfbce86af35b3e899ee5d71f17161b8` and `c16a4e9c5f15cbdcbbb83141c9acbd504ddf4c5596594ec2b463119f4c24cf00`
- The same source's two-case Native attempt was preserved as **one pass and one failure**. Its final synthetic PlayEnd row had an invalid empty snapshot, so the original physical reader rejected corruption before the expected seal-specific error. Failed receipt `e97a28f7eef2b3d96b88ba62bbdfee23ea600e0be4708b53fe363d276253af54`
- Fixture-only correction `41499c42005f3845e985b9dcd27ca435de97ff1d` passed both Native cases and compiler. Receipts `bd57264cd53e489fab0b400a9aa977999274562d71b22ff89f3a41e055fe401c` and `be283168b515bf9e8017acd8646d6623ce7e800338ec6fe78bd93de0d872126f`. Production and all 110/112 contract files are byte-identical to the earlier passing source

The corrected final Native check uses the real four-column live-play fence schema as an explicitly synthetic admission claim. It separately reauthenticates the genuine physical prefix and saved observations under that schema, rejects fresh admission, and preserves exact archive/head rows and retries. It does not manufacture a completed eleven-player closure. The genuine history fixture still proves an actual INSERT/AFTER INSERT mutation witness, rollback, and callback-free full-file reopen.

The combined four-slice cut `c68a3dc47196b1aae2cd678470ebaad207992d1a`, source tree `183e367eda89426b32707bb1d5d5e108ddc59455`, reran these 110 + 112 + 2 cases within its 409-case integration and passed catalog plus full/next-input compilation. Terminal SHA-256 `d4c26f7bbc65d663e712900b7caf098f6358480974f9800b9cec82789379af53`; source, dependencies and controls remained unchanged, with no skipped/todo/unhandled cases or owned process left. This is focused integration, not a cumulative whole-project or forty-piece archive pass.
