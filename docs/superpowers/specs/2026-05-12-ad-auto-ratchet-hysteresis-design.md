# ad-auto: hysteresis on the auto-ratchet

Date: 2026-05-12
Scope: `ad-auto.template.js` — one-line change to the auto-ratchet block (`peakIntervalId` callback) plus a named constant at the top of the IIFE.

## Motivation

The auto-ratchet currently fires whenever `peak.ip > config.crunch.amount`. Early in a run the peak rate climbs through many micro-increments, each one slightly higher than the previous peak.ip. The ratchet rewrites `config.crunch.amount`, updates the DOM input, flashes the row, and calls `saveSettings()` on every such tick — a flurry of activity for sub-percent improvements that don't meaningfully change the auto-crunch threshold.

A 1.001× hysteresis (only update when the new peak is at least 0.1% larger than the current amount) collapses that flurry to one ratchet event per ~0.1% growth. Visually quieter, fewer `localStorage` writes, no functional regression — the crunch gate fires within a fraction of a percent of where it would have anyway.

## Behavior

In `ad-auto.template.js`, near the top of the IIFE (alongside the other named constants like `STORAGE_KEY`), define:

```js
const RATCHET_MIN_MULT = 1.001;
```

Inside the auto-ratchet block in the `peakIntervalId` callback, change:

```js
} else if (typeof window.Decimal === 'function') {
  try {
    const prev = new window.Decimal(cur);
    shouldUpdate = peak.ip.gt(prev);
  } catch {
    shouldUpdate = false;
  }
}
```

to:

```js
} else if (typeof window.Decimal === 'function') {
  try {
    const prev = new window.Decimal(cur);
    shouldUpdate = peak.ip.gt(prev.times(RATCHET_MIN_MULT));
  } catch {
    shouldUpdate = false;
  }
}
```

Scope rules:

- The empty-amount adopt path (`cur == null || cur === ''`) is **unchanged**: first observation still populates `crunch.amount` with no hysteresis.
- The IPMult-double block is **unchanged**: a discrete user-purchased event always applies (2× already clears 1.001×, but conceptually it's not a continuous climb).
- The peak-row click handler is **unchanged**: explicit user click always writes the current `peak.ip`.

`RATCHET_MIN_MULT` is a const for tunability without scattering the literal `1.001` across the codebase. No UI to change it at runtime — only an in-code edit.

## Out of scope

- Exposing `RATCHET_MIN_MULT` in the panel UI.
- Applying hysteresis to IPMult or click paths.
- Auto-decaying the threshold when peak.ip stagnates.

## Acceptance

Let `cur = 5.10e+43`. The hysteresis bar is `cur × 1.001 = 5.1051e+43`. Then:

- `peak.ip = 5.10255e+43` (≈0.05% larger than cur, below the bar): ratchet does **not** fire.
- `peak.ip = 5.1051e+43` (exactly at the bar): ratchet does **not** fire — `Decimal.gt` with equality returns `false`.
- `peak.ip = 5.1102e+43` (≈0.2% larger than cur, above the bar): ratchet fires.
- `crunch.amount` empty/null + any non-null `peak.ip`: ratchet fires on the first observation (adopt path bypasses hysteresis).
- IPMult-double and peak-row click continue to write `peak.ip` (or the doubled amount) with no hysteresis check.
- All 54 tests still pass; no new tests added (inline-in-template, consistent with how the rest of the ratchet feature was shipped).
- `npm run build` regenerates `ad-auto.js` cleanly.
