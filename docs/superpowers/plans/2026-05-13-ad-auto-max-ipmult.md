# ad-auto Max IPMult Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new auto-action `buyMaxIPMult` that calls `InfinityUpgrade.ipMult.buyMax()` from the main 50 ms loop, sitting in the Infinity tab alongside the other `buyMax*` actions.

**Architecture:** Two-line data change in `ad-auto.template.js`: add one entry to the `config` object and one entry to the `handlerPaths` object. No new pure logic, no new tests, no new state. Then rebuild.

**Tech Stack:** Vanilla JS (browser IIFE runtime), AD globals (`InfinityUpgrade.ipMult.buyMax`).

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-13-ad-auto-max-ipmult-design.md`.

**Commits:** Direct to `main`. Conventional-commit prefix.

---

### Task 1: Add the buyMaxIPMult action + rebuild

**Files:**
- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

- [ ] **Step 1: Add the config entry**

In `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`, find the `config` object at the top of the IIFE. The current Infinity-tab entries look like:

```js
    buyMaxID:  { tab: 'Infinity', label: 'Max IDs',    enabled: false, period: 200,  amount: null },
    buyMaxRep: { tab: 'Infinity', label: 'Max Repl',   enabled: false, period: 200,  amount: null },
    eternity:  { tab: 'Infinity', label: 'Eternity',   enabled: false, period: 100,  amount: null },
```

Insert a new line BETWEEN `buyMaxRep` and `eternity` so the new action is grouped with the buyMax siblings:

```js
    buyMaxIPMult: { tab: 'Infinity', label: 'Max IPMult', enabled: false, period: 200,  amount: null },
```

Final Infinity group:

```js
    buyMaxID:     { tab: 'Infinity', label: 'Max IDs',    enabled: false, period: 200,  amount: null },
    buyMaxRep:    { tab: 'Infinity', label: 'Max Repl',   enabled: false, period: 200,  amount: null },
    buyMaxIPMult: { tab: 'Infinity', label: 'Max IPMult', enabled: false, period: 200,  amount: null },
    eternity:     { tab: 'Infinity', label: 'Eternity',   enabled: false, period: 100,  amount: null },
```

(Re-align the column spacing for readability — the existing entries align their `{` slightly; match that pattern.)

- [ ] **Step 2: Add the handlerPaths entry**

Find the `handlerPaths` object. Insert `buyMaxIPMult: ['InfinityUpgrade.ipMult.buyMax'],` between `buyMaxRep` and `eternity` to keep the same ordering:

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

- [ ] **Step 3: Rebuild ad-auto.js**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 4: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 65 tests pass (no new tests).

- [ ] **Step 5: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'buyMaxIPMult' ad-auto.js
grep -c "InfinityUpgrade.ipMult.buyMax" ad-auto.js
```

Expected: both >= 2 (one occurrence each in the snippet section + the URL-encoded bookmarklet line).

- [ ] **Step 6: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: add Max IPMult auto-action

Drives InfinityUpgrade.ipMult.buyMax() from the main 50ms loop in the
Infinity tab. Default disabled, 200ms period, no gate. Each tick where
buyMax actually purchases N upgrades, the existing IPMult-double
feature detects the purchaseCount rise and scales config.crunch.amount
by 2^N. No new state, no new tests; the two features cooperate through
the in-game purchaseCount.
EOF
```

---

### Task 2: Manual verification handoff

**Files:** none modified.

- [ ] **Step 1: Hand off verification script to the user**

> 1. Open Antimatter Dimensions with a save where IPMult is still buyable (purchaseCount below cap, IP available).
> 2. Paste the freshly built `ad-auto.js` snippet into the console.
> 3. Switch to the Infinity tab in the panel. A new `Max IPMult` row should appear between `Max Repl` and `Eternity`. Checkbox unchecked, TIME shows `200`, AMOUNT shows `n/a` (disabled).
> 4. Note your current `InfinityUpgrade.ipMult.purchaseCount` (e.g., via the console probe used earlier).
> 5. Enable the `Max IPMult` row.
> 6. Within seconds, observe:
>    - The `Max IPMult` row's `Hits` counter increments as the action fires every 200 ms.
>    - `InfinityUpgrade.ipMult.purchaseCount` climbs in-game.
>    - The crunch row's amount field flashes green as the IPMult-double feature scales it by `2^N` for each detected rise in `purchaseCount`.
> 7. Toggle the row off. The Hits counter stops incrementing. Manual or in-game-autobuyer purchases continue to be observed by the IPMult-double feature (no change to that path).
> 8. Refresh the page and re-paste the snippet. The `Max IPMult` row's enable / period state is persisted and restored.

- [ ] **Step 2: Mark complete**

If the row appears, the action fires, the count climbs, and the crunch amount scales accordingly, the feature is done.

---

## Self-review notes

- **Spec coverage:** every acceptance bullet maps to runtime behavior produced by the two table entries.
- **No placeholders.** Both edits show concrete code.
- **No tests required.** The change is data-only additions to existing tables. No new pure logic.
- **Type consistency:** the new config entry mirrors the shape of the other Infinity-tab entries exactly. The new handlerPaths entry follows the same `name: [...paths]` shape.
