# GitHub Actions Pre-Step Blocker — 2026-09-19

**Status:** EXTERNAL / PRE-STEP BLOCKER.

## Summary

The repository workflow file is valid and contains normal executable steps, but GitHub Actions jobs terminate before the first step starts.

This is not currently treated as a repository-code failure.

## Workflow checked

`.github/workflows/p0-core.yml`

Configured job:

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install
      - run: npm run verify
```

The realism branch is explicitly included in the push trigger.

## Observed evidence

Representative run:

- run: `35368386921`
- job: `105676242863`
- conclusion: failure
- step list: `[]`
- job-log download: `BlobNotFound`

Latest explicit rerun:

- run: `35368503102`
- attempt: `2`
- job: `105676977156`
- conclusion: failure
- step list: `null`

The rerun request itself succeeded, but the new attempt again terminated before any workflow step existed.

The commit combined-status endpoint also returned no ordinary commit statuses for the checked head.

## Interpretation

Current evidence is consistent with failure before runner execution, for example:

- repository / organization Actions policy;
- account or billing restriction;
- GitHub-hosted runner allocation refusal;
- installation / platform-side Actions restriction.

The repository workflow itself should not be rewritten merely to make `steps=[]` disappear.

## Recovery condition

Do not freeze P9 expected fingerprints until all of the following are true:

1. the `verify` job contains real step records;
2. checkout actually starts;
3. `npm install` runs;
4. `npm run verify` runs;
5. TypeScript and Vitest results are visible;
6. the same fixed-seed evidence reproduces across reruns.

## First actions after recovery

1. run full `npm run verify`;
2. fix any real TypeScript/test failures;
3. rerun the P9 fixed-seed corpus;
4. freeze expected fingerprints only after successful repeated runs;
5. record actual batch-performance measurements;
6. begin statistical calibration / Natural renderer work.

## Roadmap relation

P0-P9 source foundations are implemented.

This CI blocker prevents runtime verification and baseline freezing, but does not reopen the architectural phases by itself.
