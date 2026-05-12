# ad-auto: post-threshold crunch delay

Date: 2026-05-12
Scope: `src/core.mjs`, `tests/core.test.mjs`, `ad-auto.template.js` — for the crunch action only, repurpose the TIME field as a post-threshold delay when a meaningful amount threshold is set. Other actions and crunch-without-threshold keep today's period-as-interval semantics.

## Motivation

The auto-crunch threshold (`config.crunch.amount`) is now tracked at the all-time peak.ip via the ratchet. But `gainedInfinityPoints` keeps growing past the peak rate's IP for a while before the rate falls off. Crunching exactly at the threshold sells short — there's value in waiting a fixed time after the threshold is reached to capture some of the post-peak overshoot.

This change lets the user encode that wait as a number in the existing TIME field. `TIME = 5000` means: once gainedIP first reaches the threshold, wait 5 seconds before firing the crunch.

## Behavior

### Per-action timing model (only the crunch row changes)

For every action other than crunch: unchanged. `TIME` is the minimum ms between fire attempts; the main 50 ms tick checks `now - lastRun[name] >= cfg.period` then evaluates the gate.

For the crunch action, the model splits on whether the amount is a meaningful (non-zero) threshold:

- **No threshold** (`amount` is `null`, empty string, or parses to a Decimal ≤ 0) → use today's model. TIME is period-as-interval. The gate (which returns `true` for empty amount via `gateCrunch`) effectively allows free firing.
- **Threshold set** (`amount` parses to a Decimal > 0) → use the new post-threshold-delay model:
  1. State: a single `crunchReadyAt` timestamp (closure-local in the IIFE, initialized to `null`).
  2. If `crunchReadyAt` is already set, just wait for it. When `now >= crunchReadyAt`, fire crunch and clear the timer.
  3. If `crunchReadyAt` is null, evaluate the gate (`gateCrunch`). If it passes, set `crunchReadyAt = now + cfg.period`. Do not fire on the same tick — even with `period = 0` the wait is one tick (50 ms).
  4. **Lock the timer.** Do not re-evaluate the gate while waiting. If the threshold (`amount`) changes mid-wait or `gainedIP` drops mid-wait, the timer still fires at expiry. The user explicitly chose this semantic — keep it simple and predictable.

After firing, `crunchReadyAt` is cleared. The new run's gainedIP starts near zero; the gate fails; the timer stays cleared until the next time the gate passes.

### Edge cases

- **Action disabled mid-wait.** If the user toggles `crunch.enabled` off while a timer is running, the `if (!cfg.enabled) continue` guard at the top of the loop skips the crunch branch entirely. `crunchReadyAt` is preserved. Re-enabling resumes the timer; if it has already expired, the next tick fires.
- **Manual in-game crunch mid-wait.** The next tick observes the new run's small gainedIP; but the timer is locked, so we attempt to fire the crunch handler anyway. The in-game `manualBigCrunchResetRequest` either no-ops or throws on the new run — caught by the existing `try { dispatch(...) } catch` block. No harm.
- **Amount cleared mid-wait** (e.g., user resets settings). The crunch row's amount is readonly, so users can't type it down. Programmatic writes (ratchet/IPMult/click) only ever raise the amount. The "amount cleared" scenario is not reachable through the panel UI; only by `localStorage.removeItem(...)` plus snippet restart, which also re-initializes `crunchReadyAt` to null. No special handling needed.
- **`localStorage` persistence.** `crunchReadyAt` is transient session state. It is **not** persisted. On snippet boot it starts null; if a threshold is already met (existing run, paused-then-resumed snippet), the next tick starts a fresh timer.

### `TIME = 0` semantics

Setting TIME to 0 means: fire on the next tick after the threshold is met. The crunchReadyAt path always sets a future timestamp (`now + 0 = now`), and the dispatch only happens when `now >= crunchReadyAt` — i.e., on the *next* tick when `now` has advanced. This is one-tick (≈50 ms) latency, matching the user's explicit choice. To replicate today's same-tick fire, the user clears the threshold instead (amount empty or 0).

## Pure logic addition

`src/core.mjs` gains one new export, TDD'd like every other pure helper:

```js
export function isThresholdSet(amount, DecimalCtor) {
  // amount: string | null | undefined
  // DecimalCtor: function | undefined
  // returns true iff amount parses to a positive Decimal value
}
```

Rules:

- `amount == null` → `false`.
- After trimming, empty string → `false`.
- After trimming, the literal `"0"` → `false` (shortcut).
- If `typeof DecimalCtor !== 'function'` → use `Number(amount) > 0`. Returns `false` for `NaN`.
- If `new DecimalCtor(amount)` throws → `false`.
- Otherwise → `parsed.gt(0)` if `.gt` is a function; else `Number(parsed) > 0`.

