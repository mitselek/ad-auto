# ad-auto: peak survives crunch + readonly rounded crunch amount + single-row peak layout

Date: 2026-05-12
Scope: `src/core.mjs`, `tests/core.test.mjs`, `ad-auto.template.js` — three coordinated changes that together turn the auto-crunch threshold into a hands-off, always-correct, all-time-best target.

## Motivation

After the peak-ratchet feature shipped, manual verification surfaced three connected problems:

1. **Peak resets on every crunch.** `updatePeak` nulls `peak.rate` and `peak.ip` on run reset. After a crunch the new run has to re-discover the peak from scratch, so the ratchet sits at the prior all-time best (stale persisted value) while peak.ip slowly climbs to catch up. The user never benefits from the all-time history.
2. **The crunch amount input field truncates long Decimals visually.** A stored value like `"1.9418467232420167e+69"` renders as `1.94184` in the 56 px column. Looks like a bug, isn't one — but a console probe was needed to confirm. Painful for the user.
3. **Peak row layout wraps awkwardly.** "Peak IP/min" rate fits in one column, but `(at 5.11e+43)` overflows into a second visual line because the row uses the same 5-column grid as action rows.

These are independent issues with independent fixes, but they ship together because (a) they were discovered in the same verification round, and (b) the readonly + rounded approach in #2 closes the truncation question once for all.

## Change A — `updatePeak` preserves peak across run resets (in-session only)

`src/core.mjs::updatePeak` no longer nulls `peakRate` / `peakIp` on run reset. It still updates `lastTMs`. The new run can displace the peak only by producing a higher rate.

New body:

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

`isRunReset` stays exported (used by its own existing tests; harmless to keep). No call site for it inside `updatePeak` anymore.

### Test changes (TDD)

The two existing run-reset tests in `tests/core.test.mjs` get rewritten to assert preservation, plus one new positive case is added:

- `'run reset clears peak then applies the new sample'` → renamed and rewritten to `'run reset preserves peak; lower-rate new sample does not displace it'`. With `prev = { rate: 60, ip: 60, lastTMs: 9000 }` and `sample = { gip: 5, tMs: 1000 }`, the new rate `5 / (1000/60000) = 300` *is* higher than 60, so this test no longer demonstrates preservation — it needs different numbers. Use `{ gip: 0.5, tMs: 1000 }` so the new rate is `30 < 60`, demonstrating the peak survives.
- `'run reset with tMs<1 clears peak and leaves rate null'` → renamed and rewritten to `'run reset with tMs<1 preserves peak'`. With `prev = { rate: 60, ip: 60, lastTMs: 9000 }` and `sample = { gip: 5, tMs: 0 }`, `computeRate` returns null so the path that updates peak is skipped. Expected: `{ rate: 60, ip: 60, lastTMs: 0 }`.
- New: `'higher rate after run reset displaces peak'`. With `prev = { rate: 60, ip: 60, lastTMs: 9000 }` and `sample = { gip: 5, tMs: 1000 }` (rate = 300), assert next is `{ rate: 300, ip: 5, lastTMs: 1000 }`.

