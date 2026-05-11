# ad-auto: snippet/bookmarklet unification + Peak IP/min tracker

Date: 2026-05-11
Scope: `/home/michelek/Documents/github/ad-auto.js` — refactor the SNIPPET (lines 30-299) so it becomes the canonical source, with the BOOKMARKLET (line 305) regenerated as a URL-encoded copy of the snippet body. Then add the Peak IP/min tracker + crunch gate to the unified codebase.

## Goal

Two outcomes from one edit pass:

1. **Single source of truth.** The SNIPPET section holds the full, human-readable implementation. The BOOKMARKLET section becomes a one-line `javascript:` URL containing the URL-encoded snippet body. Editing the snippet and re-encoding is the only path to changes — no more parallel implementations to keep in sync.
2. **Peak IP/min feature.** Add a panel-side tracker that mirrors Antimatter Dimensions' built-in "peak IP/min since last crunch" stat, and let the user click the displayed value to copy the IP-at-peak into the crunch row's `amount` input so auto-crunch fires at the optimal moment.

## Phase 1 — Snippet absorbs the bookmarklet

The current bookmarklet is the richer of the two. Decode it and make it the snippet body, with the following adopted from the bookmarklet verbatim:

- Action set (with per-row `{ tab, label, enabled, period, amount }`):
  - AD tab: `maxAll`, `dimBoost`, `galaxy`, `sacrifice`, `crunch`
  - Infinity tab: `buyMaxID`, `buyMaxRep`, `eternity`
  - Eternity tab: `buyMaxTD`
  - Dilation tab: `dilatedEternity`