The function never throws on any input.

### Test cases

In `tests/core.test.mjs`, new `describe('isThresholdSet', ...)` block. Cases:

1. `null` → `false`.
2. `undefined` → `false`.
3. `""` → `false`.
4. `"   "` (whitespace) → `false`.
5. `"0"` → `false`.
6. `"1e60"` with `FakeDecimal` stub (positive) → `true`.
7. `"-1e60"` with `FakeDecimal` stub returning `gt(0) === false` → `false`.
8. `"abc"` with `FakeDecimal` that throws on construction → `false`.
9. `"5"` without `DecimalCtor` → `true` (Number(5) > 0).
10. `"0"` without `DecimalCtor` → `false`.
11. `"abc"` without `DecimalCtor` → `false` (Number = NaN).

The stub reuses the same `FakeDecimal` pattern already established in the `updateIpMult` tests. It needs a `.gt(other)` method that compares its chain string interpreted as numeric, OR a simpler dedicated stub for these tests. Implementation phase decides.

## Browser wiring

In `ad-auto.template.js`:

1. **Declare a closure-local `crunchReadyAt`** initialized to `null`, placed alongside the existing `let lastIpMultCount` declaration.

2. **Restructure the crunch branch of the main 50 ms `intervalId` callback.** Currently the loop body is uniform:
   ```js
   for (const [name, cfg] of Object.entries(config)) {
     if (!cfg.enabled) continue;
     if (now - lastRun[name] < cfg.period) continue;
     if (gates[name] && !gates[name](cfg)) continue;
     try { dispatch(name); stats[name].fires++; lastRun[name] = now; }
     catch (e) { stats[name].errs++; if (stats[name].errs <= 2) console.warn(name, 'threw', e); }
   }
   ```
   Insert a special branch for `name === 'crunch'` that runs *after* the `cfg.enabled` check but *before* the default period-as-interval / gate / dispatch path:
   ```js
   if (name === 'crunch' && isThresholdSet(cfg.amount, window.Decimal)) {
     if (crunchReadyAt != null) {
       if (now < crunchReadyAt) continue;
       try { dispatch('crunch'); stats.crunch.fires++; lastRun.crunch = now; }
       catch (e) { stats.crunch.errs++; if (stats.crunch.errs <= 2) console.warn('crunch', 'threw', e); }
       crunchReadyAt = null;
       continue;
     }
     if (!gates.crunch(cfg)) continue;
     crunchReadyAt = now + cfg.period;
     continue;
   }
   ```
   When the threshold is unset, the existing loop body handles crunch with today's period-as-interval semantics.

3. **No CSS or HTML changes.** TIME column already supports the new meaning by interpretation. The label "TIME" continues to be accurate in both modes. (A future change could relabel it contextually; out of scope here.)

4. **No persistence change.** `crunchReadyAt` is not part of `saveSettings()`. The `__auto_settings_v1` blob is unchanged.

## Out of scope

- Showing the wait countdown in the panel.
- Re-checking the gate after the timer is set (locked-timer choice).
- Persisting `crunchReadyAt` across page reloads.
- Changing other actions' timing models.
- Renaming the TIME column header to reflect dual semantics.
- Auto-tuning the delay based on rate decay (future heuristic, not a fix).

## Acceptance

- With `crunch.amount = ""` (empty), TIME continues to be the interval between fire attempts. No behavior change for users who haven't set a threshold.
- With `crunch.amount = "0"` (explicit zero), TIME continues to be interval. No behavior change.
- With `crunch.amount = "1e60"` and `crunch.period = 5000`:
  - Once `gainedInfinityPoints >= 1e60`, the auto-crunch fires approximately 5000 ms later (within ±50 ms of one main tick).
  - During the wait, the panel displays normally; no fire happens.
  - After firing, the timer resets. Next run reaches the threshold → starts a new 5000 ms wait.
- With `crunch.amount = "1e60"` and `crunch.period = 0`:
  - Once threshold is met, the auto-crunch fires on the next 50 ms tick.
- Manually toggling crunch off during the wait pauses the timer. Toggling back on resumes it; expired timers fire immediately.
- `updatePeak`, `updateIpMult`, the ratchet block, and the peak-row click handler are untouched. Their behavior is unaffected.
- `isThresholdSet` returns `true` only when the amount is a positive Decimal-parseable value.
- `npm test` passes the new `isThresholdSet` cases alongside the existing 54 tests. Net: 65 tests (54 + 11).
- `npm run build` regenerates `ad-auto.js` cleanly.
