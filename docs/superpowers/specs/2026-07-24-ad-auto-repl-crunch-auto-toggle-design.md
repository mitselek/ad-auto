# Repl Crunch auto-toggle (replace eternity-when-stale) — design

Date: 2026-07-24

## Summary

Give the **Repl Crunch** row on the Infinity tab an opt-in "auto-manage" mode that
enables/disables the row automatically based on progression events:

- **New reality started** (realities count increases) → turn Repl Crunch **on**.
- **Time Study 181 purchased** (its `isBought` flips `false → true`) → turn Repl Crunch **off**.

This reuses the companion-checkbox slot currently occupied by the unused
**eternity-when-stale** behavior, which is removed entirely.

## Motivation

The intended farm loop: right after a Reality you want to crunch-farm replicanti
galaxies; once you commit to Time Study 181 that phase is over and the row should stop.
Doing this by hand every reality is tedious. The existing `eternityWhenStale` companion
is unused, so its slot and code are repurposed rather than adding a second control.

## Scope

### Removed

- `src/core.mjs`: `shouldEternityInstead()` and its test block.
- `ad-auto.template.js`:
  - `eternityWhenStale` field in the `replCrunch` config default.
  - Its persistence load (`saved.eternityWhenStale`) and save serialization.
  - Its inclusion in `copyState`.
  - `warnedNoCanEternityProbe` and the `customDispatchers.replCrunch` stale-eternity
    path. `replCrunch` reverts to the plain `manualBigCrunchResetRequest` dispatch it
    already declares in `handlerPaths`, keeping **only** its existing stability gate
    (`gates.replCrunch`).

### Added

- `src/core.mjs`: a pure reducer `nextReplAutoState(prev, sample)`.
- `ad-auto.template.js`:
  - `autoManage: false` field in the `replCrunch` config default (persisted).
  - Companion checkbox bound to `autoManage` (reuses the `'... in cfg'` render branch
    and the `.companion` purple style), with a descriptive tooltip.
  - Two guarded probes: realities count and TS 181 bought-state.
  - A watcher in the existing 250 ms interval that feeds the reducer and applies toggles.

## Core reducer

```js
// prev:   { realities, ts181 }            last-seen baselines (either may be null)
// sample: { autoManage, realities, ts181, enabled }
// returns { realities, ts181, enabled, changed }
nextReplAutoState(prev, sample)
```

Semantics:

- **`autoManage` off** → return `{ realities: null, ts181: null, enabled: sample.enabled,
  changed: false }`. Baselines reset to null so re-enabling re-baselines cleanly; the row's
  own `enabled` is never touched.
- **`autoManage` on**:
  - Start from `enabled = sample.enabled`, `changed = false`.
  - **Reality increase**: if `prev.realities != null` and `sample.realities != null` and
    `sample.realities > prev.realities` and not already enabled → `enabled = true`,
    `changed = true`.
  - **TS181 purchased**: if `prev.ts181 === false` and `sample.ts181 === true` and
    currently enabled → `enabled = false`, `changed = true`.
  - Always return the sampled `realities` / `ts181` as the new baselines.
- **Missing probes**: a null sample value stores null and produces no toggle that poll;
  detection resumes once the probe reports again. Fail-safe, never throws.
- **Both events in one poll** (pathological): reality enables, then TS181 disables → net
  disabled. Acceptable; realities-up and TS181-bought effectively never co-occur.

## Probes (template)

- Realities: `resolveRaw(['player.realities', 'Currency.realities.value'])`, coerced to
  Number; null if unavailable.
- TS 181 bought: a dedicated guarded helper, because it is a function call the dotted-path
  resolver cannot express:

  ```js
  const probeTs181Bought = () => {
    try { const ts = window.TimeStudy && window.TimeStudy(181); return ts ? !!ts.isBought : null; }
    catch { return null; }
  };
  ```

  Returns `null` (not `false`) when the study object is unavailable, so a missing probe
  never looks like "just purchased".

## Watcher wiring

In the existing 250 ms `peakIntervalId` loop (always running, independent of any row's
enabled state), after the existing peak work:

```js
const res = nextReplAutoState(replAuto, {
  autoManage: config.replCrunch.autoManage,
  realities:  toNumberOrNull(resolveRaw(['player.realities', 'Currency.realities.value'])),
  ts181:      probeTs181Bought(),
  enabled:    config.replCrunch.enabled,
});
replAuto = { realities: res.realities, ts181: res.ts181 };
if (res.changed) {
  config.replCrunch.enabled = res.enabled;
  const cb = rowEls.replCrunch?.querySelector('input[data-prop="enabled"]');
  if (cb) cb.checked = res.enabled;
  delete tabEnabledMemory[config.replCrunch.tab]; // mirror manual-toggle invalidation
  refreshPausedTabs();
  const row = rowEls.replCrunch;
  if (row) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 600); }
  saveSettings();
}
```

`replAuto` is module-scope state initialized to `{ realities: null, ts181: null }`. Baselines
populate on the first poll after `autoManage` is enabled, so no spurious fire on mount.

## Persistence

- Save: serialize `autoManage` alongside `enabled`/`period`/`amount` in `saveSettings`.
- Load: accept `saved.autoManage` (boolean) when `'autoManage' in config[n]`, mirroring how
  `eternityWhenStale` was loaded.
- `copyState`: replace the `eternityWhenStale` conditional with `autoManage`.

## UI

- The companion checkbox renders in the Repl Crunch row's name cell (same slot/style as the
  old one). Tooltip: e.g. *"auto-manage: enable on a new reality, disable when Time Study 181
  is bought"*.
- Programmatic toggles keep the checkbox, paused-tab dimming, tab-toggle memory, and a brief
  row flash in sync with a manual toggle.

## Testing

Pure unit tests (vitest) for `nextReplAutoState`:

- off → no enabled change, baselines nulled.
- on, first poll → baselines captured, no change.
- on, realities increase while disabled → enables.
- on, realities increase while already enabled → no change.
- on, TS181 false→true while enabled → disables.
- on, TS181 already true (true→true) → no change.
- on, TS181 true→false (reset after reality) → no change (only false→true disables).
- null realities / null ts181 → no change, baselines stored as null.
- both events one poll → net disabled.

Remove the `shouldEternityInstead` test block.

Manual verification via `tools/auto-recorder.js` is unnecessary here (no autobuyer-method
ordering involved); a quick in-game check of the reality/TS181 loop is enough.

## Non-goals

- No change to the stability gate (`gates.replCrunch`) or the seconds-to-stable amount input.
- No new tab, no global setting; strictly a per-row opt-in.
- Reality detection is by completion (count increment), not the moment Reality is initiated.
