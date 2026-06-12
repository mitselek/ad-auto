# ad-auto post-threshold crunch delay Implementation Plan (TDD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Iron law:** every production line in `src/core.mjs` must follow a failing test you watched fail. Tests-after = delete and restart.

**Goal:** For the crunch action only, when `config.crunch.amount` is a positive Decimal threshold, repurpose `config.crunch.period` as a post-threshold delay: once `gateCrunch` passes, wait `period` ms before firing. Locked timer (no gate re-check mid-wait). All other actions and crunch-without-threshold keep period-as-interval semantics.

**Architecture:** One new pure function `isThresholdSet(amount, DecimalCtor) → boolean` in `src/core.mjs`, TDD'd via Vitest. Browser wiring in `ad-auto.template.js` adds a closure-local `crunchReadyAt` timestamp and a special branch in the main 50 ms `intervalId` callback that runs *before* the default period-as-interval path. No CSS / HTML changes.

**Tech Stack:** Vanilla JS (browser IIFE runtime), ESM (Node 18+), Vitest, break_infinity `Decimal`.

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/src/core.mjs`
- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/tests/core.test.mjs`
- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-12-ad-auto-crunch-delay-design.md`.

**Commits:** Direct to `main`. Conventional-commit prefixes (`test:`, `feat:`).

---

## Pure-function contract (recap from spec)

```js
// isThresholdSet(amount, DecimalCtor) → boolean
// amount      = string | null | undefined
// DecimalCtor = function | undefined
```

Rules:

- `amount == null` → `false`.
- After trimming, `''` → `false`.
- After trimming, `'0'` → `false` (shortcut).
- `typeof DecimalCtor !== 'function'` → `Number(amount) > 0` (returns `false` for `NaN`).
- `new DecimalCtor(amount)` throws → `false`.
- Otherwise → `parsed.gt(0)` if `typeof parsed.gt === 'function'`; else `Number(parsed) > 0`.

The function never throws on any input.

---

### Task 1: TDD `isThresholdSet`

**Files:**

- Modify: `src/core.mjs` (add export)
- Modify: `tests/core.test.mjs` (add describe block + 11 tests + import)

- [ ] **Step 1 (RED): add import and tests**

In `/home/michelek/Documents/github/mitselek/ad-auto/tests/core.test.mjs`, extend the existing import line to include `isThresholdSet`:

```js
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch, updateIpMult, isThresholdSet } from '../src/core.mjs';
```

Append a new describe block to the end of the file:

```js
describe('isThresholdSet', () => {
  // Small stub mirroring the existing FakeDecimal pattern, with a .gt method
  // that interprets the original construction string numerically.
  class FakeDecimal {
    constructor(s) {
      if (s === 'BOOM') throw new Error('boom');
      this._s = String(s);
    }
    gt(other) {
      const n = Number(this._s);
      const o = typeof other === 'object' && other !== null ? Number(other._s) : Number(other);
      return n > o;
    }
  }

  test('null returns false', () => {
    expect(isThresholdSet(null)).toBe(false);
  });

  test('undefined returns false', () => {
    expect(isThresholdSet(undefined)).toBe(false);
  });

  test('empty string returns false', () => {
    expect(isThresholdSet('')).toBe(false);
  });

  test('whitespace string returns false', () => {
    expect(isThresholdSet('   ')).toBe(false);
  });

  test('"0" returns false (shortcut)', () => {
    expect(isThresholdSet('0')).toBe(false);
  });

  test('positive numeric string with DecimalCtor returns true', () => {
    expect(isThresholdSet('1e60', FakeDecimal)).toBe(true);
  });

  test('negative numeric string with DecimalCtor returns false', () => {
    expect(isThresholdSet('-1e60', FakeDecimal)).toBe(false);
  });

  test('unparseable string with throwing DecimalCtor returns false', () => {
    expect(isThresholdSet('BOOM', FakeDecimal)).toBe(false);
  });

  test('positive numeric string without DecimalCtor returns true', () => {
    expect(isThresholdSet('5')).toBe(true);
  });

  test('"0" without DecimalCtor returns false', () => {
    expect(isThresholdSet('0')).toBe(false);
  });

  test('unparseable string without DecimalCtor returns false', () => {
    expect(isThresholdSet('abc')).toBe(false);
  });
});
```

- [ ] **Step 2 (RED verify): run tests, confirm failure**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npx vitest run tests/core.test.mjs
```

