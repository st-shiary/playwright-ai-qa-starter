/**
 * AI bug triage for Playwright runs.
 *
 * Reads the Playwright JSON report, collects failed and flaky tests, and writes a
 * plain-English bug report (Markdown) that a developer can act on.
 *
 *  - With ANTHROPIC_API_KEY set: Claude groups failures, guesses the likely cause,
 *    rates severity and suggests a next step.
 *  - Without a key (or if the API call fails): a rule-based summary is written
 *    instead, so the pipeline never breaks because of the AI step.
 *
 * Usage: tsx scripts/ai-triage.ts <results.json> <output.md>
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

// ---- Types: only the parts of Playwright's JSON report we use ---------------
interface PwAttachment { name: string; path?: string }
interface PwResult {
  status: string;
  duration: number;
  error?: { message?: string };
  errors?: { message?: string }[];
  attachments?: PwAttachment[];
}
interface PwTest { status: string; results: PwResult[] }
interface PwSpec { title: string; file: string; line: number; tests: PwTest[] }
interface PwSuite { title: string; specs?: PwSpec[]; suites?: PwSuite[] }
interface PwReport {
  suites: PwSuite[];
  stats?: { expected: number; unexpected: number; flaky: number; skipped: number; duration: number };
}

export interface Finding {
  kind: 'failed' | 'flaky';
  title: string;
  file: string;
  line: number;
  error: string;
  attachments: string[];
  retries: number;
}

// ---- Parsing ----------------------------------------------------------------
const ANSI = /\u001b\[[0-9;]*m/g;

export function cleanError(text: string | undefined, max = 1500): string {
  const clean = (text ?? 'No error message recorded').replace(ANSI, '').trim();
  return clean.length > max ? `${clean.slice(0, max)}\n...[truncated]` : clean;
}

export function collectFindings(report: PwReport): Finding[] {
  const findings: Finding[] = [];

  const walk = (suite: PwSuite, path: string[]) => {
    const here = suite.title ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
        // Use the last attempt for failures; for flaky tests, the first failing attempt
        const failing = test.results.find((r) => r.status !== 'passed') ?? test.results[test.results.length - 1];
        const message = failing?.error?.message ?? failing?.errors?.[0]?.message;
        findings.push({
          kind: test.status === 'flaky' ? 'flaky' : 'failed',
          title: [...here, spec.title].filter(Boolean).join(' > '),
          file: spec.file,
          line: spec.line,
          error: cleanError(message),
          attachments: (failing?.attachments ?? []).map((a) => a.path ?? a.name),
          retries: Math.max(0, test.results.length - 1),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };

  // The top-level suites are files; skip their titles to keep names short
  for (const top of report.suites) walk({ ...top, title: '' }, []);
  return findings;
}

// ---- Rule-based fallback ----------------------------------------------------
function signature(error: string): string {
  const first = error.split('\n').find((l) => l.trim().length > 0) ?? error;
  return first.replace(/\d+/g, 'N').replace(/"[^"]*"/g, '"…"').slice(0, 120);
}

function guessCause(error: string): string {
  if (/Timeout .*exceeded|waiting for/i.test(error)) return 'Timing: an element or page did not appear in time (slow environment, changed locator or a missing step).';
  if (/strict mode violation/i.test(error)) return 'Locator matches more than one element; make the selector more specific.';
  if (/toHaveText|toContainText|toBe\(|toEqual/i.test(error)) return 'Assertion mismatch: the application returned different data or text than the test expects.';
  if (/net::ERR|ECONNREFUSED|ENOTFOUND/i.test(error)) return 'Network: the site or an API was unreachable from the test runner.';
  if (/not found|resolved to 0 elements|to be visible/i.test(error)) return 'Element missing: the UI changed or the page did not reach the expected state.';
  return 'Unknown: review the trace and screenshot attached to the run.';
}

export function ruleBasedReport(findings: Finding[]): string {
  if (findings.length === 0) return 'No failed or flaky tests in this run.\n';
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = signature(f.error);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const lines: string[] = [];
  let n = 1;
  for (const [, group] of groups) {
    const first = group[0];
    const severity = group.some((g) => g.kind === 'failed') ? (group.length > 1 ? 'High' : 'Medium') : 'Low (flaky)';
    lines.push(`### ${n++}. ${group.length === 1 ? first.title : `${group.length} tests with the same symptom`}`);
    lines.push(`- **Severity:** ${severity}`);
    lines.push(`- **Likely cause:** ${guessCause(first.error)}`);
    lines.push(`- **Affected tests:**`);
    for (const g of group) lines.push(`  - \`${g.title}\` (${g.kind}, ${g.file}:${g.line})`);
    lines.push(`- **Error:**`, '', '```', first.error.split('\n').slice(0, 8).join('\n'), '```', '');
  }
  return lines.join('\n');
}

// ---- Claude call ------------------------------------------------------------
const PROMPT = `You are a senior QA engineer writing a bug report for developers from automated test failures.
You are given failed and flaky Playwright tests. Write Markdown with:
1. A two-sentence summary of the run health.
2. Failures grouped by likely shared root cause. For each group: a short title, severity (High/Medium/Low) with one reason,
   the affected test names, the likely cause in plain English, and one concrete next step.
3. A final "Flaky tests" list if any, with the most probable reason each is unstable.
Rules: be specific, do not invent details that are not in the data, say "unclear" when the evidence is not enough,
keep it under 350 words, no preamble.`;

async function claudeReport(findings: Finding[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';

  const payload = findings.map((f) => ({
    kind: f.kind,
    test: f.title,
    location: `${f.file}:${f.line}`,
    retries: f.retries,
    error: f.error,
  }));

  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [{ role: 'user', content: `${PROMPT}\n\nTest results (JSON):\n${JSON.stringify(payload, null, 2)}` }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
  if (!text) throw new Error('Anthropic API returned no text');
  return text;
}

// ---- Main -------------------------------------------------------------------
async function main() {
  const [input = 'test-results/results.json', output = 'bug-report.md'] = process.argv.slice(2);
  const report = JSON.parse(readFileSync(input, 'utf8')) as PwReport;
  const findings = collectFindings(report);
  const stats = report.stats;

  const header = [
    '# Test run bug report',
    '',
    stats
      ? `**Result:** ${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, ${stats.skipped} skipped`
      : `**Findings:** ${findings.length}`,
    '',
    '',
  ].join('\n');

  let body: string;
  let source: string;
  if (findings.length === 0) {
    body = 'All tests passed. Nothing to triage.\n';
    source = 'no findings';
  } else {
    try {
      body = await claudeReport(findings);
      source = `AI-written by ${process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5'}; review before filing`;
    } catch (err) {
      body = ruleBasedReport(findings);
      source = `rule-based fallback (${err instanceof Error ? err.message : 'AI step failed'})`;
    }
  }

  const markdown = `${header}${body}\n\n---\n_Report source: ${source}_\n`;
  writeFileSync(output, markdown);
  console.log(`Wrote ${output} (${findings.length} finding(s); ${source})`);
  // Show in the GitHub Actions run summary when available
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

// Only run when executed directly, so the helpers can be imported by tests
if (process.argv[1] && /ai-triage\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    // Triage must never fail the pipeline
    console.error('Triage skipped:', err instanceof Error ? err.message : err);
    process.exit(0);
  });
}
