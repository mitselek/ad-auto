# ad-auto: auto-double crunch amount on IPMult purchase

Date: 2026-05-12
Scope: `src/core.mjs`, `ad-auto.template.js`, `tests/core.test.mjs` — when the in-game repeatable Infinity Upgrade "Multiply Infinity Points from all sources by 2" (`InfinityUpgrade.ipMult`) is purchased, scale the user-set auto-crunch threshold by the same factor so it stays proportional to gained IP.

## Goal

The crunch row's `amount` field is a hard threshold on `gainedInfinityPoints`. When the player (or the in-game autobuyer) buys `InfinityUpgrade.ipMult`, gained IP doubles per purchase. The user-set threshold then becomes too low relative to the new gain curve, causing premature crunches. This feature keeps the threshold in lockstep with the upgrade: on each detected purchase, multiply the threshold by 2 per purchase observed.

## Trigger and probe

Single probe path, verified live against a running save:

```
InfinityUpgrade.ipMult.purchaseCount  → integer (e.g. 58)
```

No fallback paths. If the probe resolves to `null`/`undefined` on a given tick, that tick is a no-op; the previous tracked count is preserved.

The same 250 ms interval that drives the Peak IP/min sampler (`peakIntervalId`) reads this value once per tick. No new interval is introduced.

## Behavior

State carried between ticks:

```
lastIpMultCount: number | null
```

Persisted in the `__auto_settings_v1` blob at the top level (alongside `config` and `ui`). Loaded on snippet boot, written via `saveSettings()` whenever it changes.

On each 250 ms tick, after the peak update:

1. Read `current = resolveRaw(['InfinityUpgrade.ipMult.purchaseCount'])`.
2. If `current == null` → no-op.
3. If `lastIpMultCount == null` → record baseline (`lastIpMultCount = current`), save, no scaling. Covers first-ever run and any tick where the probe just became available.
4. If `current <= lastIpMultCount` → just record `current` (handles eternity reset and full page refreshes where the probe returns a lower number than what we last persisted). No scaling.
5. If `current > lastIpMultCount`:
   - `delta = current - lastIpMultCount`
   - If `config.crunch.amount` is non-empty and parseable as `Decimal`:
     - `newAmount = new Decimal(config.crunch.amount).times(new Decimal(2).pow(delta)).toString()`
     - Write `newAmount` to `config.crunch.amount`.
     - Write `newAmount` to the crunch row's `<input>` value.
     - Add `.flash` class to the crunch row for 600 ms (reusing the existing peak-row flash CSS pattern).
   - Update `lastIpMultCount = current`.
   - `saveSettings()`.

Critical: the count is always advanced on observation (even when no scaling happens) so we never re-scale the same delta.

## Pure logic (in `src/core.mjs`)

One new exported function, structured to mirror the existing `updatePeak`:

```js
export function updateIpMult(prev, sample, DecimalCtor) {
  // prev    = { count: number|null, amount: string|null }
  // sample  = { count: number|null, amount: string|null }
  // returns { count, amount, scaled }
}
```

Rules:

| `prev.count` | `sample.count` | Action |
|--------------|----------------|--------|
| any          | `null`         | return prev unchanged, `scaled: false` |
| `null`       | `n`            | adopt baseline, `count: n`, `amount: prev.amount`, `scaled: false` |
| `p`          | `n ≤ p`        | record drop, `count: n`, `amount: prev.amount`, `scaled: false` |
| `p`          | `n > p`        | scale if possible (below) |

Scaling sub-rules when `n > p`, `delta = n - p`:

