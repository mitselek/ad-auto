# ad-auto ratchet hysteresis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1.001× hysteresis to the auto-ratchet block in `ad-auto.template.js` so it only updates `config.crunch.amount` when peak.ip exceeds the current amount by at least 0.1%. Adopt path and explicit user-intent writes (IPMult double, peak-row click) remain unfiltered.

**Architecture:** Two-edit change in `ad-auto.template.js`: a named constant `RATCHET_MIN_MULT = 1.001` near the top of the IIFE, plus a single-line change in the ratchet block's Decimal compare from `peak.ip.gt(prev)` to `peak.ip.gt(prev.times(RATCHET_MIN_MULT))`. Then rebuild.

**Tech Stack:** Vanilla JS (browser IIFE runtime), break_infinity `Decimal`.

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-12-ad-auto-ratchet-hysteresis-design.md`.

**Commits:** Direct to `main`. Conventional-commit prefix.

---

## Task 1: Add hysteresis to the auto-ratchet + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

- [ ] **Step 1: Declare `RATCHET_MIN_MULT` near the top of the IIFE**

In `ad-auto.template.js`, find the line that declares `STORAGE_KEY`:

```js
  const STORAGE_KEY = '__auto_settings_v1';
```

Immediately AFTER that line, add:

```js
  const RATCHET_MIN_MULT = 1.001;
```

- [ ] **Step 2: Wrap `prev` with `.times(RATCHET_MIN_MULT)` in the ratchet compare**

In the `peakIntervalId` callback, locate the auto-ratchet block. Find:

```js
      } else if (typeof window.Decimal === 'function') {
        try {
          const prev = new window.Decimal(cur);
          shouldUpdate = peak.ip.gt(prev);
        } catch {
          shouldUpdate = false;
        }
      }
```

Change the `shouldUpdate = peak.ip.gt(prev);` line to:

```js
          shouldUpdate = peak.ip.gt(prev.times(RATCHET_MIN_MULT));
```

The rest of the block is unchanged.

- [ ] **Step 3: Rebuild ad-auto.js**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 4: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 54 tests pass (no new tests added).

- [ ] **Step 5: Sanity-grep the artifact**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'RATCHET_MIN_MULT' ad-auto.js
grep -c 'prev.times(RATCHET_MIN_MULT)' ad-auto.js
```

Expected: both ≥ 1 in the snippet section.

- [ ] **Step 6: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: 1.001x hysteresis on auto-ratchet of crunch amount

Ratchet now only updates config.crunch.amount when peak.ip exceeds
the current value by at least 0.1% (RATCHET_MIN_MULT). Cuts the flurry
of sub-percent rewrites early in a run. Adopt path (empty amount),
IPMult double, and peak-row click are unchanged.
EOF
```

---

## Self-review notes

- **Spec coverage:** every acceptance bullet maps to runtime behavior produced by the two edits.
- **No placeholders.** Both edits show the exact before/after text.
- **No tests required.** The change is inline-in-template, consistent with the rest of the ratchet feature. The math is simple Decimal multiplication and comparison; a unit test would only verify break_infinity's own behavior.
- **Manual verification:** rolled into the broader manual verification cycle the user runs after each ship.
