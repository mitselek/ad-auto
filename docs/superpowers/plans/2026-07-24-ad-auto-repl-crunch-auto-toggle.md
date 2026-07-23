# Repl Crunch auto-toggle — implementation plan

Date: 2026-07-24
Spec: `docs/superpowers/specs/2026-07-24-ad-auto-repl-crunch-auto-toggle-design.md`

Edit `src/core.mjs` and `ad-auto.template.js`, then regenerate `ad-auto.js` via
`npm run build`. TDD: write/adjust tests before implementation. `npm test` and the build
must pass.

## Step 1 — core: remove `shouldEternityInstead`, add `nextReplAutoState` (TDD)

1. `tests/core.test.mjs`:
   - Remove the `shouldEternityInstead` `describe` block and drop it from the import list.
   - Add a `nextReplAutoState` `describe` block covering the cases in the spec's Testing
     section. Import `nextReplAutoState`.
2. `src/core.mjs`:
   - Delete `shouldEternityInstead`.
   - Add `nextReplAutoState(prev, sample)` per the spec's Core reducer section, with a short
     doc comment.
3. `npm test` — new tests pass, no reference to the removed export remains.

## Step 2 — template: strip eternity-when-stale

In `ad-auto.template.js`:

1. `config.replCrunch`: drop `eternityWhenStale: false`.
2. Persistence load block: remove the `saved.eternityWhenStale` branch.
3. `saveSettings`: remove `eternityWhenStale` from the serialized shape.
4. Remove `warnedNoCanEternityProbe` declaration.
5. Delete `customDispatchers.replCrunch` entirely (row falls back to the default dispatch
   using `handlerPaths.replCrunch = ['manualBigCrunchResetRequest']`, keeping
   `gates.replCrunch`). Confirm `stats.eternity` is still only incremented by the eternity
   row itself.
6. `copyState`: remove the `eternityWhenStale` conditional.

## Step 3 — template: add `autoManage` control + watcher

1. `config.replCrunch`: add `autoManage: false`.
2. Persistence: load `saved.autoManage` (boolean) when `'autoManage' in config[n]`; add
   `autoManage` to the saved shape; add it to `copyState`.
3. Companion checkbox: repoint the render branch from `'eternityWhenStale' in cfg` to
   `'autoManage' in cfg`, binding `data-prop="autoManage"` with the spec's tooltip. Keep the
   `.companion` class/style.
4. Probes: add `probeTs181Bought()` helper and a `toNumberOrNull` coercion (or inline) for
   realities.
5. Module-scope `let replAuto = { realities: null, ts181: null };`.
6. In the 250 ms `peakIntervalId` callback, after the existing peak logic, run the watcher
   block from the spec: call `nextReplAutoState`, store baselines, and on `changed` apply the
   enabled toggle + checkbox sync + `tabEnabledMemory` invalidation + `refreshPausedTabs()` +
   row flash + `saveSettings()`.

## Step 4 — build + verify

1. `npm run build` — regenerates `ad-auto.js`.
2. `npm test` — all green.
3. Sanity-grep `ad-auto.js` for `eternityWhenStale` / `shouldEternityInstead` (should be
   gone) and for `autoManage` / `nextReplAutoState` (should be present).

## Review dimensions (adversarial)

- Reducer correctness vs every spec case (esp. baseline reset when `autoManage` off, and
  true→false NOT triggering disable).
- AD API correctness: `TimeStudy(181).isBought`, `player.realities` availability/shape;
  null-safety of probes.
- Dead-code completeness: no lingering `eternityWhenStale` / `canEternity` /
  `shouldEternityInstead` / `warnedNoCanEternityProbe` references anywhere.
- Persistence/migration: old saved settings with `eternityWhenStale` load without error;
  `autoManage` round-trips.
- UI parity: programmatic toggle matches manual toggle (checkbox, dim, memory, flash, save).
- Build artifact matches source (generated `ad-auto.js` regenerated, not hand-edited).
