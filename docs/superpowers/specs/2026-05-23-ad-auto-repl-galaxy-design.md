# ad-auto: auto-trigger Replicanti Galaxy reset (+ remove broken Max Repl)

Date: 2026-05-23
Scope: `ad-auto.template.js` —

1. Add a new auto-action `replGalaxy` that calls the global `replicantiGalaxy()` function on every 50 ms tick.
2. Remove the broken `buyMaxRep` action (handler paths `Replicanti.galaxies.buyMax` and `maxReplicantiGalaxies` both missing in this AD build; the row has been a no-op).

## Motivation

The Replicanti panel exposes a primary button labelled "Reset Replicanti amount for a Replicanti Galaxy" (HTML class `o-primary-btn--replicanti-galaxy`). Clicking it spends all current Replicanti and grants `+1` Replicanti Galaxy when `Replicanti.galaxies.canBuyMore` is true. The tool currently has no row that automates this single-galaxy trigger; the existing `Max Repl` row's handler paths (`Replicanti.galaxies.buyMax`, `maxReplicantiGalaxies`) don't resolve in this AD build and are a separate cleanup.

Console probing confirmed that `replicantiGalaxy` is exposed as a top-level function on `window`. Calling it when `canBuyMore` is false is a no-op (the AD function gates internally), matching the pattern used by every other reset-class action in the panel.

## Behavior

Four edits to `ad-auto.template.js`:

1. **New entry in `config`**, placed right after `buyMaxReplUpgrades` so the Repl-related rows stay grouped on the Infinity tab:

   ```js
   replGalaxy: { tab: 'Infinity', label: 'Repl Galaxy', enabled: false, period: 50, amount: null },
   ```

2. **New entry in `handlerPaths`**, alongside the existing single-function action mappings:

   ```js
   replGalaxy: ['replicantiGalaxy'],
   ```

3. **Remove `buyMaxRep` from `config`.** The row's handlers don't resolve in this build, so the row has been firing into nothing. Removing it cleans up dead UI state.

4. **Remove `buyMaxRep` from `handlerPaths`.** Same reason.

After the removals the Infinity-tab config group is: `buyMaxID`, `buyMaxReplUpgrades`, `replGalaxy`, `buyMaxIPMult`, `eternity`.

Properties:

- **Tab:** Infinity. Matches the natural in-game location and groups with the other Replicanti rows.
- **Label:** `Repl Galaxy`. Mirrors the existing `Galaxy` row naming (which fires the antimatter galaxy reset).
- **Default `enabled`:** `false`. Opt-in, matching every Infinity-tab action.
- **Period:** `50 ms`. Matches the other reset-class actions (`galaxy`, `dimBoost`, `crunch`). When Replicanti hits cap and a galaxy is buyable, the fire happens on the very next tick.
- **Amount:** `null`. No gate; the existing `hasGate` derivation in the row builder (`gates.replGalaxy` undefined → `hasGate === false`) renders the amount input disabled with the `n/a` placeholder.
- **No new gate.** `replicantiGalaxy()` internally checks `canBuyMore` and no-ops when nothing is buyable. Calling it every 50 ms is safe; the `hits` counter increments on every tick whether or not a galaxy was actually gained. Same pattern as the existing `galaxy` action.
- **No new probe / state.** The action is a pure trigger; no auxiliary feedback into other features.

## Side effects on existing features

- **IPMult-double, peak-IP ratchet, crunch-delay, auto-ratchet:** unaffected. None of them read Replicanti galaxy count.
- **Existing `Max Repl` row:** removed. Saved-settings keys for `buyMaxRep` under `__auto_settings_v1` are silently ignored on next load by the existing `if (!config[n] || !saved) continue` guard in the loader — no migration code needed, no crash on stale settings.
- **`maxAll` action:** if `maxAll()` already drives `replicantiGalaxy()` in some AD versions, the new row is redundant-but-harmless — both calls hit the same internal `canBuyMore` gate.
- **Persistence:** `enabled`, `period`, `amount` for the new action are persisted via `saveSettings()` and restored on boot via the existing stored-config loop. No new keys.
- **Stats:** the new row increments `hits` once per tick when dispatch returns normally. If `replicantiGalaxy` is missing entirely (unexpected, given the probe), dispatch throws and the row's error counter increments via the existing path.

## Out of scope

- Showing replicanti progress / galaxy count in the panel.
- Capping at a target galaxy count.
- Gating on a Replicanti amount threshold inside the snippet (the AD function already gates internally).

## Acceptance

- The Infinity tab no longer shows a `Max Repl` row.
- The Infinity tab shows a new row `Repl Galaxy` between `Max Repl Upgrades` and `Max IPMult` with a checkbox (unchecked by default), period input defaulting to `50`, a disabled amount input showing `n/a`, and a `hits` counter starting at `0`.
- Enabling the row causes `replicantiGalaxy()` to be called on every 50 ms tick.
- When Replicanti hits cap and `Replicanti.galaxies.canBuyMore` flips true, the next tick buys a Replicanti Galaxy (`player.replicanti.galaxies` increments by 1 in-game) and Replicanti resets.
- When `canBuyMore` is false, the call is a no-op; `hits` keeps climbing.
- Disabling the row halts further calls. Manual or in-game-autobuyer purchases continue independently.
- Refreshing the page and re-pasting the snippet restores the row's `enabled` / `period` state.
- `npm test` still passes the existing test count; no new tests are added.
- `npm run build` regenerates `ad-auto.js` cleanly.
