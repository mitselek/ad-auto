# Engine FPS Control + Live Actual-FPS Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set the main-loop tick rate as a desired FPS from a header chip, and show the actual FPS the browser delivered (count of ticks in the trailing second).

**Architecture:** Replace the hardcoded `TICK_MS = 50` with a recreatable engine. Two pure helpers (`clampFps`, `trimWindow`) live in `src/core.mjs` and are unit-tested. The template gains an `engineFps` setting, a `mainTick`/`startEngine` refactor, a header chip (editable desired FPS + live actual readout), a tick-timestamp buffer, and persistence. `ad-auto.js` is regenerated via `npm run build`.

**Tech Stack:** Vanilla JS (browser bookmarklet/snippet), Vitest for pure-logic tests, Node build script that inlines `src/core.mjs` into `ad-auto.template.js`.

---

## File Structure

- `src/core.mjs` — add two exported pure functions: `clampFps`, `trimWindow`.
- `tests/core.test.mjs` — add `describe` blocks for both; extend the import line.
- `ad-auto.template.js` — engine refactor, header chip markup + CSS, change handler, drag-guard fix, persistence.
- `ad-auto.js` — generated; do not hand-edit, regenerate with `npm run build`.

---

## Task 1: `clampFps` helper

**Files:**
- Modify: `src/core.mjs`
- Test: `tests/core.test.mjs`

- [ ] **Step 1: Write the failing test**

Add to `tests/core.test.mjs` (after the last `describe` block):

```js
describe('clampFps', () => {
  test('passes a normal in-range value through (rounded to int)', () => {
    expect(clampFps(20)).toBe(20);
    expect(clampFps(30)).toBe(30);
    expect(clampFps('45')).toBe(45);
    expect(clampFps(20.6)).toBe(21);
  });
  test('clamps below min up to 1', () => {
    expect(clampFps(0)).toBe(1);
    expect(clampFps(-5)).toBe(1);
  });
  test('clamps above max down to 100', () => {
    expect(clampFps(101)).toBe(100);
    expect(clampFps(99999)).toBe(100);
  });
  test('keeps the exact bounds', () => {
    expect(clampFps(1)).toBe(1);
    expect(clampFps(100)).toBe(100);
  });
  test('falls back to default 20 for non-numeric / blank / nullish', () => {
    expect(clampFps(NaN)).toBe(20);
    expect(clampFps('')).toBe(20);
    expect(clampFps('   ')).toBe(20);
    expect(clampFps(null)).toBe(20);
    expect(clampFps(undefined)).toBe(20);
    expect(clampFps('abc')).toBe(20);
  });
});
```

Also extend the import on line 2 of `tests/core.test.mjs` to include `clampFps`:

