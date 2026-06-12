# ad-auto peak-persist + polish Implementation Plan (TDD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Iron law:** every production line in `src/core.mjs` must follow a failing test you watched fail. Template-only edits do not require Vitest coverage by deliberate design.

**Goal:** Three coordinated changes — `updatePeak` preserves peak across run resets (in-session), the peak row spans the full panel width on a single line, and the crunch amount input becomes `readonly` with `.toExponential(2)` display formatting at every write site.

**Architecture:** Pure logic change in `src/core.mjs` (updatePeak drops its run-reset null-out branch), TDD'd via test rewrites in `tests/core.test.mjs`. Browser-side changes in `ad-auto.template.js` for layout, readonly input, and rounded formatting at the three write sites (ratchet, IPMult-double, peak-row click). `updateIpMult` is **not** modified — formatting stays at the consumption side. Then rebuild `ad-auto.js`.

**Tech Stack:** Vanilla JS (browser IIFE runtime), ESM (Node 18+), Vitest, `localStorage`, break_infinity `Decimal`.

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/src/core.mjs`
- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/tests/core.test.mjs`
- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-12-ad-auto-peak-persist-and-polish-design.md` (read before starting).

**Commits:** Direct to `main` per project convention. Conventional-commit prefixes (`test:`, `feat:`, `refactor:`).

**Manual verification:** see Task 3.

---

## Task 1: TDD — `updatePeak` preserves peak across run resets

**Files:**

- Modify: `src/core.mjs` (drop the `isRunReset` null-out branch in `updatePeak`)
- Modify: `tests/core.test.mjs` (rewrite 2 existing run-reset tests, add 1 new positive test)

**Background:** The pure-logic change is small (delete 4 lines). The test surface is what enforces the new semantics. Tests are rewritten first to lock the new behavior in before touching the implementation.

- [ ] **Step 1 (RED): rewrite the two run-reset tests and add the new positive case**

In `/home/michelek/Documents/github/mitselek/ad-auto/tests/core.test.mjs`, locate the `describe('updatePeak', …)` block. Find the two tests:

```js
test('run reset clears peak then applies the new sample', () => { ... });
test('run reset with tMs<1 clears peak and leaves rate null', () => { ... });
```

Replace those two tests in place with the following three tests (two rewrites + one new):

```js
test('run reset preserves peak; lower-rate new sample does not displace it', () => {
  const next = updatePeak(
    { rate: 60, ip: 60, lastTMs: 9000 },
    { gip: 0.5, tMs: 1000 }
  );
  // new rate = 0.5 / (1000/60000) = 30, which is < 60 → peak survives
  expect(next.rate).toBe(60);
  expect(next.ip).toBe(60);
  expect(next.lastTMs).toBe(1000);
});

test('run reset with tMs<1 preserves peak', () => {
  const next = updatePeak(
    { rate: 60, ip: 60, lastTMs: 9000 },
    { gip: 5, tMs: 0 }
  );
  // computeRate returns null when tMs<1 → peak path skipped, peak unchanged
  expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 0 });
});

test('higher rate after run reset displaces peak', () => {
  const next = updatePeak(
    { rate: 60, ip: 60, lastTMs: 9000 },
    { gip: 5, tMs: 1000 }
  );
  // new rate = 300, which is > 60 → peak updated to new sample
  expect(next).toEqual({ rate: 300, ip: 5, lastTMs: 1000 });
});
```

The other `updatePeak` tests (first valid sample, higher rate replaces, lower rate doesn't, equal rate keeps, null gip, null tMs, tMs<1 without reset) remain unchanged.

- [ ] **Step 2 (RED verify): run tests, confirm failures**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npx vitest run tests/core.test.mjs
```

Expected failures:

- `'run reset preserves peak; lower-rate new sample does not displace it'` — current `updatePeak` nulls peak on isRunReset, so the new (rate=30) sample becomes the new peak. Expected `rate: 60`, got `rate: 30`.
- `'run reset with tMs<1 preserves peak'` — current code nulls peak then computeRate returns null. Expected `{ rate: 60, ip: 60, lastTMs: 0 }`, got `{ rate: null, ip: null, lastTMs: 0 }`.
- `'higher rate after run reset displaces peak'` — current code nulls peak then sets it to new sample. Expected `rate: 300, ip: 5`. Current code happens to produce this too (after null-out, the new sample becomes the first peak). This test may actually PASS against current code; that's acceptable — it serves as a regression guard for the new behavior, ensuring displacement still works after the null-out branch is removed.