- If `sample.amount` is `null` or `''` → `scaled: false`, advance count only.
- If `DecimalCtor` is not a function → `scaled: false`, advance count only. (No crash; the snippet shouldn't fail in odd contexts.)
- If `new DecimalCtor(sample.amount)` throws → `scaled: false`, advance count only.
- Otherwise → `factor = new DecimalCtor(2).pow(delta)`, `newAmount = new DecimalCtor(sample.amount).times(factor).toString()`, return `{ count: n, amount: newAmount, scaled: true }`.

The function never reads or writes globals. It does not touch the DOM. It does not persist anything. All side effects (input update, flash, `saveSettings`) live in the template wiring.

## Browser wiring (in `ad-auto.template.js`)

Diff sketch:

1. **Settings load** — after the existing `stored.config` loop, read `stored.lastIpMultCount` (number or null) into a local `let lastIpMultCount`.
2. **`saveSettings()`** — add `lastIpMultCount` to the persisted JSON.
3. **`peakProbes`** — extend the object with `ipMult: ['InfinityUpgrade.ipMult.purchaseCount']`.
4. **`peakIntervalId` callback** — after the existing `peak = updatePeak(...)` line:
   ```js
   const ipMultCount = resolveRaw(peakProbes.ipMult);
   const result = updateIpMult(
     { count: lastIpMultCount, amount: config.crunch.amount },
     { count: ipMultCount, amount: config.crunch.amount },
     window.Decimal,
   );
   if (result.count !== lastIpMultCount || result.scaled) {
     lastIpMultCount = result.count;
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
     saveSettings();
   }
   ```
5. **CSS** — generalize the existing `#${PID} .peak-row.flash` rule to `#${PID} .row.flash` so the same background applies to any row, then add the `flash` class to the crunch row on scaling events. The peak-row click flash continues to work because `.peak-row` is itself a `.row`.

No new globals on `window.__auto`. No new console helpers.

## Tests (in `tests/core.test.mjs`)

Stubs follow the same minimal-class pattern as the existing `FakeDecimal` in `tests/core.test.mjs` (a constructor that records the input string, plus only the methods the unit under test actually calls — here `.times(factor).toString()` and a static `.pow(base, exp)`). The stub does not need to implement real Decimal arithmetic; it records inputs so the test can assert the call shape and produce a stable `toString()` output for comparison.

Cases:

1. `sample.count == null` → returns prev unchanged, not scaled.
2. First observation (`prev.count == null`, sample.count = 5) → `{count:5, amount: prev.amount, scaled:false}`.
3. Unchanged count (5 → 5) → not scaled.
4. Count decrease (5 → 2) → `{count:2, ..., scaled:false}`.
5. `+1` delta, amount `"1e60"` → `count: n+1`, `scaled: true`, and the returned `amount` equals what the stub's `new DecimalCtor("1e60").times(new DecimalCtor(2).pow(1)).toString()` chain produces. The stub records inputs so the assertion can pin down both the chain shape and the final string.
6. `+3` delta, amount `"1e60"` → same as case 5 with `.pow(3)`, verifying delta is passed through (not hard-coded to 1).
7. `+1` delta, amount `null` → advances count, not scaled.
8. `+1` delta, amount `""` → advances count, not scaled.
9. `+1` delta, `DecimalCtor` undefined → advances count, not scaled (no throw).
10. `+1` delta, `DecimalCtor` throws on construction → advances count, not scaled (no throw).

## Build

Standard regeneration after the template + core changes:

```
npm test
npm run build
```

`ad-auto.js` is a generated artifact and is updated as part of the implementation phase.

## Out of scope

- Any UI control or toggle for this behavior (always on, tied to the crunch row, per the user's brainstorming decision).
- Fallback probe paths beyond `InfinityUpgrade.ipMult.purchaseCount`.
- Reacting to any other doubling upgrade (`dim18mult`, `dim27mult`, etc.) — only `ipMult` is in scope.
- Retroactive scaling for purchases that happened while the tool was not running. On first observation after boot, we baseline; we do not try to reconcile against an old persisted count.
- Halving the amount on count decrease. Decreases are treated as a baseline-reset signal only.
- Migration logic for users with existing `__auto_settings_v1` blobs lacking `lastIpMultCount` — `undefined` naturally resolves to "no baseline" and the next tick records one.

## Acceptance

- With `crunch.amount` set to some Decimal-parseable string (e.g., `1e60`) and `InfinityUpgrade.ipMult.purchaseCount` at some baseline, purchasing the upgrade once causes the crunch amount input and stored `config.crunch.amount` to become `2e60` within ~250 ms, with a brief green flash on the crunch row.
- Purchasing the upgrade N times in a single 250 ms window scales the threshold by `2^N` exactly once (no double-counting, no missed scaling).
- Eternity reset (count → 0) does not halve the threshold; only the baseline is reset.
- Refreshing the page does not cause a phantom doubling: the persisted `lastIpMultCount` matches what the probe returns on next boot.
- With `crunch.amount` blank, purchasing the upgrade has no effect on the amount field; only `lastIpMultCount` advances.
- With `window.Decimal` missing, the feature is silently inert and never throws.
- `npm test` passes the new unit cases against `updateIpMult` alongside the existing `updatePeak`/`gateCrunch` suite.
