# ad-auto Max Repl Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new auto-action `buyMaxReplUpgrades` that loops `.purchase()` on each of `ReplicantiUpgrade.{chance,interval,galaxies}` while `canBeBought` is true, driven from the main 50 ms tick.

**Architecture:** Three small additions to `ad-auto.template.js`: one entry in `config`, one entry in a new `customDispatchers` map (function value, not a path string), and a two-line check at the top of `dispatch()` that delegates to `customDispatchers` before the existing `handlerPaths` walk. No new pure logic, no new tests, no new state.

**Tech Stack:** Vanilla JS (browser IIFE runtime), AD globals (`ReplicantiUpgrade.chance`, `ReplicantiUpgrade.interval`, `ReplicantiUpgrade.galaxies` — each exposing `.purchase()` and `.canBeBought`).

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-20-ad-auto-max-repl-upgrades-design.md`.

**Commits:** Direct to `main`. Conventional-commit prefix.

---

## Task 1: Add the buyMaxReplUpgrades action + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

- [ ] **Step 1: Add the config entry**

In `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`, find the `config` object at the top of the IIFE. The current Infinity-tab group looks like:

```js
    buyMaxID:     { tab: 'Infinity', label: 'Max IDs',    enabled: false, period: 200,  amount: null },
    buyMaxRep:    { tab: 'Infinity', label: 'Max Repl',   enabled: false, period: 200,  amount: null },
    buyMaxIPMult: { tab: 'Infinity', label: 'Max IPMult', enabled: false, period: 200,  amount: null },
    eternity:     { tab: 'Infinity', label: 'Eternity',   enabled: false, period: 100,  amount: null },
```

Insert a new line BETWEEN `buyMaxRep` and `buyMaxIPMult` so the four `Max …` buyers stay grouped:

```js
    buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200,  amount: null },
```

Final Infinity group (note the longest key — `buyMaxReplUpgrades` — now sets the column width; realign the `{` column for readability):

```js
    buyMaxID:           { tab: 'Infinity', label: 'Max IDs',           enabled: false, period: 200,  amount: null },
    buyMaxRep:          { tab: 'Infinity', label: 'Max Repl',          enabled: false, period: 200,  amount: null },
    buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200,  amount: null },
    buyMaxIPMult:       { tab: 'Infinity', label: 'Max IPMult',        enabled: false, period: 200,  amount: null },
    eternity:           { tab: 'Infinity', label: 'Eternity',          enabled: false, period: 100,  amount: null },
```

- [ ] **Step 2: Add the `customDispatchers` map**

Find the `handlerPaths` declaration (currently around line 57 of the template):

```js
  const handlerPaths = {
    maxAll:          ['maxAll'],
    dimBoost:        ['manualRequestDimensionBoost'],
    // ...
    dilatedEternity: ['startDilatedEternity', 'Dilation.requestStartDilation'],
  };
```

Insert a NEW `customDispatchers` declaration IMMEDIATELY AFTER the closing `};` of `handlerPaths`:

```js
  const customDispatchers = {
    buyMaxReplUpgrades: () => {
      const buyToMax = (target) => {
        if (target == null || typeof target.purchase !== 'function') return;
        let safety = 1000;
        while (target.canBeBought && safety-- > 0) target.purchase();
      };
      const RU = window.ReplicantiUpgrade;
      if (RU == null) throw new Error('ReplicantiUpgrade missing');
      buyToMax(RU.chance);
      buyToMax(RU.interval);
      buyToMax(RU.galaxies);
    },
  };
```

Do NOT add an entry for `buyMaxReplUpgrades` in `handlerPaths` — the custom dispatcher is the only path.

- [ ] **Step 3: Extend `dispatch()` to check `customDispatchers` first**

Find the `dispatch` function (currently around line 86):

```js
  function dispatch(name) {
    for (const p of handlerPaths[name] || []) {
      const parts = p.split('.');
      const fnName = parts.pop();
      const receiver = parts.reduce((o, k) => (o == null ? o : o[k]), window);
      if (receiver != null && typeof receiver[fnName] === 'function') {
        return receiver[fnName]();
      }
    }
    throw new Error(`[auto] no handler resolved for ${name}`);
  }
