# ad-auto dispatch preserves `this` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `dispatch` in `ad-auto.template.js` so methods like `InfinityUpgrade.ipMult.buyMax` are invoked on their natural receiver instead of detached.

**Architecture:** One-function change in `ad-auto.template.js`. Replace the body of `dispatch`. No new state; no other edits. Rebuild.

**Working files:**

- Modify: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`
- Generated: `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.js`

**Spec:** `docs/superpowers/specs/2026-05-13-ad-auto-dispatch-preserve-this-design.md`.

**Commits:** Direct to `main`.

---

## Task 1: Rewrite dispatch + rebuild

**Files:**

- Modify: `ad-auto.template.js`
- Generated: `ad-auto.js`

- [ ] **Step 1: Replace the body of `dispatch`**

In `/home/michelek/Documents/github/mitselek/ad-auto/ad-auto.template.js`, locate the existing `dispatch` function:

```js
  function dispatch(name) {
    for (const p of handlerPaths[name] || []) {
      const fn = resolveFn(p);
      if (typeof fn === 'function') return fn();
    }
    throw new Error(`[auto] no handler resolved for ${name}`);
  }
```

Replace the function body (preserve outer signature and braces) with:

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

Do not delete `resolveFn` — it stays in the file even though `dispatch` no longer calls it. `resolveRaw` is not modified.

- [ ] **Step 2: Rebuild ad-auto.js**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm run build
```

Expected: `built ad-auto.js (<N> bytes; bookmarklet <M> chars)`. No errors.

- [ ] **Step 3: Verify tests still pass**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto && npm test
```

Expected: 65 tests pass.

- [ ] **Step 4: Sanity-grep**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
grep -c "receiver\[fnName\]" ad-auto.js
grep -c "resolveFn" ad-auto.js
```

Expected: first ≥ 1 (new dispatch present), second ≥ 1 (resolveFn still defined, no longer referenced from dispatch).

- [ ] **Step 5: Commit**

```bash
cd /home/michelek/Documents/github/mitselek/ad-auto
git add ad-auto.template.js ad-auto.js
git commit -F /dev/stdin <<'EOF'
fix: dispatch preserves `this` binding for method handlers

Previously dispatch walked the dotted path with resolveFn and called the
detached leaf function, losing `this`. Methods like
InfinityUpgrade.ipMult.buyMax that depend on `this` (e.g. for this.cost
or this.purchaseCount) threw on every tick. Now dispatch splits the path
into receiver + method name and invokes receiver[method](), preserving
the binding. Plain window-level handlers (maxAll, sacrificeBtnClick,
etc.) behave identically (receiver === window).
EOF
```

---

## Task 2: Manual verification handoff

- [ ] **Step 1: Hand off verification script**

> 1. Re-paste the freshly built `ad-auto.js` snippet.
> 2. Switch to the Infinity tab. Enable `Max IPMult`. Confirm:
>    - `Hits` counter increments steadily (no `(N!)` red error suffix).
>    - `InfinityUpgrade.ipMult.purchaseCount` rises in the game when affordable.
>    - The crunch row's amount field flashes green and scales by 2^N as purchases land.
> 3. Enable `Max IDs`. Confirm its `Hits` counter increments without errors.
> 4. Other actions (Max All, Sacrifice, Crunch, etc.) continue to fire as before.

---

## Self-review notes

- **Spec coverage:** every acceptance bullet maps to the dispatch rewrite plus rebuild.
- **No placeholders.** The exact before/after dispatch body is shown.
- **Type consistency:** `parts` is string[], `fnName` is string, `receiver` is any object. The optional-chaining-style guard `receiver != null && typeof receiver[fnName] === 'function'` mirrors the prior guard.
- **No new tests.** The function depends on `window` globals; the existing test surface is pure logic. Manual verification is the gate.
