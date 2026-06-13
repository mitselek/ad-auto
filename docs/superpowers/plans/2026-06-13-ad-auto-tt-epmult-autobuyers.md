# ad-auto TT + Max EP Mult Autobuyers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development for Task 1. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four Eternity-tab auto-actions — `amTT`, `ipTT`, `buyMaxEPMult`, `epTT` — where AM/IP TT fire freely and EP TT only fires on a tick where Max EP Mult has already had its turn.

**Architecture:** One pure decision function (`shouldFireEpTt`) in `src/core.mjs` (TDD'd), inlined into the snippet. Everything else is wiring in `ad-auto.template.js`: four `config` rows, four `customDispatchers` (the AD calls need an argument, so they can't use `handlerPaths`), a tick-scoped `tickNow`, one `gates.epTT` entry, and a small `amountGated` decoupling so `epTT`'s presence in `gates` doesn't render a misleading amount input.

**Tech Stack:** Vanilla JS (browser IIFE), AD globals (`TimeTheoremPurchaseType.{am,ip,ep}.purchase`, `EternityUpgrade.epMult.buyMax`), vitest.

**Working files:**
- Modify: `src/core.mjs`, `tests/core.test.mjs`, `ad-auto.template.js`
- Generated: `ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-06-13-ad-auto-tt-epmult-autobuyers-design.md`

**Commits:** Direct to `main`, conventional-commit prefix.

---

## Task 1: Pure `shouldFireEpTt` (TDD)

**Files:** Modify `src/core.mjs`, `tests/core.test.mjs`

- [ ] **Step 1 (RED):** Add to `tests/core.test.mjs` a `describe('shouldFireEpTt')` with three cases, and import `shouldFireEpTt`:
  - EP Mult disabled → `true` regardless of `epMultRanThisTick`.
  - EP Mult enabled + `epMultRanThisTick: true` → `true`.
  - EP Mult enabled + `epMultRanThisTick: false` → `false`.
  Run `npm test`; confirm the new tests fail with `shouldFireEpTt is not a function`.

- [ ] **Step 2 (GREEN):** Add to `src/core.mjs`:
  ```js
  export function shouldFireEpTt({ epMultEnabled, epMultRanThisTick }) {
    if (!epMultEnabled) return true;
    return epMultRanThisTick;
  }
  ```
  Run `npm test`; confirm all green.

---

## Task 2: Wire the four actions into the template

**Files:** Modify `ad-auto.template.js`; generated `ad-auto.js`

- [ ] **Step 1: Add the four `config` rows on the Eternity tab.** After the `buyMaxTD` line, insert (order matters — `buyMaxEPMult` immediately before `epTT`):
  ```js
  buyMaxTD:     { tab: 'Eternity', label: 'Max TDs',     enabled: false, period: 200, amount: null },
  amTT:         { tab: 'Eternity', label: 'TT from AM',  enabled: false, period: 200, amount: null },
  ipTT:         { tab: 'Eternity', label: 'TT from IP',  enabled: false, period: 200, amount: null },
  buyMaxEPMult: { tab: 'Eternity', label: 'Max EP Mult', enabled: false, period: 200, amount: null },
  epTT:         { tab: 'Eternity', label: 'TT from EP',  enabled: false, period: 200, amount: null },
  ```
  (`dilatedEternity` stays after these on the Dilation tab.)

- [ ] **Step 2: Add the shared TT helper + four `customDispatchers`.** Inside the existing `customDispatchers` object (next to `buyMaxReplUpgrades`):
  ```js
  amTT: () => buyMaxTTWith('am'),
  ipTT: () => buyMaxTTWith('ip'),
  epTT: () => buyMaxTTWith('ep'),
  buyMaxEPMult: () => {
    const u = window.EternityUpgrade && window.EternityUpgrade.epMult;
    if (u == null || typeof u.buyMax !== 'function') throw new Error('[auto] buyMaxEPMult: EternityUpgrade.epMult missing');
    u.buyMax(true);
  },
  ```
  And define the helper just above `customDispatchers`:
  ```js
  const buyMaxTTWith = (type) => {
    const t = window.TimeTheoremPurchaseType && window.TimeTheoremPurchaseType[type];
    if (t == null || typeof t.purchase !== 'function') throw new Error(`[auto] TT ${type}: TimeTheoremPurchaseType.${type} missing`);
    t.purchase(true);
  };
  ```

