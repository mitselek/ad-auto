# ad-auto: configurable engine FPS + live actual-FPS readout

**Date:** 2026-06-12

## Problem

The main auto-buy loop runs at a hardcoded `TICK_MS = 50` (20 Hz). The finest
granularity any action can achieve is therefore ~50ms, regardless of its
`period` setting — the loop only wakes 20×/sec. There is no way to:

- tune the engine tick rate from the panel, or
- see whether the browser is actually delivering the requested rate (it sags
  when the tab is busy or backgrounded).

## Goal

Expose the engine tick rate as a user-editable **desired FPS**, and show a live
**actual FPS** measured from real tick timing, so the user can pick a rate and
confirm the browser is keeping up.

Non-goals (YAGNI): sparkline/history, per-action FPS, auto-throttling.

## Design

### 1. Expose the hardcoded tick rate

Replace the `TICK_MS = 50` constant with an `engineFps` setting (default `20`,
which equals the current 50ms tick). The main loop becomes recreatable:

- Extract the current `setInterval` body into a named `mainTick()` function.
- Store the timer id in a mutable `mainIntervalId` (currently `const intervalId`).
- Add `startEngine()`: `clearInterval(mainIntervalId)` then
  `mainIntervalId = setInterval(mainTick, Math.round(1000 / engineFps))`.
- `api.stop()` clears `mainIntervalId` (plus the existing peak interval).

### 2. Header chip control

In the title bar, between the "auto" title and the JSON button:

```
auto   [ 20 fps │ 19.8 ]   JSON  –  ×
        ^editable   ^live actual avg
```

- **Left:** a small `type="number"` input bound to desired FPS. On `change`:
  clamp to bounds, set `engineFps`, call `startEngine()` to re-arm the timer,
  then `saveSettings()`.
- **Right:** read-only text showing actual FPS (one decimal).
- **Bounds: 1–100 fps.** 100 fps = 10ms, which is the practical ceiling
  (browsers won't reliably fire `setInterval` faster). Out-of-range input
  clamps into range.
- **Drag-handle interaction:** the header `.head` `mousedown` handler starts a
  panel drag and currently only bails on `BUTTON` targets. It must also bail on
  the FPS input (and its chip container), otherwise clicking into the field
  drags the panel instead of letting you edit. Extend the early-return guard to
  cover `INPUT` (or the chip element).

### 3. Actual-FPS measurement (trailing 1-second count)

Keep an array of recent tick timestamps. Each `mainTick()`:

1. `const t = performance.now();`
2. push `t`,
3. drop leading entries older than `t - 1000`,
4. `actualFps = timestamps.length` — the number of ticks that ran in the
   trailing second.

At the 100 fps cap the buffer holds ≤ ~100 entries, so trimming is cheap. The
value is naturally smooth: it only changes as old ticks age out and new ticks
arrive. This reports what the browser *actually delivered*, which is the point.

### 4. Display cadence

The header readout is refreshed inside the existing `refreshGui()` (already
throttled to 250ms), so the number updates smoothly rather than on every tick.

### 5. Persistence

`engineFps` joins the `__auto_settings_v1` localStorage blob alongside
`lastIpMultCount`. On load, restore it if present and valid (number within
bounds); otherwise fall back to the default `20`.

## Testing

Pure-logic helpers are unit-tested in `tests/core.test.mjs` per the existing
convention. New testable logic:

- **`clampFps(value)`** → clamps to `[1, 100]`, coerces non-numeric/blank to the
  default `20`. Unit-test boundaries (0, 1, 20, 100, 101, NaN, "", null).
- **Trailing-window count** — if extracted into a helper
  (`countInWindow(timestamps, now, windowMs)`), unit-test: empty buffer,
  all-in-window, some-aged-out, exact-boundary entries.

The DOM/interval wiring in the template is verified manually in-browser (no DOM
test harness exists in this repo), consistent with prior features.

## Files touched

- `src/core.mjs` — add `clampFps` (and optionally `countInWindow`).
- `ad-auto.template.js` — engine setting, `mainTick`/`startEngine` refactor,
  header chip markup + handlers, timestamp buffer, persistence.
- `tests/core.test.mjs` — tests for the new pure helpers.
- `npm run build` regenerates `ad-auto.js` (generated artifact).