If the third test passes against current code, that's fine. The first two failures are the ones that drive the impl change.

- [ ] **Step 3 (GREEN): drop the null-out branch in `updatePeak`**

In `/home/michelek/Documents/github/mitselek/ad-auto/src/core.mjs`, find:

```js
export function updatePeak(prev, sample) {
  let { rate: peakRate, ip: peakIp, lastTMs } = prev;
  const { gip, tMs } = sample;

  if (tMs == null) return prev;

  if (isRunReset(tMs, lastTMs)) {
    peakRate = null;
    peakIp = null;
  }
  lastTMs = tMs;

  if (gip == null) return { rate: peakRate, ip: peakIp, lastTMs };
  ...
```

Delete the `if (isRunReset(tMs, lastTMs)) { ... }` block (four lines). The function becomes:

```js
export function updatePeak(prev, sample) {
  let { rate: peakRate, ip: peakIp, lastTMs } = prev;
  const { gip, tMs } = sample;

  if (tMs == null) return prev;

  lastTMs = tMs;

  if (gip == null) return { rate: peakRate, ip: peakIp, lastTMs };

  const rate = computeRate(gip, tMs);
  if (rate == null) return { rate: peakRate, ip: peakIp, lastTMs };

  if (isHigherRate(rate, peakRate)) {
    return { rate, ip: gip, lastTMs };
  }
  return { rate: peakRate, ip: peakIp, lastTMs };
}
```

`isRunReset` remains exported in `src/core.mjs` (its own tests still pass and exercise it).

- [ ] **Step 4 (GREEN verify): run tests, all pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npx vitest run tests/core.test.mjs
```

Expected: 54 tests pass (53 prior + 1 new positive case; the two rewrites stay at one test each).

- [ ] **Step 5: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add src/core.mjs tests/core.test.mjs
git commit -F /dev/stdin <<'EOF'
feat(core): updatePeak preserves peak across run resets

Drops the isRunReset null-out branch. The new run can only displace
the peak by producing a higher rate, so the auto-crunch threshold
stays anchored at the all-time best rather than re-discovering it
from scratch after every crunch.
EOF
```

---

## Task 2: Template changes (layout, readonly, rounded format) + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

**Background:** Five edits to the template — peak row HTML, peak row CSS, refreshGui IP text, crunch amount readonly + amtAttrs, formatting at three write sites, and removal of the now-dead crunch change-event branch. Then rebuild.

- [ ] **Step 1: Replace the peak row HTML**

In `ad-auto.template.js`, locate the peak-row construction inside the action-row build loop. The current block is:

```js
if (name === 'crunch') {
  const pr = document.createElement('div');
  pr.className = 'row peak-row';
  pr.id = '__auto_peak_row';
  pr.title = 'click to copy IP-at-peak into crunch amount';
  pr.innerHTML = `
    <span></span>
    <span class="name">Peak IP/min</span>
    <span class="peak-rate">—</span>
    <span class="peak-ip">—</span>
    <span></span>
  `;
  paneEls[cfg.tab].appendChild(pr);
}
```

Replace the `pr.innerHTML = ...` block with:

```js
  pr.innerHTML = `
    <span class="name">Peak IP/min</span>
    <span class="peak-value"><span class="peak-rate">—</span> at <span class="peak-ip">—</span></span>
  `;
```

Two cells instead of five: a name label and a value cell with the rate and IP inline separated by literal " at ".

- [ ] **Step 2: Add the flex CSS rule for `.peak-row`**

In the same file, locate the existing CSS block (the long template literal starting with `<style>`). Find the rule:

```
      #${PID} .row.flash{background:rgba(120,200,120,0.22)}
```

Immediately AFTER that line and BEFORE the next rule, add:

```
      #${PID} .row.peak-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0}
```

This overrides the 5-column grid for the peak row only (the more specific selector wins over the base `.row` rule).

- [ ] **Step 3: Update `refreshGui` to write plain IP text**

In `refreshGui`, locate the peak-row update:

