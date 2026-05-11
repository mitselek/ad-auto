# ad-auto: ratchet crunch amount up to live peak.ip

Date: 2026-05-12
Scope: `ad-auto.template.js` — inside the existing `peakIntervalId` 250 ms callback, after the IPMult-double block, auto-update `config.crunch.amount` to `peak.ip` whenever `peak.ip` exceeds the current amount.

## Goal

Today, the user gets a peak threshold into `config.crunch.amount` only by clicking the peak row. Once set, the threshold doesn't track further gain growth (other than the IPMult auto-double we just shipped). Other gain increases — one-time doubling Infinity upgrades, more galaxies, infinities, time spent — outpace the threshold, causing the auto-crunch to fire below the new theoretical peak.

This change makes the threshold ratchet up automatically: every tick where the live `peak.ip` exceeds `config.crunch.amount`, the amount is bumped up to `peak.ip`. The threshold is monotonically non-decreasing within and across runs. The user can still set a manual ceiling (a value higher than current peak.ip) which holds until peak catches up.

## Behavior

The new block runs **inside the existing `peakIntervalId` 250 ms callback**, **after** the existing IPMult-double block.

Per tick:

1. If `peak.ip == null` → no-op (no peak yet this run; can happen after a fresh crunch when `updatePeak` reset peak to `null`).
2. Decide whether to update. Let `cur = config.crunch.amount`:
   - If `cur == null` or `cur === ''` → `shouldUpdate = true` (adopt the first peak observed).
   - Else if `typeof window.Decimal === 'function'` → wrap in `try { ... } catch { shouldUpdate = false }`:
     - `prev = new window.Decimal(cur)`.
     - `shouldUpdate = peak.ip.gt(prev)` (in AD, `peak.ip` is always a Decimal with a `.gt` method).
   - Else → `shouldUpdate = false` (defensive; AD always provides `window.Decimal`).
3. If `shouldUpdate`:
   - `s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip)`.
   - Write `s` to `config.crunch.amount`.
   - Write `s` to the crunch row's `<input>` value (reuse the existing selector `input[data-name="crunch"][data-prop="amount"]` from the IPMult block).
   - Add `.flash` class to the crunch row for 600 ms (reuses the existing `.row.flash` CSS rule generalized in the IPMult change).
   - Call `saveSettings()`.

The function inputs are taken from the existing scope (`peak`, `config`, `panel`, `rowEls`, `saveSettings`). No new persisted state. No new probe.

## Interaction with the IPMult-double block

The IPMult block runs first on the same tick. If it just doubled the amount, the peak-ratchet block then compares `peak.ip` against the *new doubled* amount. The ratchet only fires if `peak.ip` still exceeds the doubled amount. Both rules can fire on the same tick — they are independent updates.

## Existing click-to-copy

The peak-row click handler that copies `peak.ip` into the crunch amount is left in place. With the auto-ratchet on, the click is a redundant manual trigger of what now happens automatically, but it's harmless and we make no change to it.

## Where the decision lives

Inline in `ad-auto.template.js` — no new pure function, no new Vitest tests. The Decimal compare and string conversion are short and use the same defensive pattern (`typeof window.Decimal === 'function'`, `try/catch` around construction) as the IPMult-double block.

Trade-off acknowledged: this skips the TDD discipline we used for `updateIpMult`. The decision is simple enough (compare and conditionally assign) that the cost of inlining is low. If future work expands the rule (e.g., persist peak across runs, halve on manual override), it should be extracted to `src/core.mjs` with full test coverage at that point.

## Out of scope

- Persisting `peak.ip` across page reloads or across crunches in localStorage.
- Halving the threshold on manual override or on any reset signal.
- A UI toggle to disable the ratchet.
- Removing or modifying the existing peak-row click-to-copy handler.
- Tracking any non-IPMult doubling upgrades (still out of scope from the prior feature).

## Acceptance

- With `config.crunch.amount` empty/null at boot and a fresh run, the first observed peak (within ~250 ms of `peak.ip` becoming non-null) populates the amount field and crunches the row green.
- With `config.crunch.amount` set to `1e30` and peak.ip climbing from `1e10` → `1e60`, the amount field auto-updates and flashes each time `peak.ip` exceeds the current amount (approximately monotonic ratchet to `1e60`).
- With `config.crunch.amount` set to `1e80` and peak.ip below `1e80`, no update fires. Manual ceiling is preserved.
- If the user manually edits the amount to a value below current `peak.ip`, the next tick (within ~250 ms) auto-bumps it back up to `peak.ip` with a flash. The system treats `peak.ip` as a floor.
- On crunch (run reset), `peak.ip` becomes `null` via `updatePeak`. The ratchet block does nothing while peak.ip is null. As the new run produces peaks, the ratchet resumes; the threshold stays at the prior cross-run high until the new run's peak exceeds it.
- On an IPMult purchase tick, the IPMult-double fires first; the ratchet then either fires again (if peak.ip exceeded the doubled amount) or doesn't (more typical: doubled amount is now higher than current peak.ip).
- With `window.Decimal` absent (synthetic edge case; AD always provides it), the ratchet is silently inert except for the empty-amount adopt path.
- `npm test` still passes the existing 53 tests; no new tests are added by this change.
- `npm run build` regenerates `ad-auto.js` cleanly.