- [ ] **Step 3: Add `tickNow`.** Declare `let tickNow = 0;` alongside the other `mainTick` state, and set `tickNow = now;` as the first line inside `mainTick` (right after `const now = performance.now();`).

- [ ] **Step 4: Add the `epTT` gate.** In the `gates` object:
  ```js
  epTT: (cfg) => shouldFireEpTt({
    epMultEnabled: config.buyMaxEPMult.enabled,
    epMultRanThisTick: lastRun.buyMaxEPMult === tickNow,
  }),
  ```

- [ ] **Step 5: Decouple the amount-input decision from `gates`.** In the row-builder loop, replace `const hasGate = name in gates;` with an explicit amount-consuming set so `epTT`'s gate doesn't render an enabled amount input:
  ```js
  const amountGated = new Set(['sacrifice', 'crunch']);
  // ...inside the loop:
  const hasGate = amountGated.has(name);
  ```
  (Declare `amountGated` once, outside the loop.)

- [ ] **Step 6: Rebuild.** `npm run build` — expect a clean `built ad-auto.js (...)` line.

---

## Task 3: Verify

- [ ] **Step 1:** `npm test` — existing + new `shouldFireEpTt` tests pass.
- [ ] **Step 2: Sanity-grep the artifact:**
  ```bash
  grep -c "amTT\|ipTT\|epTT\|buyMaxEPMult\|buyMaxTTWith\|shouldFireEpTt\|tickNow\|amountGated" ad-auto.js
  ```
  Each new identifier should appear in the snippet (≥1; most also in the URL-encoded bookmarklet line).
- [ ] **Step 3: Adversarial review (ultracode workflow)** — dimensions: (a) independent re-verification of the four AD API calls against source; (b) `shouldFireEpTt` + gate logic correctness incl. desync/disabled edge cases; (c) DOM/row-builder correctness of the `amountGated` change (existing `sacrifice`/`crunch` amount inputs still enabled); (d) build/firing-order integrity. Each finding adversarially verified before reporting.

---

## Task 4: Manual verification handoff

- [ ] Open AD with Eternity unlocked and some EP. Paste the built snippet. On the Eternity tab confirm the five rows in order, all unchecked, period `200`, amount `n/a`.
- [ ] Enable `TT from AM` / `TT from IP` — confirm TT count climbs from those currencies; `hits` increments ~5/s each.
- [ ] Enable `Max EP Mult` + `TT from EP` together — confirm EP is spent on the multiplier first (EP-mult count rises), then leftover EP buys TT; both `hits` climb together.
- [ ] Disable `Max EP Mult`, keep `TT from EP` — confirm EP TT now fires on its own.
- [ ] Any `(N!)` errs ⇒ a global path didn't resolve in this build; report the console error (the `[auto] ...` message names which).
- [ ] Refresh + re-paste ⇒ the five rows' enabled/period persist.

---

## Self-review notes
- **No placeholders.** Every step shows concrete code.
- **TDD only where there's logic:** `shouldFireEpTt` is the sole pure decision; the dispatchers/gate/rows are wiring verified by build + manual handoff + the review workflow.
- **Ordering guarantee** rests on two facts already true in the engine: config iteration order = declaration order, and `lastRun[name]` is set to `now` on successful dispatch. The gate reads both via `tickNow`.
- **Pattern match:** dispatchers mirror `buyMaxReplUpgrades`; the EP-mult call mirrors `buyMaxIPMult`; rows mirror the other Eternity/Infinity buy-max rows.
