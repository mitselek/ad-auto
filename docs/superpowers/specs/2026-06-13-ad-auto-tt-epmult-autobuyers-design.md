# ad-auto: TT autobuyers (AM/IP/EP) + Max EP Mult autobuyer

Date: 2026-06-13
Scope: `ad-auto.template.js` + `src/core.mjs` + `tests/core.test.mjs`

Add four new auto-actions on the **Eternity** tab:

1. `amTT` — buy max Time Theorems using **only Antimatter**.
2. `ipTT` — buy max Time Theorems using **only Infinity Points**.
3. `buyMaxEPMult` — buy max of the **EP-multiplier** Eternity upgrade.
4. `epTT` — buy max Time Theorems using **only Eternity Points**.

Ordering requirement: `amTT` and `ipTT` may fire whenever. `epTT` must fire **after `buyMaxEPMult` has had its turn**, because both spend EP and the EP multiplier should always get first dibs on EP.

## Motivation

The tool already automates the AM/IP/TD/EP-adjacent buy-max actions but has no Time-Theorem or EP-multiplier autobuyers. Time Theorems are bought with three separate currencies (AM, IP, EP); the EP multiplier is the EP-tab analogue of the existing `buyMaxIPMult` (`InfinityUpgrade.ipMult.buyMax`). Adding these lets the panel keep TT topped up and the EP multiplier maxed without manual clicking.

The EP/TT interaction matters: buying max TT *with EP* drains EP, and so does the EP multiplier. The EP multiplier is the higher-value sink, so EP TT must only run once the EP multiplier has already taken what it wants on that tick.

## API (verified against AD source — `IvarK/AntimatterDimensionsSourceCode`, master)

All exposed on `window` via `mergeIntoGlobal()`. The buy calls require an argument, so none of them fit the no-argument `handlerPaths` dispatch — all four use `customDispatchers`.

| Action | Exact call | Why an arg is needed |
|--------|-----------|----------------------|
| `amTT` | `TimeTheoremPurchaseType.am.purchase(true)` | `true` = buy max of *this* currency only |
| `ipTT` | `TimeTheoremPurchaseType.ip.purchase(true)` | same |
| `epTT` | `TimeTheoremPurchaseType.ep.purchase(true)` | same |
| `buyMaxEPMult` | `EternityUpgrade.epMult.buyMax(true)` | `true` = suppress the RU15 lock modal when called from automation |

Notes:
- `TimeTheorems.buyMax()` is deliberately **not** used — it buys from all three currencies at once, which would defeat per-currency control and the EP ordering.
- `purchase(true)` returns a boolean and is a cheap no-op when the currency can't afford a TT. `buyMax(true)` likewise no-ops when unaffordable/locked. So no affordability gate is needed — same "fire = attempt" semantics as the existing `buyMax*` rows.
- Each per-currency object exposes `.canAfford` and `.amount`; `epMult` exposes `.isAffordable` and `.boughtAmount`. None are needed for this design (kept simple), but they exist if a future gate is wanted.

## Behavior

### 1. New `config` entries (Eternity tab), in firing order

Inserted after the existing `buyMaxTD` Eternity entry. **Order matters**: `buyMaxEPMult` is placed immediately before `epTT` so the main loop dispatches it first within any tick.

```js
buyMaxTD:     { tab: 'Eternity', label: 'Max TDs',     enabled: false, period: 200, amount: null },
amTT:         { tab: 'Eternity', label: 'TT from AM',  enabled: false, period: 200, amount: null },
ipTT:         { tab: 'Eternity', label: 'TT from IP',  enabled: false, period: 200, amount: null },
buyMaxEPMult: { tab: 'Eternity', label: 'Max EP Mult', enabled: false, period: 200, amount: null },
epTT:         { tab: 'Eternity', label: 'TT from EP',  enabled: false, period: 200, amount: null },
```

All four default `enabled: false` (opt-in, like every non-AD-tab action) and `period: 200` (matching the other buy-max rows). `epTT` and `buyMaxEPMult` share the same default period so, when both are enabled, they are due on the same ticks and stay in lockstep.

### 2. New `customDispatchers`

Four entries mirroring the existing `buyMaxReplUpgrades` pattern: null-check the global, throw a clear `[auto] <name>: <global> missing` error if absent, otherwise make the call.

```js
amTT:         () => buyMaxTTWith('am'),
ipTT:         () => buyMaxTTWith('ip'),
epTT:         () => buyMaxTTWith('ep'),
buyMaxEPMult: () => {
  const u = window.EternityUpgrade && window.EternityUpgrade.epMult;
  if (u == null || typeof u.buyMax !== 'function') throw new Error('[auto] buyMaxEPMult: EternityUpgrade.epMult missing');
  u.buyMax(true);
},
```

with a small shared helper inside the snippet:

```js
const buyMaxTTWith = (type) => {
  const t = window.TimeTheoremPurchaseType && window.TimeTheoremPurchaseType[type];
  if (t == null || typeof t.purchase !== 'function') throw new Error(`[auto] TT ${type}: TimeTheoremPurchaseType.${type} missing`);
  t.purchase(true);
};
```

### 3. EP-TT ordering gate ("same cadence")

A tick-scoped `let tickNow = 0;` is set at the top of `mainTick` (`tickNow = now;`). A new `lastAttempt` table (seeded like `lastRun`) records when each action *got its turn* this tick — set right after the period + gate checks pass, **before** `dispatch`, so it advances even if dispatch throws. A new gate on `epTT`:

```js
gates.epTT = (cfg) => shouldFireEpTt({
  epMultEnabled: config.buyMaxEPMult.enabled,
  epMultHadTurnThisTick: lastAttempt.buyMaxEPMult === tickNow,
});
```

The decision is extracted as a pure function in `src/core.mjs`:

```js
export function shouldFireEpTt({ epMultEnabled, epMultHadTurnThisTick }) {
  if (!epMultEnabled) return true;       // nothing to defer to
  return epMultHadTurnThisTick;          // EP Mult already had its turn this tick
}
```

Why this works:
- `buyMaxEPMult` sits earlier in config order, so the main loop reaches it first and sets `lastAttempt.buyMaxEPMult = now` once its period + gate pass.
- When the loop reaches `epTT`, `tickNow === now`, so `lastAttempt.buyMaxEPMult === tickNow` is true **iff** EP Mult got its turn this very tick → `epTT` may proceed.
- If EP Mult was throttled (its period not yet elapsed) this tick, `lastAttempt.buyMaxEPMult !== tickNow` → `epTT` is held until a tick where EP Mult runs again. This intentionally couples `epTT`'s cadence to EP Mult's (per the "same cadence" requirement): setting EP Mult's period longer than `epTT`'s throttles `epTT` down to EP Mult's period.
- **"Had its turn" = attempted, not succeeded.** `lastAttempt` advances before `dispatch`, so a throwing or no-op EP Mult (which spends no EP) does not starve `epTT`. Using `lastRun` (which only advances on success) would permanently block `epTT` if EP Mult's global were missing.
- If the user disables EP Mult entirely, the first clause lets `epTT` run on its own period (there is no EP Mult to order against).

`epTT` still passes the generic period check first (`now - lastRun.epTT < cfg.period`), so a user may throttle `epTT` slower than EP Mult; it simply can never fire on a tick where EP Mult didn't.

`amTT` and `ipTT` have **no** gate — they fire on their own period whenever, as specified.

## Side effects on existing features

- **Firing order:** the new entries are appended to `config`; existing actions keep their relative order and behavior. The only intra-tick ordering that matters (EP Mult before EP TT) is guaranteed by declaration order plus the gate.
- **Persistence:** `enabled` / `period` / `amount` for the four new actions persist via the existing `saveSettings()` config loop and restore on boot. No new persisted keys, no migration.
- **Tab toggle / paused indicator (prior feature):** the Eternity tab now has five mechanics instead of one; `toggleTabEnabled` / `isTabFullyPaused` operate on whatever is in `config` for that tab, so they pick up the new rows automatically with no change.
- **`stats` / `lastRun`:** initialized generically from `Object.keys(config)`, so the four new actions get counters automatically.
- **Amount inputs:** none of the four define a `gates`-with-amount entry that reads `cfg.amount`, and only `epTT` has a gate at all (which ignores `amount`). The row builder's `hasGate` derivation keys off `name in gates`; see Open question below.

## Out of scope

- Affordability gates / target caps on any of the four (the AD calls already no-op when unaffordable).
- Showing TT count / EP-mult count in the panel.
- A combined single-row "EP Mult + EP TT" action (kept as two independently-toggleable rows per the requirement).
- Buying TT via `buyOneOfEach` or respecting the in-game `ttBuyMax` perk (we call the per-currency max directly and unconditionally).

## Open question resolved

`epTT` appears in `gates`, so the row builder's `hasGate` (`name in gates`) would render an **enabled amount input** for it — but `epTT`'s gate ignores `amount`, so that input would be a misleading no-op. To avoid this, the row builder's amount-input enabling must key off an explicit "this gate consumes `amount`" set, not merely `name in gates`. Resolution: introduce an `amountGated` set (`sacrifice`, `crunch`) used by the row builder for the `hasGate` decision, leaving `gates` for firing logic only. This keeps `epTT`'s amount input disabled (`n/a`) like the other gateless-for-the-user rows.

## Acceptance

- The Eternity tab shows five rows in order: `Max TDs`, `TT from AM`, `TT from IP`, `Max EP Mult`, `TT from EP`. Each has an unchecked checkbox, period `200`, a disabled amount input showing `n/a`, and a `hits` counter at `0`.
- Enabling `TT from AM` calls `TimeTheoremPurchaseType.am.purchase(true)` every 200 ms; likewise IP and EP for their rows; `Max EP Mult` calls `EternityUpgrade.epMult.buyMax(true)`.
- With both `Max EP Mult` and `TT from EP` enabled at equal periods, every tick that fires them dispatches EP Mult first, then EP TT — verified by `hits` climbing together and EP being spent on the multiplier before TT.
- Disabling `Max EP Mult` lets `TT from EP` fire on its own period.
- `amTT` / `ipTT` fire independently of EP Mult.
- A missing AD global makes the corresponding row's dispatch throw; its `errs` counter increments (existing error path) without affecting other rows.
- `shouldFireEpTt` has direct unit tests covering: EP Mult disabled → true; EP Mult enabled + ran this tick → true; EP Mult enabled + did not run this tick → false.
- `npm test` passes (existing + new `shouldFireEpTt` tests). `npm run build` regenerates `ad-auto.js` cleanly.
