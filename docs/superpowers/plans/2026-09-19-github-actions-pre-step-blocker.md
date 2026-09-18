# GitHub Actions Pre-Step Blocker — 2026-09-19

**Status:** CONFIRMED EXTERNAL / PRE-STEP BLOCKER.

## Summary

The repository workflow is valid and contains normal executable steps, but GitHub Actions is refusing to start the job before checkout.

This is now confirmed as an account billing / spending-limit restriction rather than a repository-code failure.

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

The realism branch `jolly/core-realism-2026-09-18` is explicitly included in the push trigger.

## Confirmed GitHub diagnosis

Latest checked run:

- run: `35368689869`
- head: `a375f17c7ed628106e058c75ca084a01f5ae99a4`
- job: `105677225393`
- conclusion: `failure`
- category: `billing_or_budget_restriction`
- source: `check_annotation`

GitHub's annotation says:

> The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings

This means the failure happens before runner execution. Repository checkout, Node setup, dependency installation, TypeScript, Vitest, and `npm run verify` have not executed for this run.

Earlier evidence showing `steps=[]` / `steps=null` is consistent with this diagnosis.

## Secondary local verification path

A Love-Github isolated workspace was also attempted as a temporary way to expose real TypeScript/test failures without treating it as a substitute for CI.

That path is currently unavailable because its synthetic baseline cannot start Docker:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
The system cannot find the file specified.
```

So there are currently two independent execution blockers:

1. GitHub-hosted Actions: billing / spending-limit restriction.
2. Local isolated Love-Github workspace: Docker Desktop Linux engine unavailable.

Neither is evidence of a P9 source failure.

## Recovery condition

Do not freeze P9 expected fingerprints until all of the following are true:

1. the GitHub billing / spending-limit restriction is cleared;
2. the `verify` job contains real step records;
3. checkout actually starts;
4. `npm install` runs;
5. `npm run verify` runs;
6. TypeScript and Vitest results are visible;
7. the same fixed-seed evidence reproduces across repeated successful runs.

The optional isolated workspace can be used for earlier debugging once Docker Desktop is available, but it does not replace the GitHub Actions acceptance gate for fingerprint freezing.

## First actions after recovery

1. rerun `P0 Core` on exact realism head;
2. confirm checkout / setup-node / install / verify all execute;
3. fix only genuine TypeScript/test failures;
4. repeat the full verify on the repaired exact head;
5. run the P9 fixed-seed corpus repeatedly;
6. freeze expected fingerprints only after reproducibility is demonstrated;
7. record actual batch-performance measurements;
8. begin statistical calibration / Natural renderer work.

## Roadmap relation

P0-P9 source foundations remain implemented.

The verified external execution blocker prevents repository-GREEN status and baseline freezing, but does not reopen the architectural phases by itself.