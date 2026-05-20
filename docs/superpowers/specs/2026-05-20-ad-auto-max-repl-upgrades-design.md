# ad-auto: auto-buy max Replicanti upgrades action

Date: 2026-05-20
Scope: `ad-auto.template.js` — add a new auto-action `buyMaxReplUpgrades` that drives the three Replicanti upgrades (chance, interval, max-galaxies) to max each tick.

## Motivation

The Replicanti panel exposes three repeatable upgrades — `chance`, `interval`, `galaxies` — each shown with its own "+1" cost button:

- Replicate chance: `+1%` for some IP cost
- Interval: each purchase shortens the replication interval (e.g., 729 → 656 ms) for some IP cost
- Max Replicanti Galaxies: `+1` to the cap for some IP cost

Console probing of the live AD build shows:

- `ReplicantiUpgrade.{chance,interval,galaxies}` are objects with `purchase()` (function) and `canBeBought` (boolean).
- None of them expose `.buyMax()`. There is no `Replicanti.galaxies.buyMax` or `maxReplicantiGalaxies` either (a separate latent bug in the existing `buyMaxRep` action — out of scope).

To drive these three upgrades from the tool we have to loop `purchase()` while `canBeBought` is true, per upgrade. This doesn't fit the existing `handlerPaths` shape (which is a fallback chain that resolves to a single function call per tick), so the dispatch layer gains a small extension.

## Behavior

Three additions to `ad-auto.template.js`:

1. **New entry in `config`**, in the Infinity-tab group between `buyMaxRep` and `buyMaxIPMult` so the four `Max …` buyers stay grouped:

   ```js
   buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200, amount: null },
   ```

2. **New `customDispatchers` map**, defined alongside `handlerPaths`:

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

3. **Small `dispatch()` extension**: check `customDispatchers[name]` first; if present, call it and return. Otherwise fall through to the existing `handlerPaths` walk.

   ```js
   function dispatch(name) {
     const custom = customDispatchers[name];
     if (typeof custom === 'function') return custom();
     for (const p of handlerPaths[name] || []) {
       // ... existing logic unchanged
     }
     throw new Error(`[auto] no handler resolved for ${name}`);
   }
   ```

   No entry in `handlerPaths` for `buyMaxReplUpgrades` — `customDispatchers` is the only path.

Properties:

- **Tab:** Infinity. Groups with sibling `Max …` actions.
- **Label:** `Max Repl Upgrades`. Distinguishes it from the existing `Max Repl` (galaxy-buyer) row.
- **Default `enabled`:** `false`. Opt-in, matching every other Infinity-tab action.
- **Period:** `200 ms`. Matches the other `Max …` cadences.
- **Amount:** `null`. No gate; the existing `hasGate` derivation in the row builder (`gates.buyMaxReplUpgrades` undefined → `hasGate === false`) renders the amount input disabled with the `n/a` placeholder.
- **No new gate.** Each upgrade's `canBeBought` check inside the loop is the per-upgrade gate. A tick where nothing is affordable runs three trivial `while` checks and exits.
- **Safety cap of 1000 iterations per upgrade.** Defensive against a runaway loop if `canBeBought` ever fails to flip false after a successful `purchase()`. 1000 tiers per 200 ms is far above any realistic affordability burst, so the cap is invisible in practice.
- **No new probe / state.** This action has no auxiliary feedback into other features (unlike `buyMaxIPMult`, which the IPMult-double feature watches via `purchaseCount`). Replicanti upgrade tier counts don't drive any existing scaling.

## Side effects on existing features

- **IPMult-double, peak-IP ratchet, crunch-delay, auto-ratchet:** all unaffected. None of them read Replicanti upgrade state.
- **`maxAll` action:** if the user's `maxAll` action already drives these upgrades (varies by AD version), the new row is redundant-but-harmless — each `purchase()` call when `canBeBought === false` is a no-op via the loop guard.
- **Persistence:** `enabled`, `period`, `amount` for the new action are persisted via `saveSettings()` and restored on boot via the existing stored-config loop. No new keys.
- **Stats:** the new row increments `hits` once per tick when dispatch returns normally. If `ReplicantiUpgrade` is missing entirely (unexpected), dispatch throws and the row's error counter increments (existing path).

## Out of scope

- Fixing the latent `buyMaxRep` action whose handler paths don't resolve in this build (`Replicanti.galaxies.buyMax` and `maxReplicantiGalaxies` both missing). A separate fix.
- Per-upgrade enable / period control (the chosen design is one combined row).
- Showing per-upgrade cost or affordability in the panel.
- Capping at a target tier count for any of the three upgrades.
- Gating on IP cost ratio (e.g., "only buy if cost < X% of current IP").
- Generalizing `customDispatchers` for other multi-call actions (it's added because this action needs it; future actions can adopt the same hook).

## Acceptance

- The Infinity tab shows a new row `Max Repl Upgrades` between `Max Repl` and `Max IPMult` with a checkbox (unchecked by default), period input defaulting to `200`, a disabled amount input showing `n/a`, and a `hits` counter starting at `0`.
- Enabling the row causes `ReplicantiUpgrade.{chance,interval,galaxies}.purchase()` to be called in a `while (canBeBought)` loop on every 200 ms tick.
- Replicanti upgrade tiers in-game climb to the affordable maximum within one tick after enable.
- Disabling the row halts further purchases. In-game manual or autobuyer purchases continue independently.
- Refreshing the page and re-pasting the snippet restores the row's `enabled` / `period` state.
- `npm test` still passes the existing test count; no new tests are added (no new pure logic — change is data plus a dispatch-layer hook in the browser-side template).
- `npm run build` regenerates `ad-auto.js` cleanly.
