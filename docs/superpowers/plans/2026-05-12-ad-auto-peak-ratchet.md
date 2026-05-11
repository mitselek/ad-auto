# ad-auto peak-ratchet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan does **not** use TDD — the change is inline in the template with no new pure logic, by deliberate design choice (see spec rationale).

**Goal:** Inside the existing `peakIntervalId` callback, ratchet `config.crunch.amount` up to the live `peak.ip` whenever peak.ip exceeds it (or the amount is empty), so the threshold tracks gain growth from all sources, not just IPMult purchases.

**Architecture:** One inline block added to `ad-auto.template.js` at the end of the existing 250 ms `peakIntervalId` callback, after the IPMult-double block. No new pure function in `src/core.mjs`, no new Vitest tests. Reuses `config`, `peak`, `panel`, `rowEls`, `saveSettings`, `window.Decimal`, and the existing `.row.flash` CSS rule generalized in the IPMult feature.

**Tech Stack:** Vanilla JS (browser IIFE runtime), break_infinity `Decimal` (already provided by AD), `localStorage`.

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js` (rebuilt by `npm run build`)

**Spec:** `docs/superpowers/specs/2026-05-12-ad-auto-peak-ratchet-design.md` (read before starting).

**Manual verification protocol:** open Antimatter Dimensions in a browser, paste the freshly-built `ad-auto.js` IIFE into DevTools, confirm the ratchet behavior against a live save.

**Commits:** Direct to `main` (per the established convention for this repo). Conventional-commit prefixes.

---

### Task 1: Add the peak-ratchet block to `ad-auto.template.js` and rebuild

**Files:**
- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Background:** The `peakIntervalId` callback currently has two blocks: the `updatePeak` call, then the IPMult-double block (added in the previous feature). Append a third block that decides whether `peak.ip` now exceeds `config.crunch.amount` and applies the same side effects (config write, DOM input write, flash, `saveSettings()`) as the IPMult block when it does.

- [ ] **Step 1: Add the ratchet block to the callback**

In `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`, locate the existing `peakIntervalId` callback. After the IPMult-double `if (result.count !== lastIpMultCount) { ... }` block and before the closing `}, 250);`, insert:

```js

    if (peak.ip != null) {
      const cur = config.crunch.amount;
      let shouldUpdate = false;
      if (cur == null || cur === '') {
        shouldUpdate = true;
      } else if (typeof window.Decimal === 'function') {
        try {
          const prev = new window.Decimal(cur);
          shouldUpdate = peak.ip.gt(prev);
        } catch {
          shouldUpdate = false;
        }
      }
      if (shouldUpdate) {
        const s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip);
        config.crunch.amount = s;
        const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
        if (input) input.value = s;
        const row = rowEls.crunch;
        if (row) {
          row.classList.add('flash');
          setTimeout(() => row.classList.remove('flash'), 600);
        }
        saveSettings();
      }
    }
```

Note: there is an intentional leading blank line so the block is visually separated from the IPMult block above it. Keep the same indentation level (4 spaces in from the `setInterval` body, matching the surrounding code).

- [ ] **Step 2: Rebuild `ad-auto.js`**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 3: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 53 tests pass (no new tests are added by this change).

- [ ] **Step 4: Sanity-grep the generated artifact**

The block introduces new strings that should appear at least twice in `ad-auto.js` (once in the snippet section, once URL-encoded in the bookmarklet line):

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c 'peak.ip.gt' ad-auto.js          # expect >= 1 (URL encoding may obscure the dotted form in the bookmarklet)
grep -c 'shouldUpdate' ad-auto.js        # expect >= 1
```

Expected: both counts at least 1. (The bookmarklet line URL-encodes the body, so dotted identifiers like `peak.ip.gt` may appear escaped. Grepping the snippet section alone is sufficient.)

- [ ] **Step 5: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
feat: ratchet crunch amount up to live peak.ip every tick