- Handler resolution via `handlerPaths` with multi-candidate fallback (`resolveFn`).
- Tab strip in the panel, with active-tab state persisted.
- `STATE_PROBES` map and `probeState()` helper.
- JSON-copy header button (`copy` action → writes state+stats JSON to clipboard with textarea fallback).
- Drag from anywhere on the header to any corner (uses `left`/`top` rather than the snippet's bottom-anchored drag).
- Collapse / stop / drag persistence in localStorage UI block.
- `api.status()` / `api.resetSettings()` console helpers, exposed as `window.__auto`.

Differences to resolve during the absorb:

- **Storage key.** Adopt the bookmarklet's `__auto_settings_v1` as the unified key. The old snippet key (`__auto_state_v1`) is dropped; users will see panel defaults on first load and re-toggle anything they had customized. No migration code.
- **Sacrifice gate.** Bookmarklet uses `cfg.amount` for the sacrifice minRatio; snippet uses a separate `cfg.minRatio`. Unify on `cfg.amount` (drop the `minRatio` field). The sacrifice row's amount input remains numeric.
- **Defaults.** Use the bookmarklet's defaults exactly (Infinity/Eternity/Dilation tabs default disabled; AD tab actions default enabled with their current periods).

After Phase 1 the snippet is functionally identical to the bookmarklet but lives as readable code.

## Phase 2 — Peak IP/min tracker

### Metric

Sampled every 250 ms from a dedicated `setInterval` (separate from the 50 ms action tick):

```
gip   = window.gainedInfinityPoints()         // Decimal: IP that would be gained on crunch now
tMs   = player.records.thisInfinity.time      // number:  ms elapsed in current infinity run
rate  = gip / (tMs / 60000)                   // IP per minute
```

Tracked state:

```
peak = { rate: Decimal|null, ip: Decimal|null }
```

`peak.ip` is the value of `gip` at the moment `rate` peaked. Update peak whenever `rate.gt(peak.rate)` (Decimal comparison) or when `peak.rate == null`.

Reuse `STATE_PROBES` for resolution. Add entries if missing:

- `gainedInfinityPoints`: `['gainedInfinityPoints']` (already present, callable)
- `thisInfinityTimeMs`: `['player.records.thisInfinity.time']` (rename existing `thisInfTimeS` if it was being interpreted as seconds — verify against game source during implementation)

The sampling helpers stay separate from `probeState()` because they need the raw Decimal/number values, not formatted strings. Add a small `resolveRaw(paths)` helper alongside `resolveFn`.

### Run-reset detection

`player.records.thisInfinity.time` is monotonic within a run and resets to ~0 on crunch. Detect by comparing to the previous sample: if `tMs < lastTMs - 50` (small slop to avoid jitter), clear `peak` and reset `lastTMs`. No explicit hook into game crunch events needed.

If `tMs` is unavailable (game state not yet loaded, retired probe path), the sampler skips that tick silently and leaves `peak` untouched.

### UI: peak row

A new non-action row inserted into the **AD pane**, immediately above the `crunch` row.

Visual layout (single row in the panel grid):

```
[                    Peak IP/min   1.23e50  (at 4.56e60)              ]
```

- Label `Peak IP/min` on the left (same visual weight as other row names).
- Rate value in normal text color.
- `(at <ip>)` in the dim secondary color used for stats counters.
- Whole row is clickable (`cursor: pointer`, hover background tint). Title tooltip: `click to copy IP-at-peak into crunch amount`.
- Before any peak is observed in the current run, row shows `—` and click is a no-op.

The row is rendered in the AD pane regardless of which tab is active, but only visible when the AD tab is selected (same as other AD rows). It does **not** appear in other tabs.

Formatting:

- Use the Decimal's `.toExponential(2)` if available, else `Number(x).toExponential(2)`. Keeps output to ~7 chars regardless of magnitude.

Click behavior:

1. Write `peak.ip.toString()` into the crunch row's amount `<input>` value.
2. Update `config.crunch.amount` directly with the string (parsed lazily at gate time).
3. Call `saveSettings()`.
4. Brief 600 ms background flash on the peak row for feedback.

No manual peak-reset button. Reset happens implicitly on crunch detection.

### Crunch gate

Currently `gates.crunch` doesn't exist. Add:

```js
gates.crunch = (cfg) => {
  if (cfg.amount == null || cfg.amount === '') return true;
  const gip = resolveRaw(STATE_PROBES.gainedInfinityPoints);
  if (gip == null) return true;
  const threshold = parseDecimalLike(cfg.amount);
  return typeof gip.gte === 'function' ? gip.gte(threshold) : Number(gip) >= Number(threshold);
};
```

`parseDecimalLike` accepts the string from the input and returns a `Decimal` if `window.Decimal` exists, else a `Number`. Invalid strings → gate disabled (treat as if `null`).

The gate compares **gainedInfinityPoints** (would-gain-on-crunch) to the threshold, not the player's current IP total. This is what makes the click-to-copy semantically meaningful: at peak, `gip == peak.ip`; one tick later, `gip > peak.ip` and crunch fires.

### Amount input type — text for crunch only

IP values routinely exceed `Number.MAX_VALUE` (1.7e308). Change just the crunch row's amount input from `type="number"` to `type="text"`. Other rows keep `type="number"` (their thresholds are small integers like sacrifice multipliers or buy counts).

- Stored value in `config.crunch.amount` is the raw string. `''` / missing → gate off.
- The existing `panel.addEventListener('change', …)` handler must learn that a text input on the crunch row stores the string directly (no `Number(t.value)` coercion). Easiest: branch on `t.dataset.name === 'crunch' && t.dataset.prop === 'amount'`.
- `localStorage` persistence already JSON-serializes strings fine.

## Phase 3 — Regenerate the bookmarklet

After the snippet is finalized:

1. Take the IIFE body that lives in the snippet section.
2. URL-encode it with `encodeURIComponent` (preserve as a single line).
3. Prepend `javascript:` and append `void(0);`.
4. Replace the `START:` line content in the BOOKMARKLET section.

Encoding helper: a small node one-liner documented in a comment near the bookmarklet section, e.g.:

```
// Re-encode after editing the snippet:
//   node -e 'console.log("javascript:"+encodeURIComponent(require("fs").readFileSync("snippet-body.js","utf8"))+"void(0);")'
```

(Implementation phase decides exactly how to script this. The spec mandates the encoded bookmarklet stays byte-derivable from the snippet body — no manual divergence.)

## Out of scope

- Manual peak reset button.
- Peak history across runs.
- Visualization of rate over time.
- Smoothed/windowed rate (the AD-style cumulative average is what we mirror).
- Migration of existing localStorage saves under the old `__auto_state_v1` key.
- A real build script. The re-encode step can stay manual / one-liner-documented for now.

## Acceptance

- The SNIPPET section is readable JS containing the full feature set (formerly only in the bookmarklet) plus the peak-IP feature.
- The BOOKMARKLET section's `START:` line is the URL-encoded snippet body, and re-encoding the snippet reproduces it byte-for-byte.
- Pasting the snippet into the AD console mounts a panel with tabs (AD / Infinity / Eternity / Dilation), all action rows present.
- The AD pane shows a "Peak IP/min" row above crunch.
- During an infinity run, that row updates roughly every 250 ms with the current peak rate and IP-at-peak.
- On crunch, the peak row resets to `—`.
- Clicking the peak row when a peak exists pastes the IP-at-peak value into the crunch amount input, persists it, and the auto-crunch gate immediately starts using that threshold.
- With `crunch.amount` set, auto-crunch fires only when `gainedInfinityPoints >= amount`.
- With `crunch.amount` blank, auto-crunch behaves as it does pre-change (always-fire when enabled and period elapsed).
