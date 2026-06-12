# ad-auto Repl Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new auto-action `replGalaxy` that calls the global `replicantiGalaxy()` function from the main 50 ms loop, AND remove the broken `buyMaxRep` row whose handler paths don't resolve in this AD build.

**Architecture:** Pure data change in `ad-auto.template.js`: add `replGalaxy` to `config` + `handlerPaths`, remove `buyMaxRep` from both. No new pure logic, no new tests, no new state, no `customDispatchers`. Existing saved-settings loader silently skips stale keys, so no migration is needed for users with `buyMaxRep` in their `__auto_settings_v1`.

**Tech Stack:** Vanilla JS (browser IIFE runtime), AD global (`replicantiGalaxy()`).

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-23-ad-auto-repl-galaxy-design.md`.

**Commits:** Direct to `main`. Conventional-commit prefix.

---

## Task 1: Swap buyMaxRep → replGalaxy + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

- [ ] **Step 1: Update the `config` Infinity-tab group**

In `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`, find the Infinity-tab group of the `config` object. The current group looks like:

```js
    buyMaxID:           { tab: 'Infinity', label: 'Max IDs',           enabled: false, period: 200,  amount: null },
    buyMaxRep:          { tab: 'Infinity', label: 'Max Repl',          enabled: false, period: 200,  amount: null },
    buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200,  amount: null },
    buyMaxIPMult:       { tab: 'Infinity', label: 'Max IPMult',        enabled: false, period: 200,  amount: null },
    eternity:           { tab: 'Infinity', label: 'Eternity',          enabled: false, period: 100,  amount: null },
```

Two changes in this block: (a) delete the `buyMaxRep` line entirely; (b) insert a new `replGalaxy` line between `buyMaxReplUpgrades` and `buyMaxIPMult`. Final group (note `buyMaxReplUpgrades` is still the widest key so column alignment is preserved):

```js
    buyMaxID:           { tab: 'Infinity', label: 'Max IDs',           enabled: false, period: 200,  amount: null },
    buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200,  amount: null },
    replGalaxy:         { tab: 'Infinity', label: 'Repl Galaxy',       enabled: false, period: 50,   amount: null },
    buyMaxIPMult:       { tab: 'Infinity', label: 'Max IPMult',        enabled: false, period: 200,  amount: null },
    eternity:           { tab: 'Infinity', label: 'Eternity',          enabled: false, period: 100,  amount: null },
```

- [ ] **Step 2: Update the `handlerPaths` object**

Find the `handlerPaths` object. The current entries look like:

```js
  const handlerPaths = {
    maxAll:          ['maxAll'],
    dimBoost:        ['manualRequestDimensionBoost'],
    galaxy:          ['manualRequestGalaxyReset'],
    sacrifice:       ['sacrificeBtnClick'],
    crunch:          ['manualBigCrunchResetRequest'],
    buyMaxID:        ['buyMaxInfinityDimensions', 'InfinityDimensions.buyMax'],
    buyMaxRep:       ['Replicanti.galaxies.buyMax', 'maxReplicantiGalaxies'],
    buyMaxIPMult:    ['InfinityUpgrade.ipMult.buyMax'],
    eternity:        ['eternity', 'requestEternity', 'manualRequestEternity'],
    buyMaxTD:        ['buyMaxTimeDimensions', 'TimeDimensions.buyMax'],
    dilatedEternity: ['startDilatedEternity', 'Dilation.requestStartDilation'],
  };
```

Delete the `buyMaxRep` line and insert `replGalaxy: ['replicantiGalaxy'],` in the same position so the Infinity-group ordering matches `config`:

```js
  const handlerPaths = {
    maxAll:          ['maxAll'],
    dimBoost:        ['manualRequestDimensionBoost'],
    galaxy:          ['manualRequestGalaxyReset'],
    sacrifice:       ['sacrificeBtnClick'],
    crunch:          ['manualBigCrunchResetRequest'],
    buyMaxID:        ['buyMaxInfinityDimensions', 'InfinityDimensions.buyMax'],
    replGalaxy:      ['replicantiGalaxy'],
    buyMaxIPMult:    ['InfinityUpgrade.ipMult.buyMax'],
    eternity:        ['eternity', 'requestEternity', 'manualRequestEternity'],
    buyMaxTD:        ['buyMaxTimeDimensions', 'TimeDimensions.buyMax'],
    dilatedEternity: ['startDilatedEternity', 'Dilation.requestStartDilation'],
  };