Expected: 11 new `isThresholdSet` tests fail with `isThresholdSet is not a function` or similar import-related error. Existing 54 tests still pass.

- [ ] **Step 3 (GREEN): minimal implementation**

Append to `/home/michelek/Documents/github/mitselek/ad-auto/src/core.mjs`:

```js
export function isThresholdSet(amount, DecimalCtor) {
  if (amount == null) return false;
  const s = String(amount).trim();
  if (s === '') return false;
  if (s === '0') return false;
  if (typeof DecimalCtor !== 'function') {
    const n = Number(s);
    return Number.isFinite(n) && n > 0;
  }
  let parsed;
  try {
    parsed = new DecimalCtor(s);
  } catch {
    return false;
  }
  if (typeof parsed?.gt === 'function') {
    try { return parsed.gt(0); } catch { return false; }
  }
  const n = Number(parsed);
  return Number.isFinite(n) && n > 0;
}
```

- [ ] **Step 4 (GREEN verify): run tests, all pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npx vitest run tests/core.test.mjs
```

Expected: 65 tests pass (54 prior + 11 new).

- [ ] **Step 5: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add src/core.mjs tests/core.test.mjs
git commit -F /dev/stdin <<'EOF'
feat(core): add isThresholdSet for parsing crunch amount as a positive Decimal

Returns true only when the amount string parses to a strictly positive
Decimal value. Defensive against null, empty, whitespace, "0", and a
throwing DecimalCtor. Will gate the post-threshold-delay mode in the
template wiring.
EOF
```

---

### Task 2: Wire crunch-delay into `ad-auto.template.js` + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

**Background:** The build script inlines `src/core.mjs` at the `// @inline:core` marker so `isThresholdSet` is callable by name inside the IIFE — no `import`. Add a closure-local `crunchReadyAt`, then insert a special crunch branch at the start of the action loop body in the main 50 ms `intervalId` callback.

- [ ] **Step 1: Declare `crunchReadyAt` near the other closure-local state**

In `ad-auto.template.js`, find the line that declares `lastIpMultCount` (near the top of the IIFE):

```js
  let lastIpMultCount = (stored && typeof stored.lastIpMultCount === 'number')
    ? stored.lastIpMultCount
    : null;
```

Immediately AFTER that block (after the multi-line declaration finishes), add:

```js
  let crunchReadyAt = null;
```

- [ ] **Step 2: Insert the special crunch branch in the main `intervalId` callback**

Locate the main 50 ms tick loop:

```js
  const intervalId = setInterval(() => {
    const now = performance.now();
    for (const [name, cfg] of Object.entries(config)) {
      if (!cfg.enabled) continue;
      if (now - lastRun[name] < cfg.period) continue;
      if (gates[name] && !gates[name](cfg)) continue;
      try {
        dispatch(name);
        stats[name].fires++;
        lastRun[name] = now;
      } catch (e) {
        stats[name].errs++;
        if (stats[name].errs <= 2) console.warn(name, 'threw', e);
      }
    }
    refreshGui();
  }, TICK_MS);
```

Insert a new branch immediately AFTER the `if (!cfg.enabled) continue;` line and BEFORE the existing `if (now - lastRun[name] < cfg.period) continue;` line:

```js
      if (name === 'crunch' && isThresholdSet(cfg.amount, window.Decimal)) {
        if (crunchReadyAt != null) {
          if (now < crunchReadyAt) continue;
          try {
            dispatch('crunch');
            stats.crunch.fires++;
            lastRun.crunch = now;
          } catch (e) {
            stats.crunch.errs++;
            if (stats.crunch.errs <= 2) console.warn('crunch', 'threw', e);
          }
          crunchReadyAt = null;
          continue;
        }
        if (!gates.crunch(cfg)) continue;
        crunchReadyAt = now + cfg.period;
        continue;
      }
```

After this insertion, the loop body's order is:

