# ad-auto: dispatch preserves `this` on method handlers

Date: 2026-05-13
Scope: `ad-auto.template.js` — rewrite `dispatch` to call dotted-path handlers with their natural receiver, so methods like `InfinityUpgrade.ipMult.buyMax` get the correct `this` binding.

## Motivation

Manual verification of the Max IPMult feature surfaced that `Max IPMult` throws every tick (1308 errors in 70s). Same pattern observed on `Max IDs` (1414 errors / 70s). The dispatcher does:

```js
const fn = resolveFn(p);
if (typeof fn === 'function') return fn();
```

`resolveFn` walks the dotted path and returns the leaf function, detached from its receiver. Calling `fn()` invokes it with `this = undefined` under the IIFE's strict-mode evaluation context. break_infinity-style classes use `this` heavily (e.g., `this.cost`, `this.purchaseCount`, `this._config`), so they throw `TypeError: Cannot read properties of undefined` on the first property access.

Today this affects:

- `Max IPMult` → `InfinityUpgrade.ipMult.buyMax` (newly added in commit `8f7f840`).
- `Max IDs` → `InfinityDimensions.buyMax` (second fallback path; reached when `window.buyMaxInfinityDimensions` does not exist in the current AD build).
- Latent risk on any other dotted-path handler whose target is a method (`Replicanti.galaxies.buyMax`, `TimeDimensions.buyMax`, `Dilation.requestStartDilation`).

The single-segment handlers (`maxAll`, `manualRequestDimensionBoost`, etc.) are plain top-level functions that don't depend on `this` — they happen to work either way.

The bug is a one-method fix. Rewrite `dispatch` to bind `this` properly. No other change required; no new state; no behavior change for the already-working actions.

## Behavior

Replace the body of `dispatch` in `ad-auto.template.js` with:

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

Semantics by path shape:

| Handler path                              | parts after pop      | receiver                          | call                                    |
|-------------------------------------------|----------------------|-----------------------------------|-----------------------------------------|
| `'maxAll'`                                | `[]`                 | `window`                          | `window.maxAll()` (identical to today)  |
| `'manualBigCrunchResetRequest'`           | `[]`                 | `window`                          | `window.manualBigCrunchResetRequest()`  |
| `'InfinityDimensions.buyMax'`             | `['InfinityDimensions']` | `window.InfinityDimensions`   | `InfinityDimensions.buyMax()` with proper `this` |
| `'Replicanti.galaxies.buyMax'`            | `['Replicanti', 'galaxies']` | `window.Replicanti.galaxies` | `Replicanti.galaxies.buyMax()` with proper `this` |
| `'InfinityUpgrade.ipMult.buyMax'`         | `['InfinityUpgrade', 'ipMult']` | `window.InfinityUpgrade.ipMult` | `InfinityUpgrade.ipMult.buyMax()` with proper `this` |

`resolveFn` becomes unused after this change — `dispatch` no longer calls it. The function is still declared at the top of the IIFE. Leave it: it's a small helper that may be useful in future work, removing it would just create a no-op diff. Out of scope to delete.

`resolveRaw` (the related helper used by `gateCrunch`, `peakProbes`, and the IPMult-count probe) is **not** modified. It walks a path of *values*, optionally invoking a function-typed leaf, and returns the raw value. Its semantics are different and the value-typed leaves it resolves (`gainedInfinityPoints`, `player.records.thisInfinity.time`, `InfinityUpgrade.ipMult.purchaseCount`) are either standalone window-level functions or property getters that don't depend on `this`.

## Out of scope

- Removing `resolveFn` (dead-code cleanup; harmless to keep).
- Adding fallback-on-throw behavior (if the first handler path throws, the loop currently bails; the new dispatcher preserves that behavior — moves to the next path only when the current path is unreachable, not when it throws).
- Unit tests for `dispatch` (the function depends on `window` globals; current test surface is the pure logic in `src/core.mjs`). Manual verification is the gate.
- Logging the resolved receiver for debugging (could help diagnose future regressions, but no need today).

## Acceptance

- After applying the change and rebuilding, enabling `Max IPMult` causes its `Hits` counter to increment by 1 per tick (no errors). `InfinityUpgrade.ipMult.purchaseCount` rises whenever something is affordable.
- After applying the change and rebuilding, enabling `Max IDs` causes its `Hits` counter to increment without errors (assuming the action would succeed on this save's state).
- The existing actions whose handlers are plain `window`-level functions (`maxAll`, `dimBoost`, `galaxy`, `sacrifice`, `crunch`, `eternity` first-path, `dilatedEternity` first-path) continue to fire with the same behavior as before. No regression.
- The 65 Vitest tests still pass.
- `npm run build` regenerates `ad-auto.js` cleanly.
