# playwright-ai-qa-starter

A production-style **Playwright + TypeScript** test suite with **GitHub Actions CI** and an **AI step that turns failed runs into a plain-English bug report**.

> Demo project built on the public practice shop [saucedemo.com](https://www.saucedemo.com). It is not client work; all numbers below come from my own runs.

## The problem this solves

Release days feel risky when nothing automatically checks login, cart and checkout. When tests do exist, they go flaky, nobody trusts them, and a red build becomes a wall of stack traces. This repo shows the setup I use to fix both:

1. **Critical-path tests** that are independent, fast and stable.
2. **CI on every push and pull request**, with the HTML report and traces saved.
3. **An AI triage step** that groups failures by likely cause and writes a bug report developers can act on.

## What is inside

| Area | Tests | What is covered |
| --- | --- | --- |
| Login | 5 | valid login, locked-out user, wrong password, empty username, empty password |
| Product list | 3 | six products shown, price sort order, product detail page and back |
| Cart | 3 | badge count, cart contents, removing an item |
| Checkout | 4 | full purchase, required first name, required postal code, total = items + tax |

**15 tests.** Page objects live in `pages/`, shared setup in `fixtures/`, the triage script in `scripts/`.

## Quick start

```bash
git clone <this-repo-url>
cd playwright-ai-qa-starter
npm ci
npx playwright install chromium
npm test
npm run report        # open the HTML report
```

Requires Node 18 or newer.

## How the AI bug report works

`npm test` writes a machine-readable report to `test-results/results.json`. `scripts/ai-triage.ts` reads it, keeps the failed and flaky tests, and asks Claude to:

- group failures that share a root cause,
- rate severity with a reason,
- name the likely cause in plain English and one concrete next step.

```bash
export ANTHROPIC_API_KEY=your-key     # optional
npm run triage                        # writes bug-report.md
npm run triage:sample                 # try it on a sample report, no failures needed
```

Without an API key, or if the API call fails, it writes a rule-based summary instead, so the pipeline never breaks because of the AI step. In CI the report is added to the run summary and uploaded as an artifact. A human reviews it before anything is filed.

## CI

`.github/workflows/playwright.yml` runs on push, pull request and manual dispatch: install, type-check, run the tests, triage, upload reports. To enable the AI summary, add a repository secret named `ANTHROPIC_API_KEY`.

## Design decisions (why it stays stable)

- **Independent tests.** Every test logs in on its own, so order never matters and tests can run in parallel.
- **No fixed sleeps.** Waiting uses Playwright's auto-waiting and `expect.poll`.
- **Retries only in CI**, and a test that passes on retry is reported as *flaky*, not hidden.
- **Traces, screenshots and video** are kept on failure so a failure can be diagnosed without re-running.
- **Money maths in cents**, to avoid floating-point false failures.
- **Stable locators** (`data-test` attributes), configured once through `testIdAttribute`.

## Adapting this to your product

Swap the base URL and the page objects, keep the structure. A typical first delivery is 10–15 tests for your most important flows, running in your CI within a week.

## Results

<!-- TODO(owner): after your first run, paste a screenshot of the green HTML report and the green GitHub Actions run here, plus the real test count and duration. -->

## Contact

[Your name] · Senior QA Engineer · [LinkedIn URL] · [email]
