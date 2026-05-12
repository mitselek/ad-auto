# ad-auto: auto-buy max IPMult action

Date: 2026-05-13
Scope: `ad-auto.template.js` — add a new auto-action `buyMaxIPMult` that calls `InfinityUpgrade.ipMult.buyMax()` on its tick.

## Motivation

`InfinityUpgrade.ipMult` is the repeatable infinity upgrade that doubles IP gain per purchase. The IPMult-double feature already tracks its `purchaseCount` and scales `config.crunch.amount` by `2^delta` whenever the count rises. But it relies on the user (or the in-game autobuyer) actually performing the purchases.

Adding `buyMaxIPMult` to the tool's action list means the snippet itself can drive the purchases at a fixed cadence. Each call to `InfinityUpgrade.ipMult.buyMax()` purchases as many tiers as the player can currently afford. The downstream `updateIpMult` tick then scales `crunch.amount` proportionally — zero new wiring between the two features, they communicate through `purchaseCount`.

## Behavior

Two additions to `ad-auto.template.js`:

1. **New entry in `config`**, in the Infinity-tab group next to `buyMaxID` / `buyMaxRep` / `eternity`:

   ```js
   buyMaxIPMult: { tab: 'Infinity', label: 'Max IPMult', enabled: false, period: 200, amount: null },
   ```

2. **New entry in `handlerPaths`**:

   ```js
   buyMaxIPMult: ['InfinityUpgrade.ipMult.buyMax'],
   ```

Properties:

- **Tab:** Infinity. Matches the natural in-game location and groups with sibling `buyMax*` actions.
- **Label:** `Max IPMult`. Mirrors `Max IDs` / `Max Repl` / `Max TDs` naming.
- **Default `enabled`:** `false` (matches every other Infinity-tab action; opt-in by the user).
- **Period:** `200 ms` (matches the other `buyMax` cadences).
- **Amount:** `null`. The action has no gate; the amount column shows the existing `n/a` placeholder and the input is disabled (via the existing `hasGate` derivation in the row builder — `gates.buyMaxIPMult` is not defined, so `hasGate === false`).
- **No new gate.** `InfinityUpgrade.ipMult.buyMax()` is idempotent: if nothing is affordable or the upgrade is capped, it's a no-op. No need to short-circuit from the snippet side.
- **No new probe / state.** The IPMult-double feature already reads `purchaseCount`; this action just causes that count to change. Connection is through in-game state.

## Side effects on existing features

- **IPMult-double:** when `buyMax` lands N purchases in one tick, `updateIpMult` sees `purchaseCount` rise by N on the next 250 ms peak tick and scales `crunch.amount` by `2^N`. Already works; no change needed.
- **Auto-ratchet:** unaffected. `peak.ip` continues to climb based on `gainedInfinityPoints`, and the ratchet still respects the hysteresis bar against whatever `crunch.amount` becomes after the IPMult-double scales it.
- **Crunch-delay:** unaffected. The auto-buyer fires from the main 50 ms tick; the crunch action's delay logic is independent.
- **Persistence:** `enabled`, `period`, `amount` for the new action are persisted via `saveSettings()` and restored on boot via the existing stored-config loop. No new keys.

## Out of scope

- Showing IPMult cost / affordability in the panel.
- Capping purchases at a target `purchaseCount` value.
- Gating on a custom threshold (e.g., "only buy if IPMult cost < some fraction of current IP").
- Cooperating with the in-game `Autobuyer.ipMult` (which the user can configure separately; both can run, idempotently).
- Adding similar auto-buy actions for the one-time doubling upgrades (`dim18mult`, etc.).

## Acceptance

- The Infinity tab shows a new row `Max IPMult` with a checkbox (unchecked by default), a `period` input defaulting to `200`, a disabled amount input showing `n/a`, and a `hits` counter starting at `0`.
- Enabling the row causes `InfinityUpgrade.ipMult.buyMax()` to be called on every 200 ms tick (subject to the existing main-loop `period` check).
- When called, `purchaseCount` may rise. The IPMult-double feature's next 250 ms peak tick detects the rise and scales `config.crunch.amount` by `2^delta`, flashes the crunch row, and persists via `saveSettings()`. No new code path required.
- Disabling the row halts further `buyMax` calls. Subsequent in-game manual purchases (or AD's own autobuyer) continue to be observed by the IPMult-double feature as before.
- `npm test` still passes the existing 65 tests; no new tests are added (no new pure logic — the change is data-only additions to `config` and `handlerPaths`).
- `npm run build` regenerates `ad-auto.js` cleanly.