```js
peakRow.querySelector('.peak-ip').textContent =
  peak.ip == null ? '—' : '(at ' + fmtExp(peak.ip) + ')';
```

Replace with:

```js
peakRow.querySelector('.peak-ip').textContent = fmtExp(peak.ip);
```

(The literal " at " between rate and ip is now in the HTML, so `refreshGui` no longer assembles the prefix.)

- [ ] **Step 4: Make the crunch amount input `readonly`**

Locate the row-input build (the part that creates the period and amount inputs from a template literal). The existing derivation is:

```js
const amtType = name === 'crunch' ? 'text' : 'number';
const amtAttrs = name === 'crunch' ? '' : 'min="0" step="1"';
```

Change the second line to:

```js
const amtAttrs = name === 'crunch' ? 'readonly' : 'min="0" step="1"';
```

The `amtAttrs` string is already interpolated into the input tag — adding `readonly` makes the crunch amount field non-editable.

- [ ] **Step 5: Format with `.toExponential(2)` at each write site**

**Site A — IPMult-double block inside `peakIntervalId`.** Locate:

```js
if (result.scaled) {
  config.crunch.amount = result.amount;
  const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
  if (input) input.value = result.amount;
  const row = rowEls.crunch;
  if (row) {
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 600);
  }
}
```

Replace with:

```js
if (result.scaled) {
  let formatted = result.amount;
  if (typeof window.Decimal === 'function') {
    try { formatted = new window.Decimal(result.amount).toExponential(2); } catch {}
  }
  config.crunch.amount = formatted;
  const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
  if (input) input.value = formatted;
  const row = rowEls.crunch;
  if (row) {
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 600);
  }
}
```

**Site B — peak-ratchet block (immediately below the IPMult block).** Locate:

```js
if (shouldUpdate) {
  const s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip);
  config.crunch.amount = s;
  const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
  if (input) input.value = s;
  ...
```

Replace the `const s = ...` line with:

```js
  const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
```

(The rest of the `if (shouldUpdate)` block is unchanged.)

**Site C — peak-row click handler.** Locate the click handler block that begins with `if (e.target.closest && e.target.closest('.peak-row'))`. Inside it, find:

```js
const s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip);
input.value = s;
config.crunch.amount = s;
saveSettings();
```

Replace the `const s = ...` line with:

```js
const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
```

- [ ] **Step 6: Remove the dead crunch change-event branch**

Locate the panel-level change-event listener:

```js
panel.addEventListener('change', (e) => {
  const t = e.target;
  const { name, prop } = t.dataset;
  if (!name || !prop) return;
  if (t.type === 'checkbox') {
    config[name][prop] = t.checked;
  } else if (name === 'crunch' && prop === 'amount') {
    config[name][prop] = t.value.trim() === '' ? null : t.value.trim();
  } else if (t.type === 'number') {
    config[name][prop] = t.value === '' ? null : Number(t.value);
  }
  saveSettings();
});
```

Delete the `else if (name === 'crunch' && prop === 'amount') { ... }` branch entirely. The handler becomes:

```js
panel.addEventListener('change', (e) => {
  const t = e.target;
  const { name, prop } = t.dataset;
  if (!name || !prop) return;
  if (t.type === 'checkbox') {
    config[name][prop] = t.checked;
  } else if (t.type === 'number') {
    config[name][prop] = t.value === '' ? null : Number(t.value);
  }
  saveSettings();
});
```

The crunch amount input is now readonly, so the change event cannot fire from user interaction on it; programmatic writes never fire change. The branch was unreachable.

- [ ] **Step 7: Rebuild `ad-auto.js`**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected output: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 8: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 54 tests pass (after Task 1 added one).

- [ ] **Step 9: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'toExponential(2)' ad-auto.js          # expect >= 3 (three write sites in snippet section)
grep -c 'peak-value' ad-auto.js                # expect >= 1
grep -c 'readonly' ad-auto.js                  # expect >= 1
grep -c '\.row\.peak-row{display:flex' ad-auto.js  # expect >= 1
```

Expected: all counts at least 1. (Bookmarklet URL-encoding may obscure dotted forms; snippet-section presence is sufficient.)

- [ ] **Step 10: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: readonly rounded crunch amount + single-line peak row

Crunch amount input becomes readonly so users can't type into it; all
three write sites (ratchet, IPMult double, peak-row click) now format
via .toExponential(2) for a stable #.##e#### display that never visually
truncates. Peak row uses a flex layout spanning the full panel width
with the IP value inline after the rate. The now-unreachable crunch
change-event branch is removed.
EOF
```