```

Add two lines at the top — a `customDispatchers` check that short-circuits when present. The function body becomes:

```js
  function dispatch(name) {
    const custom = customDispatchers[name];
    if (typeof custom === 'function') return custom();
    for (const p of handlerPaths[name] || []) {
      const parts = p.split('.');
      const fnName = parts.pop();
      const receiver = parts.reduce((o, k) => (o == null ? o : o[k]), window);
      if (receiver != null && typeof receiver[fnName] === 'function') {
        return receiver[fnName]();
      }
    }
    throw new Error(`[auto] no handler resolved for ${name}`);
  }
```

- [ ] **Step 4: Rebuild `ad-auto.js`**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 5: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: all existing tests pass (the change is browser-side template only — no `src/core.mjs` edits, no new tests).

- [ ] **Step 6: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'buyMaxReplUpgrades' ad-auto.js
grep -c 'customDispatchers' ad-auto.js
grep -c 'ReplicantiUpgrade' ad-auto.js
```

Expected: each count >= 2 (one occurrence in the snippet section + one in the URL-encoded bookmarklet line).

- [ ] **Step 7: Commit**

Write the commit message to a temp file (HEREDOC inside `git commit -F /dev/stdin` is fine here — no backticks in the message), then commit:

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: add Max Repl Upgrades auto-action

Drives ReplicantiUpgrade.{chance,interval,galaxies}.purchase() in a
while (canBeBought) loop on the main 50ms tick, one combined Infinity-tab
row. Disabled by default, 200ms period, no gate. Adds a customDispatchers
map for actions that fan out into multiple calls; dispatch() checks it
before the existing handlerPaths walk. 1000-iteration safety cap per
upgrade. No new state, no new tests.
EOF
```

---

## Task 2: Manual verification handoff

**Files:** none modified.

- [ ] **Step 1: Hand off verification script to the user**

> 1. Open Antimatter Dimensions with a save where at least one Replicanti upgrade still has affordable tiers (IP > current cost on chance, interval, or galaxies).
> 2. Paste the freshly built `ad-auto.js` snippet into the console (or click the bookmarklet).
> 3. Switch to the Infinity tab in the panel. A new `Max Repl Upgrades` row should appear between `Max Repl` and `Max IPMult`. Checkbox unchecked, TIME shows `200`, AMOUNT shows `n/a` (disabled).
> 4. Note the current tier counts of the three upgrades in the Replicanti panel (Replicate chance %, Interval ms, Max Replicanti Galaxies count).
> 5. Enable the `Max Repl Upgrades` row.
> 6. Within one to two ticks (≤ 400 ms), observe:
>    - The row's `hits` counter starts incrementing every 200 ms.
>    - The three Replicanti upgrade tier counts climb up to whatever the current IP affords. Once everything affordable is bought, tier counts stop climbing but `hits` continues incrementing (each tick is a fast no-op loop).
>    - When IP regenerates past the next tier cost, the next tick buys it.
> 7. Toggle the row off. Tier counts stop climbing entirely. `hits` stops incrementing.
> 8. Refresh the page and re-paste the snippet. The `Max Repl Upgrades` row's `enabled` / `period` state is persisted and restored.
> 9. Sanity: open the row's stats — if any `errs` appear (the `(N!)` suffix), the dispatcher hit the `ReplicantiUpgrade missing` throw or an internal AD error. Report back with the console message.

- [ ] **Step 2: Mark complete**

If the row appears, fires, tier counts climb as IP affords them, and disabling halts purchases, the feature is done.

---

## Self-review notes

- **Spec coverage:** all six acceptance bullets in the spec map to runtime behavior produced by the three template edits.
  - Row visible / defaults → Step 1 (config entry) + existing row-builder in the template (no row-builder edits needed; `hasGate` derivation handles the disabled amount column automatically).
  - Dispatch fans out three `purchase()` loops → Step 2 (`customDispatchers`) + Step 3 (dispatch hook).
  - Disable halts firing → existing main-loop `if (!cfg.enabled) continue` covers this.
  - Persistence → existing `saveSettings()` / stored-config loop covers `enabled`/`period`/`amount` without changes.
  - Tests still pass → Step 5.
  - `npm run build` clean → Step 4.
- **No placeholders.** Every edit shows the concrete code.
- **No new tests required.** The change is data-only plus a tiny browser-side dispatch hook. The pure-logic surface in `src/core.mjs` is untouched.
- **Type consistency:** the new config entry mirrors the shape of the other Infinity-tab entries exactly. The new dispatch hook returns the result of the custom function (matching the existing `return receiver[fnName]()` semantics).
- **Out-of-scope reminder:** the latent `Max Repl` (galaxy-buyer) bug surfaced during probing is intentionally not addressed here.