```js
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch, updateIpMult, isThresholdSet, clampFps } from '../src/core.mjs';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run`
Expected: FAIL — `clampFps is not a function` / `clampFps is not exported`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core.mjs`:

```js
export function clampFps(value, def = 20, min = 1, max = 100) {
  if (value == null) return def;
  if (typeof value === 'string' && value.trim() === '') return def;
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return Math.round(n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run`
Expected: PASS (all `clampFps` tests green, existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/core.mjs tests/core.test.mjs
git commit -m "feat: add clampFps helper for engine FPS bounds"
```

---

## Task 2: `trimWindow` helper

**Files:**
- Modify: `src/core.mjs`
- Test: `tests/core.test.mjs`

This helper drops timestamps at or older than `windowMs` ago (assuming ascending order) and returns the surviving slice. The template uses its `.length` as the actual-FPS count and reassigns the buffer to the returned slice, so the buffer stays bounded.

- [ ] **Step 1: Write the failing test**

Add to `tests/core.test.mjs`:

```js
describe('trimWindow', () => {
  test('returns empty for an empty buffer', () => {
    expect(trimWindow([], 1000, 1000)).toEqual([]);
  });
  test('keeps all entries when all are within the window', () => {
    expect(trimWindow([900, 950, 990], 1000, 1000)).toEqual([900, 950, 990]);
  });
  test('drops entries at or older than windowMs ago', () => {
    // now-0 = 1000 (>= window, drop), now-500 = 500 (keep), now-900 = 100 (keep)
    expect(trimWindow([0, 500, 900], 1000, 1000)).toEqual([500, 900]);
  });
  test('treats the exact boundary as expired (strict)', () => {
    expect(trimWindow([0], 1000, 1000)).toEqual([]);
  });
  test('length equals the count of ticks in the trailing window', () => {
    const buf = [0, 100, 600, 800, 950];
    // now=1000, window=1000: 0 -> 1000 expired; 100,600,800,950 survive
    expect(trimWindow(buf, 1000, 1000).length).toBe(4);
  });
});
```

Extend the import on line 2 to include `trimWindow`:

```js
import { encodeBookmarklet, decodeBookmarklet, fmtExp, isRunReset, computeRate, isHigherRate, parseDecimalLike, updatePeak, gateCrunch, updateIpMult, isThresholdSet, clampFps, trimWindow } from '../src/core.mjs';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run`
Expected: FAIL — `trimWindow is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core.mjs`:

```js
export function trimWindow(timestamps, now, windowMs) {
  let i = 0;
  while (i < timestamps.length && now - timestamps[i] >= windowMs) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add src/core.mjs tests/core.test.mjs
git commit -m "feat: add trimWindow helper for trailing-second FPS count"
```

---

## Task 3: Engine refactor — `engineFps`, `mainTick`, `startEngine`, persistence

**Files:**
- Modify: `ad-auto.template.js`

The inlined core (via `// @inline:core`) makes `clampFps` and `trimWindow` available as bare functions inside the IIFE — no import needed in the template.

- [ ] **Step 1: Declare engine state after `lastIpMultCount`**

In `ad-auto.template.js`, find (around line 35):

```js
  let lastIpMultCount = (stored && typeof stored.lastIpMultCount === 'number')
    ? stored.lastIpMultCount
    : null;
  let crunchReadyAt = null;
  let currentTab = null;
```

Insert the engine state right after `let lastIpMultCount = ...;` (before `let crunchReadyAt`):

```js
  let engineFps = clampFps(stored && stored.engineFps);
  let fpsBuf = [];
  let actualFps = 0;
```

- [ ] **Step 2: Persist `engineFps` in `saveSettings`**

Find the `saveSettings` payload (around line 41-54). It ends with `lastIpMultCount,`. Add `engineFps,` alongside it:

```js
        lastIpMultCount,
        engineFps,
      }));
```

- [ ] **Step 3: Refactor the main loop into `mainTick` + `startEngine`**

Find the current main loop (lines ~174-209):

```js
  const TICK_MS = 50;
  const intervalId = setInterval(() => {
    const now = performance.now();
    for (const [name, cfg] of Object.entries(config)) {
      if (!cfg.enabled) continue;
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

Replace the whole block above with:

```js
  function mainTick() {
    const now = performance.now();
    fpsBuf.push(now);
    fpsBuf = trimWindow(fpsBuf, now, 1000);
    actualFps = fpsBuf.length;
    for (const [name, cfg] of Object.entries(config)) {
      if (!cfg.enabled) continue;
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
  }

  let mainIntervalId = null;
  function startEngine() {
    if (mainIntervalId != null) clearInterval(mainIntervalId);
    mainIntervalId = setInterval(mainTick, Math.round(1000 / engineFps));
  }
  startEngine();
```

- [ ] **Step 4: Point `api.stop` at the renamed interval id**

Find in the `api` object (around line 519-524):

```js
    stop() {
      clearInterval(intervalId);
      clearInterval(peakIntervalId);
```

Change `clearInterval(intervalId)` to `clearInterval(mainIntervalId)`:

```js
    stop() {
      clearInterval(mainIntervalId);
      clearInterval(peakIntervalId);
```

- [ ] **Step 5: Commit**

```bash
git add ad-auto.template.js
git commit -m "refactor: make engine tick rate recreatable via engineFps/startEngine"
```

Note: `ad-auto.js` is not rebuilt yet — that happens in Task 5 after the UI is in place, so there is a single coherent rebuild.

---

## Task 4: Header chip UI — editable desired FPS + live actual readout

**Files:**
- Modify: `ad-auto.template.js`

- [ ] **Step 1: Add chip markup to the header**

Find the header block (around line 322-327):

```js
    <div class="head">
      <div class="title">auto</div>
      <button data-act="copy" title="copy state JSON to clipboard">JSON</button>
      <button data-act="collapse" title="collapse">–</button>
      <button data-act="stop" title="stop &amp; remove">×</button>
    </div>
```

Replace it with (inserts the `.engine` chip between title and the JSON button):

```js
    <div class="head">
      <div class="title">auto</div>
      <span class="engine" title="engine tick rate (frames/sec) — desired | actual">
        <input type="number" class="fps-in" min="1" max="100" step="1" value="${engineFps}" title="desired FPS (1-100)">
        <span class="fps-sep">│</span>
        <span class="fps-actual" title="actual ticks in the last second">—</span>
      </span>
      <button data-act="copy" title="copy state JSON to clipboard">JSON</button>
      <button data-act="collapse" title="collapse">–</button>
      <button data-act="stop" title="stop &amp; remove">×</button>
    </div>
```

- [ ] **Step 2: Add chip CSS**

Find the `.title` CSS rule (around line 286):

```js
      #${PID} .title{font-size:12px;font-weight:600;flex:1;color:#e8e8ee;line-height:1}
```

Immediately after it, add:

```js
      #${PID} .engine{display:flex;align-items:center;gap:4px;font-size:11px;
        color:#888;font-variant-numeric:tabular-nums}
      #${PID} .engine .fps-in{width:38px;background:#1a1a24;color:#e8e8ee;
        border:1px solid #333;border-radius:3px;padding:1px 3px;font-size:11px;
        font-family:inherit;text-align:right;line-height:1.2}
      #${PID} .engine .fps-sep{color:#555}
      #${PID} .engine .fps-actual{min-width:22px;text-align:right;color:#9c9}
```

- [ ] **Step 3: Handle FPS input changes**

Find the change listener (around line 403-413):

```js
  panel.addEventListener('change', (e) => {
    const t = e.target;
    const { name, prop } = t.dataset;
    if (!name || !prop) return;
```

Insert the FPS branch right after `const t = e.target;` (before the `const { name, prop }` line):

```js
  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('fps-in')) {
      engineFps = clampFps(t.value);
      t.value = engineFps;
      startEngine();
      saveSettings();
      return;
    }
    const { name, prop } = t.dataset;
    if (!name || !prop) return;
```

- [ ] **Step 4: Stop the FPS input from triggering a panel drag**

Find the header drag handler (around line 478-483):

```js
  head.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
```

Extend the guard to also skip inputs and anything inside the engine chip:

```js
  head.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || (e.target.closest && e.target.closest('.engine'))) return;
```

- [ ] **Step 5: Render actual FPS in `refreshGui`**

Find the end of `refreshGui` (around line 511-513):

```js
    panel.querySelector('.uptime').textContent = Math.floor((now - startedAt) / 1000) + 's';
    const total = Object.values(stats).reduce((a, s) => a + s.fires, 0);
    panel.querySelector('.totals').textContent = total + ' fires';
  }
```

Insert the actual-FPS update before the closing brace:

```js
    panel.querySelector('.uptime').textContent = Math.floor((now - startedAt) / 1000) + 's';
    const total = Object.values(stats).reduce((a, s) => a + s.fires, 0);
    panel.querySelector('.totals').textContent = total + ' fires';
    const fpsEl = panel.querySelector('.fps-actual');
    if (fpsEl) fpsEl.textContent = String(actualFps);
  }
```

Note: `actualFps` is the count of ticks in the trailing second, so it is an
integer (e.g. `20`), not a decimal like `19.8`. This is the direct consequence
of the "sum measurements from the last second" approach chosen in the spec.

- [ ] **Step 6: Commit**

```bash
git add ad-auto.template.js
git commit -m "feat: header chip with editable desired FPS and live actual-FPS readout"
```

---

## Task 5: Build and verify

**Files:**
- Modify: `ad-auto.js` (generated)

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS — all existing tests plus the new `clampFps` and `trimWindow` suites.

- [ ] **Step 2: Regenerate the artifact**

Run: `npm run build`
Expected: prints `built ad-auto.js (... bytes; bookmarklet ... chars)` with no errors. The `// @inline:core` marker resolves and both new helpers appear inline.

- [ ] **Step 3: Sanity-check the generated file**

Run: `node -e "const s=require('fs').readFileSync('ad-auto.js','utf8'); for (const t of ['function clampFps','function trimWindow','startEngine','class=\"engine\"','fps-actual']) if(!s.includes(t)) throw new Error('missing: '+t); console.log('artifact OK');"`
Expected: prints `artifact OK`.

- [ ] **Step 4: Manual in-browser verification**

No DOM test harness exists in this repo, so verify by hand in Antimatter Dimensions (matching prior features' workflow):

1. Open AD, open DevTools console, paste the SNIPPET section of `ad-auto.js`.
2. Confirm the panel mounts and the header shows `[ 20 │ <number> ]`; the actual number climbs toward ~20 within a second.
3. Edit the desired-FPS field to `100`, press Enter/blur. Confirm: the field accepts it, and the actual readout climbs toward (but may sit below) 100 depending on browser load.
4. Edit to `5`; confirm the actual readout settles near 5.
5. Enter out-of-range values (`0`, `999`, blank) and confirm they clamp to `1`, `100`, and `20` respectively on commit.
6. Click into the FPS field and confirm the panel does NOT start dragging.
7. Reload the page, re-paste the snippet, confirm the desired FPS persisted (localStorage `__auto_settings_v1` carries `engineFps`).
8. Click `×` (stop) and confirm the loop stops cleanly with no console errors.

- [ ] **Step 5: Commit the rebuilt artifact**

```bash
git add ad-auto.js
git commit -m "build: regenerate ad-auto.js with engine FPS control"
```

---

## Self-Review Notes

- **Spec coverage:** §1 expose tick rate → Task 3; §2 header chip + bounds + drag guard → Task 4 (steps 1-4) + Task 1 (clamp); §3 trailing-1s measurement → Task 2 + Task 3 step 3; §4 display cadence (refreshGui) → Task 4 step 5; §5 persistence → Task 3 steps 1-2.
- **Deviation (surfaced):** spec mentioned a possible `countInWindow` helper and a "one decimal" readout. The chosen trailing-second **count** is integer-valued, so the plan uses `trimWindow` (count = `.length`) and displays an integer. Flagged at Task 4 step 5.
- **Type consistency:** `engineFps` (number), `fpsBuf` (number[]), `actualFps` (number), `mainIntervalId`, `startEngine()`, `mainTick()`, `clampFps()`, `trimWindow()` referenced consistently across tasks.