All other `updatePeak` tests (first valid sample, higher rate replaces, lower rate doesn't, equal rate keeps, null gip, null tMs, tMs<1 without reset) continue to pass unchanged — their semantics don't depend on the dropped branch.

## Change B — peak row spans the full panel width

`ad-auto.template.js`:

- CSS: override the grid for `.peak-row` so it lays out as a single flex line:
  ```css
  #${PID} .row.peak-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0}
  ```
  (the existing `.row` rule with `display:grid` remains for all non-peak rows.)
- HTML: simplify the peak row to two children:
  ```js
  pr.innerHTML = `
    <span class="name">Peak IP/min</span>
    <span class="peak-value"><span class="peak-rate">—</span> at <span class="peak-ip">—</span></span>
  `;
  ```
  Visually: `Peak IP/min                2.44e+44 at 5.11e+43` on a single line.
- `refreshGui` continues to populate `.peak-rate` and `.peak-ip` independently; only the wrapper changed. The `(at …)` prefix is no longer needed in the JS — the literal " at " between the spans replaces it. `refreshGui` writes:
  ```js
  peakRow.querySelector('.peak-rate').textContent = fmtExp(peak.rate);
  peakRow.querySelector('.peak-ip').textContent = fmtExp(peak.ip);
  ```
  (Previously the IP text was `'(at ' + fmtExp(peak.ip) + ')'`. With the inline " at " in the HTML structure, the prefix parens become unnecessary noise.)
- The click handler still works because it does `e.target.closest('.peak-row')` to detect the row — independent of internal layout.

## Change C — crunch amount is readonly and displays rounded scientific

`ad-auto.template.js`:

1. **Mark the crunch amount input readonly.** In the input-building loop, the crunch row's amount input gets a `readonly` attribute alongside its existing `type="text"`. Concretely, add `data-name="crunch"`-specific handling in the row template, or simpler: extend the existing `amtAttrs` derivation. The existing code is:
   ```js
   const amtType = name === 'crunch' ? 'text' : 'number';
   const amtAttrs = name === 'crunch' ? '' : 'min="0" step="1"';
   ```
   Change to:
   ```js
   const amtType = name === 'crunch' ? 'text' : 'number';
   const amtAttrs = name === 'crunch' ? 'readonly' : 'min="0" step="1"';
   ```

2. **Format `#.##e####` (i.e. `.toExponential(2)`) at every write site.** Three sites in the template:
   - **Ratchet block:**
     ```js
     const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
     ```
   - **IPMult-double in the interval callback:** wrap `result.amount` before applying:
     ```js
     if (result.scaled) {
       let formatted = result.amount;
       if (typeof window.Decimal === 'function') {
         try { formatted = new window.Decimal(result.amount).toExponential(2); } catch {}
       }
       config.crunch.amount = formatted;
       const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
       if (input) input.value = formatted;
       ...
     }
     ```
   - **Peak-row click handler:** same as the ratchet block:
     ```js
     const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
     input.value = s;
     config.crunch.amount = s;
     ```

   `updateIpMult` in `src/core.mjs` is **not** changed — it keeps returning a full-precision `toString()` string. The formatting happens at the consumption site so the pure function stays decoupled from display concerns.

3. **Remove the now-dead change-event branch for crunch amount.** The existing handler:
   ```js
   } else if (name === 'crunch' && prop === 'amount') {
     config[name][prop] = t.value.trim() === '' ? null : t.value.trim();
   }
   ```
   becomes unreachable when the input is readonly (programmatic `.value` assignment doesn't fire `change`). Delete this branch. The `t.type === 'number'` branch below still handles other rows.

4. **Initial-load behavior:** any pre-existing long-precision value in `localStorage` stays as-is on boot. The first ratchet or IPMult event after boot rewrites it in rounded form. No one-shot migration; over time everything settles into the rounded format.

5. **`gateCrunch` semantics unchanged.** The gate parses `config.crunch.amount` (string) into a Decimal via `parseDecimalLike` and compares against `gainedInfinityPoints`. A rounded string like `"5.11e+43"` parses just as cleanly as the full-precision form. The threshold is fractionally lower than before (5.10507… vs 5.11), which means auto-crunch fires fractionally earlier — negligible at any practical IP scale.

## Out of scope

- Persisting peak across page reloads / `__auto.stop()` (in-session only, per the design discussion).
- Widening the amount column for non-crunch rows (readonly + rounded format makes the width irrelevant for the only row with long values).
- Format toggles (precision other than `.toExponential(2)`, locale-specific formats, etc.).
- Allowing users to type into the crunch amount field. The peak-row click handler is the only remaining manual-override path; that still works because it's programmatic.
- Changing `updateIpMult` to format internally. Format stays at consumption sites.

## Acceptance

- After a crunch, the Peak IP/min display does NOT reset to `—`; it continues to show the pre-crunch peak rate and IP until a new higher rate is observed.
- During the run after a crunch, the auto-ratchet only fires if peak.ip exceeds the existing crunch amount. The threshold no longer drops back to a small first-sample value at the start of every run.
- The Peak IP/min row renders as a single line: `Peak IP/min   <rate> at <ip>`. No wrapping of the IP portion onto a second line at default panel width.
- The crunch amount `<input>` carries the `readonly` attribute. Users cannot type into it. They can still cause it to update by clicking the peak row (which fires a programmatic write of the current `peak.ip.toExponential(2)`).
- After any auto-write event (ratchet, IPMult double, peak-row click), `config.crunch.amount` and the input's visible value are in the form `<digit>.<2 digits>e<+|->{exponent}` — e.g., `"5.11e+43"`. No full-precision strings written by us.
- Pre-existing localStorage values from prior versions remain functional and become rounded on next write event. No crash, no data loss.
- All 53 prior tests still pass after the two `updatePeak` test rewrites + one addition. (Net: 53 → 53 + 1 = 54 tests, assuming both rewrites stay one-test-each.)
- `npm run build` regenerates `ad-auto.js` cleanly.