Inside the existing 250ms peak callback, after the IPMult block, copy
peak.ip into config.crunch.amount whenever peak.ip exceeds the current
amount (or the amount is empty). The threshold now tracks gain growth
from all sources, not just IPMult purchases. One-way ratchet: manual
edits below current peak.ip are auto-bumped back up on the next tick.
EOF
```

---

### Task 2: Manual verification handoff

**Files:** none modified.

**Background:** No new unit tests cover this change (inline-in-template by design). The behavior must be confirmed against a live AD save.

- [ ] **Step 1: Confirm the build artifact is current**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && git status
```

Expected: clean working tree, latest commit is the Task 1 commit.

- [ ] **Step 2: Hand off to the user**

Paste these instructions to the user verbatim:

> 1. Open Antimatter Dimensions with an in-progress save.
> 2. Open DevTools → Console.
> 3. Paste the SNIPPET section of the freshly built `ad-auto.js` into the console. Confirm the panel mounts and `auto running.` is logged.
> 4. On the AD tab, clear the crunch amount (delete the value so the field is empty). Confirm it persists as empty.
> 5. Within the first ~250 ms of `peak.ip` becoming non-null in a run, the crunch amount field should populate with the current peak.ip and the row should flash green.
> 6. Continue the run. As peak rate climbs, the crunch amount should update multiple times to track the rising peak.ip, with a green flash on each update.
> 7. Manually edit the crunch amount to a value clearly below current peak.ip (e.g., type `1` if peak is `1e60`). Within ~250 ms it should auto-bump back up to peak.ip with a flash.
> 8. Manually edit the crunch amount to a value clearly above current peak.ip (e.g., type `1e500`). It should stay at that value (no auto-bump) until peak.ip exceeds it.
> 9. Let auto-crunch fire (it will when gainedIP >= the ratcheted amount). After the crunch, peak resets internally, but the crunch amount stays at whatever was last ratcheted. As the new run produces a higher peak.ip, ratcheting resumes.
> 10. Buy an `InfinityUpgrade.ipMult` purchase mid-run. The amount should double immediately (existing IPMult feature), and then within the same or next tick, the ratchet block may or may not fire again depending on whether peak.ip exceeds the doubled amount. Either is correct.
> 11. Refresh the page, re-paste the snippet. The crunch amount should match what it was before the refresh.

- [ ] **Step 3: Capture deviations**

If something doesn't behave as expected, map the symptom to a likely cause:
- Amount doesn't auto-update at all → check that the ratchet block is inside the interval callback after the IPMult block, not outside.
- Amount goes DOWN on a new run → the `peak.ip.gt(prev)` guard is missing or wrong; ratchet should only fire when peak.ip > current amount.
- Flash doesn't appear → check the `.row.flash` CSS rule (generalized in the IPMult feature) is still present and the `rowEls.crunch` reference resolves.
- Manual high value gets overwritten → the comparison is wrong; should use `peak.ip.gt(prev)`, not `prev.gt(peak.ip)`.

- [ ] **Step 4: Mark feature complete**

Once the user confirms steps 4-11 of the verification script behave correctly, the feature is done. No final commit is needed — Task 1 already committed the artifact.

---

## Self-review notes

- **Spec coverage:** every spec acceptance bullet maps to a verification step:
  - Empty-at-boot adopt → step 4-5.
  - Monotonic ratchet on rising peak → step 6.
  - Manual ceiling preserved → step 8.
  - Manual low value bumped back up → step 7.
  - Cross-run continuity after crunch → step 9.
  - IPMult interaction → step 10.
  - Defensive (no `window.Decimal`) → not directly verifiable in AD; covered by code inspection.
  - Test suite still passes → Task 1 Step 3.
- **No placeholders.** All step contents are concrete commands or exact code blocks.
- **Type consistency:** `peak.ip` is used with `.gt(...)` and `.toString()` consistent with how `updatePeak` produces it and how the existing peak-row click handler stringifies it.
- **Commit hygiene:** single conventional commit with `feat:` prefix, file paths from the plan only.