---

## Task 3: Manual verification handoff

**Files:** none modified.

**Background:** The pure logic change is covered by Vitest. The template behavior needs eyes-on against a live AD save.

- [ ] **Step 1: Confirm clean working tree**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && git status
```

Expected: clean.

- [ ] **Step 2: Hand off verification script to the user**

> 1. Open Antimatter Dimensions with an in-progress save.
> 2. Open DevTools → Console.
> 3. **Optional but recommended:** clear the prior persisted crunch amount so verification starts fresh:
>
>    ```js
>    localStorage.removeItem('__auto_settings_v1');
>    ```
>
> 4. Paste the SNIPPET section of the freshly built `ad-auto.js`. Confirm panel mounts.
> 5. **Layout:** Peak IP/min row should render as a single horizontal line: `Peak IP/min   <rate> at <ip>`. No wrapping of the IP onto a second line at default panel width. Resize / drag the panel to confirm it still looks right.
> 6. **Readonly:** click into the crunch amount input field and try to type. The input should not accept keystrokes; the field remains whatever the auto-systems set it to.
> 7. **Rounded display:** wait for a peak.ip update (or trigger one via IPMult purchase or peak-row click). The amount field should show a value like `5.11e+43` (3 sig figs, 2 decimal places), never a long-precision string like `5.105076212463067e+43`.
> 8. **Peak persistence:** let the auto-crunch fire (or manually crunch in-game). After the crunch, the Peak IP/min row should **not** reset to `—`. The displayed rate and IP should be the same as just before the crunch.
> 9. As the new run progresses, peak only updates when a new sample exceeds the previous peak rate. The crunch amount stays at the prior all-time best until a new run produces a higher peak.ip.
> 10. **IPMult interaction:** buy an `InfinityUpgrade.ipMult` upgrade. Crunch amount should double (visible as a green flash), still in the rounded format. E.g., `5.11e+43` becomes `1.02e+44`.
> 11. **Peak-row click:** click the Peak IP/min row. The crunch amount should update to current `peak.ip` in rounded format with a flash.
> 12. **Refresh:** reload the page and re-paste the snippet. The crunch amount persists (still in rounded form from whatever the last write was). Peak resets to `—` (per spec — in-session only).

- [ ] **Step 3: Capture deviations**

Symptom → likely cause:

- Crunch amount field shows a long string → one of the three write sites missed the `.toExponential(2)` change.
- User can type into crunch amount field → the `readonly` attribute wasn't applied.
- Peak row wraps → CSS rule for `.row.peak-row` not in effect; check selector specificity and that `display:flex` is the new value.
- Peak resets after crunch → Task 1's impl change to `updatePeak` not applied or reverted.
- Tests failing on rebuild → re-run `npm test` from Task 1 to isolate.

- [ ] **Step 4: Mark feature complete**

Once steps 5-12 pass, the feature is done. No final commit needed — Tasks 1 and 2 already committed.

---

## Self-review notes

- **Spec coverage:** every spec section maps to tasks.
  - Change A (updatePeak preservation) → Task 1.
  - Change B (peak row layout) → Task 2 Steps 1, 2, 3.
  - Change C (readonly + rounded + dead-code cleanup) → Task 2 Steps 4, 5, 6.
  - Build + verify → Task 2 Steps 7-9.
  - Acceptance criteria → Task 3 verification script (steps 5-12 map 1:1 to acceptance bullets).
- **No placeholders.** All step bodies show concrete code or commands.
- **Type consistency:** `result.amount`, `peak.ip`, `config.crunch.amount` are used consistently across sites and tasks. The new `formatted` local variable in IPMult site stays inside the `if (result.scaled)` block — no scope leak.
- **TDD discipline:** Task 1 follows RED → GREEN → COMMIT. Task 2 is template-only (no Vitest by design).
- **Commit hygiene:** conventional-commit prefixes, no `--no-verify`, separate commits per task so reviews can isolate concerns.