1. `if (!cfg.enabled) continue;`
2. New crunch-with-threshold branch (handles fire-on-timer-expiry, gate-then-set-timer, or skip).
3. Default branch: period-as-interval check, gate check, dispatch.

When crunch has no threshold, the new branch's outer condition fails, control falls through to the default branch — preserving today's behavior for `amount` empty / `'0'` / unset.

- [ ] **Step 3: Rebuild `ad-auto.js`**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 4: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 65 tests pass (after Task 1 added 11).

- [ ] **Step 5: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'crunchReadyAt' ad-auto.js
grep -c 'isThresholdSet' ad-auto.js
```

Expected: both ≥ 1 in the snippet section.

- [ ] **Step 6: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: post-threshold crunch delay using TIME field

When crunch.amount is a positive Decimal (isThresholdSet true), TIME
becomes a post-threshold delay: once gateCrunch passes, wait TIME ms
before firing. Locked timer (no gate re-check mid-wait). When the
threshold is unset or zero, TIME continues to act as a period-between-
attempts interval. Other actions unchanged.
EOF
```

---

### Task 3: Manual verification handoff

**Files:** none modified.

**Background:** TDD covers the pure-function side. The locked-timer behavior + dual-mode (threshold vs no-threshold) needs live verification.

- [ ] **Step 1: Hand off verification script to the user**

> 1. Open Antimatter Dimensions with an in-progress save.
> 2. Open DevTools → Console.
> 3. Paste the SNIPPET section of the freshly built `ad-auto.js`. Panel mounts.
> 4. **No-threshold mode:** clear the crunch amount via `localStorage.removeItem('__auto_settings_v1')` + re-paste, OR start fresh in a new tab. With `crunch.amount` empty/null and `crunch.period = 50` and crunch enabled, the action should fire on every 50 ms tick that the gate allows — matching today's behavior.
> 5. **Threshold mode, period=0:** wait for the ratchet to populate `crunch.amount` from peak.ip (or click the peak row to set it manually). Set the crunch row's TIME field to `0`. Once `gainedIP >= amount`, the auto-crunch should fire on the very next 50 ms tick (≈50 ms latency).
> 6. **Threshold mode, period=5000:** set TIME to `5000` on the crunch row. Wait for the threshold to be re-met (or click peak row to update). Once `gainedIP >= amount`, no fire happens immediately — the timer is running. ~5 seconds later, crunch fires.
> 7. **Toggle disable mid-wait:** during step 6's wait, uncheck the Crunch row's enable box. The timer should pause (no fire). Re-check the box; if the timer has already expired, the next tick should fire.
> 8. **Threshold cleared mid-wait (defensive — should be unreachable via UI):** confirm that programmatic writes from ratchet/IPMult never set amount to empty/'0'. Skip if no easy way to test.
> 9. **Stats counter:** after a delayed crunch fires, the `Hits` cell on the Crunch row should increment by 1.

- [ ] **Step 2: Capture deviations**

Symptom → likely cause:

- Crunch fires immediately on threshold (no delay) → the special branch isn't running. Check that `isThresholdSet(cfg.amount, window.Decimal)` returns `true` for the current amount; the branch's order relative to the default branch.
- Timer never expires → `crunchReadyAt` not being compared against `now` correctly, or `now` is in the wrong unit.
- Action fires twice in quick succession → `crunchReadyAt` is set but not cleared after dispatch.
- No-threshold mode broken → the `continue` inside the special branch is too greedy; the threshold check at the outer `if` needs to fail cleanly so control falls through.

- [ ] **Step 3: Mark feature complete**

Once steps 4-9 behave correctly, the feature is done.

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task.
  - `isThresholdSet` pure function → Task 1.
  - Browser wiring (closure state + crunch branch) → Task 2.
  - Edge cases (disable mid-wait, manual crunch, locked timer) → covered by the locked-timer semantics of Task 2; verified in Task 3.
- **No placeholders.** All code blocks are concrete.
- **Type consistency:** `crunchReadyAt` is a number-or-null timestamp; consistent across declaration, set, compare, clear sites.
- **Test count:** Task 1 adds 11 tests (54 → 65).
- **TDD discipline:** Task 1 follows RED → GREEN → COMMIT. Task 2 is template-only (no Vitest by design).