```

Note: `buyMaxReplUpgrades` does NOT appear in `handlerPaths` (it lives in `customDispatchers`).

- [ ] **Step 3: Rebuild `ad-auto.js`**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 4: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: all existing tests pass (the change is data-only — no new pure logic, no new tests).

- [ ] **Step 5: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'replGalaxy' ad-auto.js
grep -c 'replicantiGalaxy' ad-auto.js
grep -c 'buyMaxRep' ad-auto.js
```

Expected: `replGalaxy` >= 2, `replicantiGalaxy` >= 2 (one in snippet + one in URL-encoded bookmarklet line). `buyMaxRep` count is exactly `2` *if and only if* the previous occurrences in this file are limited to `buyMaxReplUpgrades` (it shares the `buyMaxRep` prefix). Verify by running `grep -o 'buyMaxRep[A-Za-z]*' ad-auto.js | sort -u` — the only result should be `buyMaxReplUpgrades` (i.e., no bare `buyMaxRep` remains).

- [ ] **Step 6: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: add Repl Galaxy auto-action, remove broken Max Repl

Drives the global replicantiGalaxy() function from the main 50ms loop in
the Infinity tab. Default disabled, 50ms period, no gate. The AD function
internally checks canBuyMore and no-ops when nothing is buyable, so calls
are safe on every tick.

Also removes the buyMaxRep ('Max Repl') row whose handler paths
(Replicanti.galaxies.buyMax, maxReplicantiGalaxies) don't resolve in
this AD build; the row had been firing into nothing. Saved-settings
keys for buyMaxRep are silently ignored by the existing loader guard,
so no migration is needed.
EOF
```

---

## Task 2: Manual verification handoff

**Files:** none modified.

- [ ] **Step 1: Hand off verification script to the user**

> 1. Open Antimatter Dimensions with a save where Replicanti is unlocked and at-or-near cap (or growing toward it).
> 2. Paste the freshly built `ad-auto.js` snippet into the console (or click the bookmarklet).
> 3. Switch to the Infinity tab in the panel. The old `Max Repl` row should be gone. A new `Repl Galaxy` row appears between `Max Repl Upgrades` and `Max IPMult`. Checkbox unchecked, TIME shows `50`, AMOUNT shows `n/a` (disabled).
> 4. Note your current `player.replicanti.galaxies` (or just the in-panel "Replicanti Galaxies" counter).
> 5. Enable the `Repl Galaxy` row.
> 6. Observe:
>    - The row's `hits` counter increments every 50 ms (~20/s) regardless of whether a galaxy was bought.
>    - When `Replicanti.galaxies.canBuyMore` flips true (Replicanti hits cap), the very next tick triggers a galaxy: `player.replicanti.galaxies` increments by 1, Replicanti resets, and the in-game "Reset Replicanti amount for a Replicanti Galaxy" button briefly flips back to disabled while Replicanti regrows.
>    - When Replicanti is below cap, `replicantiGalaxy()` is a no-op; `hits` continues to climb.
> 7. Toggle the row off. The hits counter stops incrementing. No more galaxies are bought from the snippet (in-game manual clicks still work).
> 8. Refresh the page and re-paste the snippet. The `Repl Galaxy` row's `enabled` / `period` state is persisted and restored.
> 9. Sanity: open the row's stats — if any `errs` appear (the `(N!)` suffix), the snippet failed to resolve `replicantiGalaxy`. Report the console error.

- [ ] **Step 2: Mark complete**

If the row appears, fires at the expected cadence, and triggers galaxy purchases when `canBuyMore` is true, the feature is done.

---

## Self-review notes

- **Spec coverage:** every acceptance bullet maps to runtime behavior produced by the two table entries.
- **No placeholders.** Both edits show concrete code.
- **No tests required.** Data-only additions to existing tables; no new pure logic.
- **Type consistency:** the new config entry mirrors the shape of the other Infinity-tab entries exactly. The new `handlerPaths` entry follows the same `name: [...paths]` shape.
- **Pattern match:** this is the same shape of change as the Max IPMult feature (commit `8f7f840`). No new abstraction needed.
