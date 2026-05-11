# ad-auto Peak IP/min Implementation Plan (TDD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan uses TDD via Vitest for all pure logic. **Iron law:** every production line in `src/core.mjs` must follow a failing test you watched fail. Tests-after = delete and restart.

**Goal:** Unify the two installs in `ad-auto.js` (canonical source + URL-encoded bookmarklet derived from it) and add a Peak IP/min tracker whose displayed value is clickable to populate the crunch row's `amount` field, gated by `gainedInfinityPoints >= amount`.

**Architecture:** Pure logic (formatting, peak state machine, gate, encode/decode) lives in `src/core.mjs` as ESM exports. Vitest tests in `tests/core.test.mjs` drive it via TDD. A small build script `scripts/build.mjs` reads `ad-auto.template.js`, inlines `src/core.mjs` at a `// @inline:core` marker, URL-encodes the resulting IIFE body to produce the bookmarklet line, then writes `ad-auto.js`. The template + core + build script are the source of truth; `ad-auto.js` is the build artifact (still committed because the user pastes it into the browser).

**Tech Stack:** Vanilla JS (browser console runtime), ESM modules (Node 18+), Vitest, `localStorage`, AD globals (`Currency.*`, `player.*`, `gainedInfinityPoints`), break_infinity `Decimal`. No git in this directory (the working dir is not a repo).

**Working files:**

- `/home/michelek/Documents/github/ad-auto.js` (current monolithic file, becomes the build artifact)
- New: `/home/michelek/Documents/github/package.json`
- New: `/home/michelek/Documents/github/src/core.mjs`
- New: `/home/michelek/Documents/github/tests/core.test.mjs`
- New: `/home/michelek/Documents/github/ad-auto.template.js`
- New: `/home/michelek/Documents/github/scripts/build.mjs`

**Manual verification protocol** (where it appears): open AD in a browser, paste the freshly-built `ad-auto.js` IIFE into DevTools, confirm panel mounts and behavior. The user runs the game. The agent reports the build artifact and asks the user to confirm when in-game behavior is involved.

**No git commits** — the directory is not a repo. Tasks end at verification.

---

## File Structure

```
/home/michelek/Documents/github/
├── ad-auto.js                  # BUILD ARTIFACT (snippet + bookmarklet)
├── ad-auto.template.js         # SOURCE: human-written IIFE skeleton with // @inline:core marker
├── src/
│   └── core.mjs                # SOURCE: pure functions, ESM exports
├── tests/
│   └── core.test.mjs           # vitest tests
├── scripts/
│   └── build.mjs               # builds ad-auto.js from template + core
└── package.json                # vitest, scripts
```

`src/core.mjs` is plain JS using only `export` declarations. The build script strips those exports before inlining so the same source works as ESM-imported in tests and as IIFE-local consts in the snippet.

---

## Pure functions owned by `src/core.mjs`

These are the units that get TDD'd:

| Function | Signature | Purpose |
|---|---|---|
| `fmtExp(v)` | any → string | Format Decimal/number as `'1.23e+50'`; `null`/`undefined` → `'—'`. |
| `parseDecimalLike(s, DecimalCtor)` | (string, function?) → Decimal\|Number\|null | Parse user input string. Empty/whitespace → `null`. Invalid → `null`. Uses `new DecimalCtor(s)` when provided, else `Number(s)`. |
| `isRunReset(tMs, lastTMs)` | (number, number?) → boolean | True iff `lastTMs != null && tMs < lastTMs - 50`. |
| `computeRate(gip, tMs)` | (Decimal\|number, number) → Decimal\|number\|null | `gip / (tMs/60000)`. Returns `null` if `tMs < 1`. |
| `isHigherRate(rate, prevRate)` | (Decimal\|number, Decimal\|number?) → boolean | True iff `prevRate == null` or `rate > prevRate` (Decimal-aware). |
| `updatePeak(prev, sample)` | ({rate, ip, lastTMs}, {gip, tMs}) → {rate, ip, lastTMs} | Pure state-transition: applies run-reset, then peak update. |
| `gateCrunch(amount, gipResolver, DecimalCtor)` | (string\|null, () => Decimal\|number\|null, function?) → boolean | Auto-crunch gate. `amount` empty/null/invalid → `true`. |
| `encodeBookmarklet(iifeBody)` | string → string | Returns `"javascript:" + encodeURIComponent(iifeBody) + "void(0);"`. |
| `decodeBookmarklet(line)` | string → string | Reverses encodeBookmarklet. Strips leading `// ` if present. Throws on malformed input. |

The DOM, `setInterval` loops, `localStorage`, and the panel HTML stay in `ad-auto.template.js` and are not TDD'd (the user accepted "pure logic only").

---

### Task 1: Scaffold Vitest and project layout

**Files:**
- Create: `/home/michelek/Documents/github/package.json`
- Create: `/home/michelek/Documents/github/src/` (empty dir)
- Create: `/home/michelek/Documents/github/tests/` (empty dir)
- Create: `/home/michelek/Documents/github/scripts/` (empty dir)
- Create: `/home/michelek/Documents/github/.gitignore` (optional — `node_modules`)

**Background:** Need vitest installed and runnable before any TDD cycle can begin. Use Node's ESM mode (`"type": "module"`). No production dependencies.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ad-auto",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "description": "Antimatter Dimensions console auto-buy helper.",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "node scripts/build.mjs"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd /home/michelek/Documents/github && npm install
```

Expected: `node_modules/` and `package-lock.json` appear. No production deps; only vitest and its tree under devDependencies.

- [ ] **Step 3: Create source dirs and a `.gitignore`**

```bash
mkdir -p /home/michelek/Documents/github/src \
         /home/michelek/Documents/github/tests \
         /home/michelek/Documents/github/scripts
printf "node_modules/\n" > /home/michelek/Documents/github/.gitignore
```

- [ ] **Step 4: Smoke-test the runner**

Create a throwaway test:

```bash
cat > /home/michelek/Documents/github/tests/smoke.test.mjs <<'EOF'
import { test, expect } from 'vitest';
test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
EOF
```

Run:

```bash
cd /home/michelek/Documents/github && npm test
```

Expected: `1 passed`. Delete the smoke test before continuing:

```bash
rm /home/michelek/Documents/github/tests/smoke.test.mjs
```

---

### Task 2: TDD — `encodeBookmarklet` + `decodeBookmarklet`

**Files:**
- Create: `/home/michelek/Documents/github/src/core.mjs`
- Create: `/home/michelek/Documents/github/tests/core.test.mjs`

**Background:** Start with the encode/decode pair because (a) it's pure, (b) the build script in Task 3 will depend on `encodeBookmarklet`, (c) we'll use `decodeBookmarklet` to ingest the existing bookmarklet on disk.

**TDD cycle 1: encode produces a `javascript:`-prefixed URL.**

- [ ] **Step 1 (RED): write test**

Create `/home/michelek/Documents/github/tests/core.test.mjs`:

```js
import { test, expect, describe } from 'vitest';
import { encodeBookmarklet, decodeBookmarklet } from '../src/core.mjs';

describe('encodeBookmarklet', () => {
  test('wraps body with javascript: prefix and void(0); suffix', () => {
    expect(encodeBookmarklet('alert(1)')).toBe('javascript:alert(1)void(0);');
  });
});
```

- [ ] **Step 2 (RED verify): run test, expect failure**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: error like `Failed to load url ../src/core.mjs (resolved id ...). Does the file exist?` That's the right failure — the module is missing.

- [ ] **Step 3 (GREEN): minimal implementation**

Create `/home/michelek/Documents/github/src/core.mjs`:

```js
export function encodeBookmarklet(body) {
  return 'javascript:' + body + 'void(0);';
}
```

- [ ] **Step 4 (GREEN verify): test passes**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `1 passed`. (The named import of `decodeBookmarklet` is undefined but unused yet — should still pass. If Vitest complains about the missing named export, jump to the decodeBookmarklet cycle below first.)

**TDD cycle 2: encode percent-encodes special chars.**

- [ ] **Step 5 (RED): test**

Add inside the `describe('encodeBookmarklet', ...)` block:

```js
  test('percent-encodes spaces, newlines, and reserved chars', () => {
    expect(encodeBookmarklet('a b\n${x}')).toBe('javascript:a%20b%0A%24%7Bx%7Dvoid(0);');
  });
```

- [ ] **Step 6 (RED verify): run, expect failure**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `expected 'javascript:a b\n${x}void(0);' to be 'javascript:a%20b%0A...'`.

- [ ] **Step 7 (GREEN): use `encodeURIComponent`**

Update `encodeBookmarklet`:

```js
export function encodeBookmarklet(body) {
  return 'javascript:' + encodeURIComponent(body) + 'void(0);';
}
```

- [ ] **Step 8 (GREEN verify):**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `2 passed`.

**TDD cycle 3: decode reverses encode for round-trip.**

- [ ] **Step 9 (RED): test**

Add a new `describe('decodeBookmarklet', ...)` block after the encode block:

```js
describe('decodeBookmarklet', () => {
  test('round-trips with encodeBookmarklet for an arbitrary body', () => {
    const body = '(() => {\n  const x = `tpl ${1+1}`;\n  console.log(x);\n})();';
    const encoded = encodeBookmarklet(body);
    expect(decodeBookmarklet(encoded)).toBe(body);
  });
});
```

- [ ] **Step 10 (RED verify):**

Expected: `decodeBookmarklet is not a function`.

- [ ] **Step 11 (GREEN): implement**

Append to `src/core.mjs`:

```js
export function decodeBookmarklet(line) {
  let s = line.trim();
  if (s.startsWith('// ')) s = s.slice(3).trim();
  if (!s.startsWith('javascript:')) throw new Error('not a bookmarklet');
  s = s.slice('javascript:'.length);
  if (!s.endsWith('void(0);')) throw new Error('missing void(0); suffix');
  s = s.slice(0, -'void(0);'.length);
  return decodeURIComponent(s);
}
```

- [ ] **Step 12 (GREEN verify):**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `3 passed`.

**TDD cycle 4: decode handles `// `-prefixed comment lines (the form on disk).**

- [ ] **Step 13 (RED): test**

```js
  test('strips leading "// " comment prefix', () => {
    const body = 'console.log(1);';
    const encoded = encodeBookmarklet(body);
    expect(decodeBookmarklet('// ' + encoded)).toBe(body);
  });
```

- [ ] **Step 14 (RED verify):**

If the prior implementation already handled this (we added `if (s.startsWith('// '))`), the test passes immediately — but that means we're testing existing behavior. Two options: (a) leave the test, document that it confirms intentional support; (b) remove the prefix-strip from green code, re-run, watch RED, then re-add. The TDD-purist choice is (b). Do (b) for the demo.

Temporarily edit `decodeBookmarklet` to remove the prefix-strip:

```js
export function decodeBookmarklet(line) {
  let s = line.trim();
  if (!s.startsWith('javascript:')) throw new Error('not a bookmarklet');
  // ... rest unchanged
}
```

Re-run:

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: that test fails with `not a bookmarklet`.

- [ ] **Step 15 (GREEN): re-add prefix-strip**

Restore the `if (s.startsWith('// ')) s = s.slice(3).trim();` line.

- [ ] **Step 16 (GREEN verify):**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `4 passed`.

**TDD cycle 5: decode throws on garbage.**

- [ ] **Step 17 (RED): test**

```js
  test('throws on non-bookmarklet input', () => {
    expect(() => decodeBookmarklet('hello world')).toThrow(/not a bookmarklet/);
  });
```

- [ ] **Step 18 (RED verify, then GREEN verify):**

Already implemented — test passes immediately. Same purist concern: temporarily make `decodeBookmarklet` return `null` instead of throwing, re-run (RED), then restore throw (GREEN). Skip the dance if confidence is high; the test stands as a regression guard.

Final run:

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: `5 passed`.

---

### Task 3: Decode the on-disk bookmarklet → seed `ad-auto.template.js`

**Files:**
- Read: `/home/michelek/Documents/github/ad-auto.js` (line 305 `START:` payload)
- Create: `/home/michelek/Documents/github/ad-auto.template.js`

**Background:** Use `decodeBookmarklet` (now tested) to extract the readable IIFE body from the existing bookmarklet, then save it as the build template with a `// @inline:core` marker placed just before any logic that will move into `src/core.mjs`. No pure-core code lives in the template after this task — the marker is a single line, and the build script will replace it with the core source.

- [ ] **Step 1: Extract and decode**

Run a one-shot Node command that uses the tested decoder:

```bash
cd /home/michelek/Documents/github && node -e '
import("./src/core.mjs").then(({ decodeBookmarklet }) => {
  const fs = require("fs");
  const src = fs.readFileSync("ad-auto.js", "utf8");
  // Find the line starting with "// javascript:" in the BOOKMARKLET section.
  const line = src.split(/\r?\n/).find(l => l.startsWith("// javascript:"));
  if (!line) { console.error("no bookmarklet line"); process.exit(1); }
  const body = decodeBookmarklet(line);
  fs.writeFileSync("ad-auto.template.js", body);
  console.log("decoded length:", body.length);
});
'
```

Expected: prints a length, writes `ad-auto.template.js`.

- [ ] **Step 2: Sanity-check the template**

```bash
node --check /home/michelek/Documents/github/ad-auto.template.js && echo "syntax OK"
head -5 /home/michelek/Documents/github/ad-auto.template.js
tail -3 /home/michelek/Documents/github/ad-auto.template.js
```

Expected: starts with `(() => {`, ends with `})();`, parses cleanly.

- [ ] **Step 3: Insert the `// @inline:core` marker**

Edit `ad-auto.template.js`. Find the line `const STORAGE_KEY = '__auto_settings_v1';` (it's near the top of the IIFE). Insert immediately *before* that line:

```js
  // @inline:core
```

This marker is on its own line, indented two spaces to match the existing style. The build script will replace this single line with the contents of `src/core.mjs` (with `export ` stripped).

- [ ] **Step 4: Tell the user**

Report: "Template extracted. `ad-auto.template.js` is now the source-of-truth IIFE skeleton. Next task wires up the build."

---

### Task 4: Build script + first synthesis

**Files:**
- Create: `/home/michelek/Documents/github/scripts/build.mjs`
- Modify: `/home/michelek/Documents/github/ad-auto.js` (becomes a generated artifact)

**Background:** The build script reads `ad-auto.template.js`, replaces the `// @inline:core` marker with `src/core.mjs` (stripped of `export ` keywords), URL-encodes the resulting IIFE body for the bookmarklet, then writes the full `ad-auto.js` (preamble comment + SNIPPET section + BOOKMARKLET section). After this task, editing `ad-auto.js` directly is forbidden; the source-of-truth is template + core, and `npm run build` regenerates the artifact.

We TDD'd `encodeBookmarklet` — the build script imports it. We **do not** TDD the build script itself (it's an integration glue); we verify it by running it and inspecting the output.

- [ ] **Step 1: Write `scripts/build.mjs`**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeBookmarklet } from '../src/core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const template = fs.readFileSync(path.join(root, 'ad-auto.template.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'src/core.mjs'), 'utf8');

const coreInlined = coreSrc
  .replace(/^\s*export\s+function\s+/gm, 'function ')
  .replace(/^\s*export\s+/gm, '');

const MARKER = /^[ \t]*\/\/ @inline:core[ \t]*$/m;
if (!MARKER.test(template)) {
  console.error('build: marker `// @inline:core` not found in ad-auto.template.js');
  process.exit(1);
}
const snippetBody = template.replace(MARKER, coreInlined.trimEnd());

const bookmarklet = encodeBookmarklet(snippetBody);

const preamble = `// Antimatter Dimensions — console auto-buy helpers + GUI panel
// GENERATED FILE. Do not edit. Source: ad-auto.template.js + src/core.mjs. Rebuild with: npm run build.
//
// Two installs:
//   1. Paste the SNIPPET below into DevTools console.
//   2. Or use the BOOKMARKLET at the bottom of this file.


// ---------- SNIPPET (paste into console) ----------

`;

const bookmarkletSection = `


// ---------- BOOKMARKLET (paste as URL of a new bookmark) ----------
//
// START:
// ${bookmarklet}
//
// STOP:
// javascript:(()=>{if(window.__auto)window.__auto.stop();else console.log('nothing running');})();void(0);
//
// RESET:
// javascript:(()=>{try{localStorage.removeItem('__auto_settings_v1');console.log('cleared')}catch(e){console.warn(e)}})();void(0);
`;

const out = preamble + snippetBody + bookmarkletSection;
fs.writeFileSync(path.join(root, 'ad-auto.js'), out);
console.log(`built ad-auto.js (${out.length} bytes; bookmarklet ${bookmarklet.length} chars)`);
```

- [ ] **Step 2: Run the build**

```bash
cd /home/michelek/Documents/github && npm run build
```

Expected: prints `built ad-auto.js (...)`. The file is rewritten.

- [ ] **Step 3: Quick parse-check**

```bash
node --check /home/michelek/Documents/github/ad-auto.js
```

Expected: silent success (the bookmarklet `START:` line is a comment so the whole file parses).

- [ ] **Step 4: Manual smoke test (ask user)**

Tell the user: "Build is wired. Paste the SNIPPET section of `ad-auto.js` into the AD console. The panel should mount identically to before — same tabs, rows, persistence. No new features yet. Reply OK so we can move on to the peak-IP work."

Wait for confirmation.

---

### Task 5: TDD — `fmtExp` (formatter)

**Files:**
- Modify: `/home/michelek/Documents/github/src/core.mjs`
- Modify: `/home/michelek/Documents/github/tests/core.test.mjs`

**TDD cycle 1: null/undefined → em-dash.**

- [ ] **Step 1 (RED): test**

Add to `tests/core.test.mjs`:

```js
import { fmtExp } from '../src/core.mjs';

describe('fmtExp', () => {
  test('returns em-dash for null', () => {
    expect(fmtExp(null)).toBe('—');
  });
  test('returns em-dash for undefined', () => {
    expect(fmtExp(undefined)).toBe('—');
  });
});
```

Hoist the named import to the existing top-of-file import if you prefer one import line.

- [ ] **Step 2 (RED verify):**

```bash
cd /home/michelek/Documents/github && npx vitest run tests/core.test.mjs
```

Expected: failure — `fmtExp is not a function` (or `not exported`).

- [ ] **Step 3 (GREEN): minimal**

Append to `src/core.mjs`:

```js
export function fmtExp(v) {
  if (v == null) return '—';
  return '';
}
```

- [ ] **Step 4 (GREEN verify):** run, expect first two tests pass.

**TDD cycle 2: plain number formats as exponential with 2 decimals.**

- [ ] **Step 5 (RED): test**

```js
  test('formats a plain number in exponential with 2 decimals', () => {
    expect(fmtExp(1234)).toBe('1.23e+3');
  });
```

- [ ] **Step 6 (RED verify):** failure — empty string vs `'1.23e+3'`.

- [ ] **Step 7 (GREEN): use Number.toExponential**

```js
export function fmtExp(v) {
  if (v == null) return '—';
  return Number(v).toExponential(2);
}
```

- [ ] **Step 8 (GREEN verify):** 3 tests in `fmtExp` pass.

**TDD cycle 3: Decimal-like uses its own `toExponential`.**

- [ ] **Step 9 (RED): test**

```js
  test('delegates to value.toExponential when available (Decimal-like)', () => {
    const fake = { toExponential: (d) => `fake-${d}` };
    expect(fmtExp(fake)).toBe('fake-2');
  });
```

- [ ] **Step 10 (RED verify):** failure (current impl does `Number(v).toExponential(2)` and Number(fake) = NaN → `NaN`).

- [ ] **Step 11 (GREEN): branch on method presence**

```js
export function fmtExp(v) {
  if (v == null) return '—';
  if (typeof v?.toExponential === 'function') {
    try { return v.toExponential(2); } catch { /* fall through */ }
  }
  return Number(v).toExponential(2);
}
```

- [ ] **Step 12 (GREEN verify):** 4 tests pass.

**TDD cycle 4: non-finite numbers stay readable.**

- [ ] **Step 13 (RED): test**

```js
  test('stringifies non-finite numbers without crashing', () => {
    expect(fmtExp(Infinity)).toBe('Infinity');
    expect(fmtExp(NaN)).toBe('NaN');
  });
```

- [ ] **Step 14 (RED verify):** depending on the engine `Number(Infinity).toExponential(2)` returns `'Infinity'` — passes for Infinity but `NaN.toExponential(2)` returns `'NaN'` so both already pass. Tests-pass-immediately is the same purist concern. To force a RED, temporarily remove `if (v == null) return '—';` and pass `null` — skip that; this case is documentation-of-behavior, leave as-is.

- [ ] **Step 15 (GREEN verify):** all `fmtExp` tests pass.

---

### Task 6: TDD — `parseDecimalLike`, `isRunReset`, `computeRate`, `isHigherRate`

**Files:**
- Modify: `/home/michelek/Documents/github/src/core.mjs`
- Modify: `/home/michelek/Documents/github/tests/core.test.mjs`

Each function gets its own `describe` block. Each TDD cycle below is RED → verify → GREEN → verify.

**`isRunReset`:**

- [ ] **Cycle: returns false when prev is null/undefined**

RED test:
```js
import { isRunReset } from '../src/core.mjs';
describe('isRunReset', () => {
  test('false when lastTMs is null', () => {
    expect(isRunReset(500, null)).toBe(false);
  });
  test('false when lastTMs is undefined', () => {
    expect(isRunReset(500, undefined)).toBe(false);
  });
});
```

GREEN:
```js
export function isRunReset(tMs, lastTMs) {
  if (lastTMs == null) return false;
  return false;
}
```

Verify (`npx vitest run tests/core.test.mjs`): pass.

- [ ] **Cycle: true when current << previous**

RED test:
```js
  test('true when tMs is sharply less than lastTMs', () => {
    expect(isRunReset(0, 9000)).toBe(true);
  });
```
Run: fails.

GREEN: `return tMs < lastTMs - 50;`

- [ ] **Cycle: false within slop window**

RED:
```js
  test('false when within 50ms slop', () => {
    expect(isRunReset(9000, 9020)).toBe(false);   // 20ms backwards, still in slop
    expect(isRunReset(9000, 9049)).toBe(false);   // 49ms, still in slop
  });
  test('true exactly outside slop', () => {
    expect(isRunReset(9000, 9051)).toBe(true);
  });
```
Run: first two pass already (the `<` makes them strict). Third: with `lastTMs - 50 = 9001`, `9000 < 9001` → true. Pass. All green.

**`computeRate`:**

- [ ] **Cycle: returns null when tMs < 1**

RED:
```js
import { computeRate } from '../src/core.mjs';
describe('computeRate', () => {
  test('returns null when tMs < 1', () => {
    expect(computeRate(100, 0)).toBe(null);
    expect(computeRate(100, 0.5)).toBe(null);
  });
});
```
Run: fails (`computeRate is not a function`).

GREEN:
```js
export function computeRate(gip, tMs) {
  if (tMs < 1) return null;
  return null;
}
```
Verify: passes.

- [ ] **Cycle: divides gip by minutes for plain numbers**

RED:
```js
  test('rate = gip / (tMs/60000) for plain number gip', () => {
    expect(computeRate(60, 60000)).toBe(60);     // 60 IP in 1 minute → 60/min
    expect(computeRate(120, 60000)).toBe(120);
    expect(computeRate(60, 30000)).toBe(120);    // 60 IP in 30s → 120/min
  });
```
Run: fails (currently returns null).

GREEN:
```js
export function computeRate(gip, tMs) {
  if (tMs < 1) return null;
  const minutes = tMs / 60000;
  if (typeof gip?.div === 'function') return gip.div(minutes);
  return Number(gip) / minutes;
}
```
Verify: passes.

- [ ] **Cycle: uses Decimal.div when available**

RED:
```js
  test('delegates to gip.div when present (Decimal-like)', () => {
    const fake = { div: (m) => `div-by-${m}` };
    expect(computeRate(fake, 60000)).toBe('div-by-1');
  });
```
Run: already passes due to the branch added in previous cycle. Same purist note — leave as documentation.

**`isHigherRate`:**

- [ ] **Cycle: prev null → always higher**

RED:
```js
import { isHigherRate } from '../src/core.mjs';
describe('isHigherRate', () => {
  test('true when prev is null', () => {
    expect(isHigherRate(1, null)).toBe(true);
    expect(isHigherRate(0, null)).toBe(true);
  });
});
```
Run: fails.

GREEN:
```js
export function isHigherRate(rate, prev) {
  if (prev == null) return true;
  return false;
}
```
Verify: passes.

- [ ] **Cycle: plain numbers compare**

RED:
```js
  test('plain-number comparison', () => {
    expect(isHigherRate(5, 4)).toBe(true);
    expect(isHigherRate(4, 5)).toBe(false);
    expect(isHigherRate(5, 5)).toBe(false);
  });
```
Run: fails (always false now).

GREEN:
```js
export function isHigherRate(rate, prev) {
  if (prev == null) return true;
  if (typeof rate?.gt === 'function') return rate.gt(prev);
  return Number(rate) > Number(prev);
}
```
Verify: passes.

- [ ] **Cycle: Decimal-like uses `.gt`**

RED:
```js
  test('delegates to rate.gt when present', () => {
    const fake = { gt: (p) => p === 'lower' };
    expect(isHigherRate(fake, 'lower')).toBe(true);
    expect(isHigherRate(fake, 'higher')).toBe(false);
  });
```
Run: passes (already covered by the branch). Same note.

**`parseDecimalLike`:**

- [ ] **Cycle: empty/whitespace → null**

RED:
```js
import { parseDecimalLike } from '../src/core.mjs';
describe('parseDecimalLike', () => {
  test('returns null for empty or whitespace input', () => {
    expect(parseDecimalLike('')).toBe(null);
    expect(parseDecimalLike('   ')).toBe(null);
    expect(parseDecimalLike(null)).toBe(null);
    expect(parseDecimalLike(undefined)).toBe(null);
  });
});
```
Run: fails (`parseDecimalLike is not a function`).

GREEN:
```js
export function parseDecimalLike(s, DecimalCtor) {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (trimmed === '') return null;
  return null;
}
```
Verify: passes.

- [ ] **Cycle: plain number string → Number**

RED:
```js
  test('returns Number for a numeric string when no DecimalCtor', () => {
    expect(parseDecimalLike('1234')).toBe(1234);
    expect(parseDecimalLike(' 5.5 ')).toBe(5.5);
  });
```
Run: fails.

GREEN:
```js
export function parseDecimalLike(s, DecimalCtor) {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (trimmed === '') return null;
  if (typeof DecimalCtor === 'function') {
    try { return new DecimalCtor(trimmed); } catch { return null; }
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}
```
Verify: passes.

- [ ] **Cycle: invalid string → null**

RED:
```js
  test('returns null for unparseable strings', () => {
    expect(parseDecimalLike('abc')).toBe(null);
    expect(parseDecimalLike('1e')).toBe(null);
  });
```
Run: `Number('abc')` = NaN → already returns null via the Number.isFinite guard. Tests pass. Same note about tests-pass-immediately.

- [ ] **Cycle: with DecimalCtor it builds a Decimal**

RED:
```js
  test('uses DecimalCtor when provided', () => {
    class FakeDecimal {
      constructor(s) { this.s = s; }
    }
    const out = parseDecimalLike('1.5e500', FakeDecimal);
    expect(out).toBeInstanceOf(FakeDecimal);
    expect(out.s).toBe('1.5e500');
  });
  test('returns null if DecimalCtor throws', () => {
    class Throwing { constructor() { throw new Error('boom'); } }
    expect(parseDecimalLike('anything', Throwing)).toBe(null);
  });
```
Run: passes (branch already there).

Final: run `npx vitest run tests/core.test.mjs` — all tests across `encode/decode`, `fmtExp`, `isRunReset`, `computeRate`, `isHigherRate`, `parseDecimalLike` green.

---

### Task 7: TDD — `updatePeak` (the state machine)

**Files:**
- Modify: `/home/michelek/Documents/github/src/core.mjs`
- Modify: `/home/michelek/Documents/github/tests/core.test.mjs`

**Background:** `updatePeak` composes `isRunReset`, `computeRate`, `isHigherRate`. Input: `prev = { rate, ip, lastTMs }`, `sample = { gip, tMs }`. Output: new `{ rate, ip, lastTMs }`. Pure — no side effects.

State table the tests will pin down:

| Case | prev | sample | expected next |
|---|---|---|---|
| First valid sample, no peak yet | `{rate:null, ip:null, lastTMs:null}` | `{gip:60, tMs:60000}` | `{rate:60, ip:60, lastTMs:60000}` |
| Higher rate replaces peak | `{rate:30, ip:30, lastTMs:60000}` | `{gip:120, tMs:60000}` | `{rate:120, ip:120, lastTMs:60000}` |
| Lower rate keeps peak | `{rate:60, ip:60, lastTMs:60000}` | `{gip:30, tMs:60000}` | `{rate:60, ip:60, lastTMs:60000}` |
| Equal rate keeps peak | `{rate:60, ip:60, lastTMs:60000}` | `{gip:60, tMs:60000}` | unchanged |
| Run-reset clears peak; new sample establishes | `{rate:60, ip:60, lastTMs:9000}` | `{gip:5, tMs:1000}` | `{rate:300, ip:5, lastTMs:1000}` |
| Run-reset with tMs<1 clears peak, no new rate | `{rate:60, ip:60, lastTMs:9000}` | `{gip:5, tMs:0}` | `{rate:null, ip:null, lastTMs:0}` |
| gip null | `{rate:60, ip:60, lastTMs:5000}` | `{gip:null, tMs:6000}` | `{rate:60, ip:60, lastTMs:6000}` |
| tMs null | `{rate:60, ip:60, lastTMs:5000}` | `{gip:5, tMs:null}` | unchanged |
| tMs < 1, no reset | `{rate:60, ip:60, lastTMs:0}` | `{gip:5, tMs:0}` | unchanged except `lastTMs:0` |

Do one TDD cycle per row. Each cycle is RED → verify-fail → GREEN → verify-pass. Below shows three indicative cycles in full; do the rest by the same pattern.

**Cycle A: first sample establishes peak.**

- [ ] **RED:**

```js
import { updatePeak } from '../src/core.mjs';
describe('updatePeak', () => {
  test('first valid sample establishes the peak', () => {
    const next = updatePeak(
      { rate: null, ip: null, lastTMs: null },
      { gip: 60, tMs: 60000 }
    );
    expect(next.rate).toBe(60);
    expect(next.ip).toBe(60);
    expect(next.lastTMs).toBe(60000);
  });
});
```

- [ ] **RED verify:** `updatePeak is not a function`.

- [ ] **GREEN: minimal**

```js
export function updatePeak(prev, sample) {
  return {
    rate: sample.gip,
    ip: sample.gip,
    lastTMs: sample.tMs,
  };
}
```

- [ ] **GREEN verify:** passes.

**Cycle B: higher rate replaces peak.**

- [ ] **RED:**

```js
  test('higher rate replaces the previous peak', () => {
    const next = updatePeak(
      { rate: 30, ip: 30, lastTMs: 60000 },
      { gip: 120, tMs: 60000 }
    );
    expect(next).toEqual({ rate: 120, ip: 120, lastTMs: 60000 });
  });
```

- [ ] **RED verify:** passes immediately (current minimal impl always overwrites). Force a temporary RED by making the green impl `return prev;` — verify fails — then restore. Or skip the dance: the lower-rate test below will force the fix.

**Cycle C: lower rate keeps the peak (this is the cycle that breaks the trivial impl).**

- [ ] **RED:**

```js
  test('lower rate does not replace the peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 60000 },
      { gip: 30, tMs: 60000 }
    );
    expect(next.rate).toBe(60);
    expect(next.ip).toBe(60);
    expect(next.lastTMs).toBe(60000);
  });
```

- [ ] **RED verify:** fails — current code always overwrites with `30`.

- [ ] **GREEN: introduce real logic using the already-tested helpers**

Rewrite `updatePeak`:

```js
import { isRunReset as _isRunReset } from './core.mjs';
// (intra-module: just call the local functions; no import needed if same file)
export function updatePeak(prev, sample) {
  let { rate: peakRate, ip: peakIp, lastTMs } = prev;
  const { gip, tMs } = sample;

  if (tMs == null) return prev;

  if (isRunReset(tMs, lastTMs)) {
    peakRate = null;
    peakIp = null;
  }
  lastTMs = tMs;

  if (gip == null) return { rate: peakRate, ip: peakIp, lastTMs };

  const rate = computeRate(gip, tMs);
  if (rate == null) return { rate: peakRate, ip: peakIp, lastTMs };

  if (isHigherRate(rate, peakRate)) {
    return { rate, ip: gip, lastTMs };
  }
  return { rate: peakRate, ip: peakIp, lastTMs };
}
```

- [ ] **GREEN verify:** previous cycles still green, this one green.

**Cycles D-I:** add the remaining tests from the state table above, one at a time, watch each fail (if any do — the composed implementation should already cover them) and adjust as needed.

- [ ] **Equal rate keeps peak**

```js
  test('equal rate keeps the peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 60000 },
      { gip: 60, tMs: 60000 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 60000 });
  });
```

- [ ] **Run-reset clears peak and establishes new one**

```js
  test('run reset clears peak then applies the new sample', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 1000 }
    );
    // rate = 5 / (1000/60000) = 300
    expect(next.rate).toBe(300);
    expect(next.ip).toBe(5);
    expect(next.lastTMs).toBe(1000);
  });
```

- [ ] **Run-reset with tMs<1**

```js
  test('run reset with tMs<1 clears peak and leaves rate null', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 9000 },
      { gip: 5, tMs: 0 }
    );
    expect(next.rate).toBe(null);
    expect(next.ip).toBe(null);
    expect(next.lastTMs).toBe(0);
  });
```

- [ ] **gip null**

```js
  test('null gip only updates lastTMs', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 5000 },
      { gip: null, tMs: 6000 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 6000 });
  });
```

- [ ] **tMs null**

```js
  test('null tMs returns prev unchanged', () => {
    const prev = { rate: 60, ip: 60, lastTMs: 5000 };
    expect(updatePeak(prev, { gip: 5, tMs: null })).toEqual(prev);
  });
```

- [ ] **tMs<1, no run-reset**

```js
  test('tMs<1 without reset updates lastTMs but not peak', () => {
    const next = updatePeak(
      { rate: 60, ip: 60, lastTMs: 0 },
      { gip: 5, tMs: 0 }
    );
    expect(next).toEqual({ rate: 60, ip: 60, lastTMs: 0 });
  });
```

After each, run `npx vitest run tests/core.test.mjs` and confirm green. Refactor the implementation only with all tests green.

---

### Task 8: TDD — `gateCrunch`

**Files:**
- Modify: `/home/michelek/Documents/github/src/core.mjs`
- Modify: `/home/michelek/Documents/github/tests/core.test.mjs`

**Background:** `gateCrunch(amount, gipResolver, DecimalCtor)` returns true (fire) or false (block). Inputs:
- `amount`: string from the user's text input. `null`, `''`, or invalid → gate off (true).
- `gipResolver()`: callable returning current `gainedInfinityPoints` (Decimal or number) or `null`. If `null`, gate off (true).
- `DecimalCtor`: optional, for parsing the amount string.

**Cycle 1: amount null/empty → true.**

- [ ] **RED:**

```js
import { gateCrunch } from '../src/core.mjs';
describe('gateCrunch', () => {
  test('returns true when amount is null', () => {
    expect(gateCrunch(null, () => 9999)).toBe(true);
  });
  test('returns true when amount is empty string', () => {
    expect(gateCrunch('', () => 9999)).toBe(true);
    expect(gateCrunch('   ', () => 9999)).toBe(true);
  });
});
```

- [ ] **RED verify:** `gateCrunch is not a function`.

- [ ] **GREEN:**

```js
export function gateCrunch(amount, gipResolver, DecimalCtor) {
  if (amount == null) return true;
  if (String(amount).trim() === '') return true;
  return false;
}
```

Verify: 3 tests pass.

**Cycle 2: gip resolver returns null → true.**

- [ ] **RED:**

```js
  test('returns true when gip is unavailable', () => {
    expect(gateCrunch('100', () => null)).toBe(true);
  });
```

Run: fails (current returns false).

- [ ] **GREEN:**

```js
export function gateCrunch(amount, gipResolver, DecimalCtor) {
  if (amount == null) return true;
  const a = String(amount).trim();
  if (a === '') return true;
  const gip = gipResolver();
  if (gip == null) return true;
  return false;
}
```

Verify.

**Cycle 3: plain number gip ≥ amount → true.**

- [ ] **RED:**

```js
  test('plain number gip ≥ amount → fire', () => {
    expect(gateCrunch('100', () => 100)).toBe(true);
    expect(gateCrunch('100', () => 150)).toBe(true);
  });
```

Run: fails (currently returns false).

- [ ] **GREEN:**

```js
export function gateCrunch(amount, gipResolver, DecimalCtor) {
  if (amount == null) return true;
  const a = String(amount).trim();
  if (a === '') return true;
  const gip = gipResolver();
  if (gip == null) return true;
  const threshold = parseDecimalLike(a, DecimalCtor);
  if (threshold == null) return true;
  if (typeof gip.gte === 'function') return gip.gte(threshold);
  return Number(gip) >= Number(threshold);
}
```

Verify.

**Cycle 4: plain number gip < amount → false.**

- [ ] **RED:**

```js
  test('plain number gip < amount → block', () => {
    expect(gateCrunch('100', () => 50)).toBe(false);
  });
```

Run: passes (impl covers it). Same purist note.

**Cycle 5: Decimal-like gip uses `.gte`.**

- [ ] **RED:**

```js
  test('Decimal-like gip uses .gte for comparison', () => {
    const calls = [];
    const fakeGip = { gte: (t) => { calls.push(t); return true; } };
    expect(gateCrunch('100', () => fakeGip)).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(100);
  });
```

Run: passes (parseDecimalLike returns 100 (Number), gip.gte called with 100).

**Cycle 6: invalid amount → gate off (true).**

- [ ] **RED:**

```js
  test('invalid amount string disables the gate', () => {
    expect(gateCrunch('abc', () => 10)).toBe(true);
  });
```

Run: passes (parseDecimalLike returns null, branch returns true).

**Cycle 7: DecimalCtor parses huge strings.**

- [ ] **RED:**

```js
  test('uses DecimalCtor for amounts that overflow Number', () => {
    class FakeDecimal {
      constructor(s) { this.value = s; }
    }
    const fakeGip = {
      gte: function(t) {
        return t instanceof FakeDecimal && t.value === '1e500';
      },
    };
    expect(gateCrunch('1e500', () => fakeGip, FakeDecimal)).toBe(true);
  });
```

Run: passes (parseDecimalLike with FakeDecimal returns a FakeDecimal, gip.gte gets it).

Final: `npx vitest run tests/core.test.mjs` — all green.

---

### Task 9: Wire pure core into template (peak sampler, UI row, click, gate, text input)

**Files:**
- Modify: `/home/michelek/Documents/github/ad-auto.template.js`

**Background:** Integration code that uses the (now tested) core functions. The template is hand-written and not TDD'd. After this task, rebuilding produces the final `ad-auto.js`.

- [ ] **Step 1: Locate and verify the `@inline:core` marker**

```bash
grep -n "@inline:core" /home/michelek/Documents/github/ad-auto.template.js
```

Expected: one match, near the top of the IIFE.

- [ ] **Step 2: Add `peakProbes` and the peak state next to `stats`**

Find `const stats = {}, lastRun = {};` and add immediately after the existing `for (...) { stats[k] = ... }` loop:

```js
  const peakProbes = {
    gip: ['gainedInfinityPoints'],
    tMs: ['player.records.thisInfinity.time'],
  };
  let peak = { rate: null, ip: null, lastTMs: null };
```

- [ ] **Step 3: Add a `resolveRaw` helper next to `resolveFn`**

Find `function resolveFn(path) { ... }` and add immediately after:

```js
  function resolveRaw(paths) {
    for (const p of paths) {
      const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), window);
      if (v == null) continue;
      if (typeof v === 'function') {
        try { const r = v(); if (r != null) return r; } catch { /* try next */ }
        continue;
      }
      return v;
    }
    return null;
  }
```

- [ ] **Step 4: Add the peak sampler interval**

Find the existing `const intervalId = setInterval(...)` block (the action ticker). Immediately after that block, add:

```js
  const peakIntervalId = setInterval(() => {
    const tMs = resolveRaw(peakProbes.tMs);
    const gip = resolveRaw(peakProbes.gip);
    peak = updatePeak(peak, { gip, tMs });
  }, 250);
```

Note: `updatePeak` here refers to the inlined core function. Build script will paste it in.

- [ ] **Step 5: Insert the peak row into the AD pane**

Find the row-creation loop `for (const [name, cfg] of Object.entries(config)) {` and add at the top of the loop body:

```js
    if (name === 'crunch') {
      const pr = document.createElement('div');
      pr.className = 'row peak-row';
      pr.id = '__auto_peak_row';
      pr.title = 'click to copy IP-at-peak into crunch amount';
      pr.innerHTML = `
        <span></span>
        <span class="name">Peak IP/min</span>
        <span class="peak-rate">—</span>
        <span class="peak-ip">—</span>
        <span></span>
      `;
      paneEls[cfg.tab].appendChild(pr);
    }
```

- [ ] **Step 6: Add peak-row CSS to the panel `<style>` block**

In the `panel.innerHTML = `...`` template, find the `<style>` block. Append before `</style>`:

```css
      #${PID} .peak-row{cursor:pointer}
      #${PID} .peak-row:hover{background:rgba(255,255,255,0.04)}
      #${PID} .peak-row .peak-rate{text-align:center;font-variant-numeric:tabular-nums}
      #${PID} .peak-row .peak-ip{text-align:right;color:#888;font-size:10px;font-variant-numeric:tabular-nums}
      #${PID} .peak-row.flash{background:rgba(120,200,120,0.22)}
```

- [ ] **Step 7: Render peak values in `refreshGui`**

Find `function refreshGui() { ... }`. After the existing stats-rendering loop and before the `.uptime` update, add:

```js
    const peakRow = document.getElementById('__auto_peak_row');
    if (peakRow) {
      peakRow.querySelector('.peak-rate').textContent = fmtExp(peak.rate);
      peakRow.querySelector('.peak-ip').textContent =
        peak.ip == null ? '—' : '(at ' + fmtExp(peak.ip) + ')';
    }
```

- [ ] **Step 8: Click handler for the peak row**

Find `panel.addEventListener('click', (e) => { ... })`. At the top of the handler (before any other branch), add:

```js
    if (e.target.closest && e.target.closest('.peak-row')) {
      if (peak.ip == null) return;
      const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
      if (!input) return;
      const s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip);
      input.value = s;
      config.crunch.amount = s;
      saveSettings();
      const pr = document.getElementById('__auto_peak_row');
      if (pr) {
        pr.classList.add('flash');
        setTimeout(() => pr.classList.remove('flash'), 600);
      }
      return;
    }
```

- [ ] **Step 9: Switch crunch row's amount input to text**

Find the row-template line that emits the amount input. Before the row creation, branch the type:

```js
    const amtType = name === 'crunch' ? 'text' : 'number';
    const amtAttrs = name === 'crunch' ? '' : 'min="0" step="1"';
```

Then in the `row.innerHTML = ...` template, change:

```html
<input type="number" data-name="${name}" data-prop="amount" ...>
```

to:

```html
<input type="${amtType}" data-name="${name}" data-prop="amount" value="${cfg.amount ?? ''}" ${amtAttrs} placeholder="${hasGate ? '—' : 'n/a'}" ${hasGate ? '' : 'disabled'} title="${hasGate ? 'minimum amount gate (blank = off)' : 'no gate defined for this action'}">
```

- [ ] **Step 10: Update the `change` handler for the text input**

Find `panel.addEventListener('change', ...)`. Replace the existing body with:

```js
    const t = e.target;
    const { name, prop } = t.dataset;
    if (!name || !prop) return;
    if (t.type === 'checkbox') {
      config[name][prop] = t.checked;
    } else if (name === 'crunch' && prop === 'amount') {
      config[name][prop] = t.value.trim() === '' ? null : t.value.trim();
    } else if (t.type === 'number') {
      config[name][prop] = t.value === '' ? null : Number(t.value);
    } else if (t.type === 'text') {
      config[name][prop] = t.value.trim() === '' ? null : t.value.trim();
    }
    saveSettings();
```

- [ ] **Step 11: Update the saved-settings loader**

Find:

```js
if (saved.amount === null || typeof saved.amount === 'number') config[n].amount = saved.amount;
```

Replace with:

```js
if (saved.amount === null) config[n].amount = null;
else if (n === 'crunch' && typeof saved.amount === 'string') config[n].amount = saved.amount;
else if (typeof saved.amount === 'number') config[n].amount = saved.amount;
```

- [ ] **Step 12: Add `gates.crunch`**

Find `const gates = { sacrifice: (cfg) => { ... } };` and add a `crunch` entry:

```js
    crunch: (cfg) => gateCrunch(cfg.amount, () => resolveRaw(peakProbes.gip), window.Decimal),
```

- [ ] **Step 13: Clear `peakIntervalId` on stop**

In `api.stop()`, add next to `clearInterval(intervalId);`:

```js
      clearInterval(peakIntervalId);
```

- [ ] **Step 14: Expose `peak` on `window.__auto`**

In the `const api = { config, stats, handlerPaths, gates, ... }` object literal, add `peak,` so debugging can read it. (Note: that exports the current `peak` *value* once. To always reflect current state, expose it as a getter: `get peak() { return peak; }`.) Use the getter form.

- [ ] **Step 15: Rebuild**

```bash
cd /home/michelek/Documents/github && npm run build
```

Expected: prints `built ad-auto.js (...)`.

- [ ] **Step 16: Re-run tests (regression safety)**

```bash
cd /home/michelek/Documents/github && npm test
```

Expected: all green. Tests don't exercise the template, but they verify `src/core.mjs` is still intact.

- [ ] **Step 17: Manual smoke test (ask user)**

Tell the user: "Build complete with peak-IP feature integrated. Paste the SNIPPET section into AD. Verify:
1. New 'Peak IP/min' row above crunch in the AD tab.
2. Row updates within ~5 seconds of a fresh run.
3. Clicking the row pastes the IP-at-peak into the crunch amount text input and flashes green for ~600 ms.
4. With amount set high, auto-crunch's `hits` counter stops.
5. Clearing amount restores always-fire behavior.
Reply OK or report any visual/behavioral bugs."

---

### Task 10: Final round-trip + bookmarklet check

**Files:**
- Read-only: `/home/michelek/Documents/github/ad-auto.js`

- [ ] **Step 1: Decoded bookmarklet matches snippet IIFE**

```bash
cd /home/michelek/Documents/github && node -e '
import("./src/core.mjs").then(({ decodeBookmarklet }) => {
  const fs = require("fs");
  const file = fs.readFileSync("ad-auto.js", "utf8");
  const bookmarkletLine = file.split(/\r?\n/).find(l => l.startsWith("// javascript:"));
  if (!bookmarkletLine) { console.error("no bookmarklet line"); process.exit(1); }
  const decoded = decodeBookmarklet(bookmarkletLine);
  // Extract the SNIPPET IIFE: everything between the "SNIPPET" header and the "BOOKMARKLET" header.
  const start = file.indexOf("// ---------- SNIPPET");
  const end = file.indexOf("// ---------- BOOKMARKLET");
  const snippetSection = file.slice(start, end);
  // Strip section header + leading blank lines to get just the IIFE.
  const iife = snippetSection.replace(/^\/\/ ---------- SNIPPET[^\n]*\n+/, "").replace(/\n+$/, "");
  if (iife.trim() === decoded.trim()) {
    console.log("ROUND-TRIP OK: snippet IIFE matches decoded bookmarklet");
  } else {
    console.error("MISMATCH");
    require("fs").writeFileSync("/tmp/iife.txt", iife);
    require("fs").writeFileSync("/tmp/decoded.txt", decoded);
    console.error("see /tmp/iife.txt vs /tmp/decoded.txt; run: diff /tmp/iife.txt /tmp/decoded.txt");
    process.exit(1);
  }
});
'
```

Expected: `ROUND-TRIP OK`.

- [ ] **Step 2: Final user verification (ask user)**

Tell the user: "Drag the bookmarklet line (`// javascript:...`) from `ad-auto.js` into your browser's bookmarks bar (right-click → Add bookmark, paste as URL after stripping the leading `// `). Click it on the AD tab. Same panel and behavior as the snippet path. `localStorage.getItem('__auto_settings_v1')` should return the same JSON shape regardless of mount path. Reply OK to close out."

---

## Self-Review

**Spec coverage:**

- Snippet absorbs bookmarklet → Tasks 3, 4 (decode + build).
- Storage key unified on `__auto_settings_v1` → Task 3 (decoded body already uses it) and Task 4 build preamble.
- Sacrifice gate on `cfg.amount` (no `minRatio`) → Task 3 (decoded body uses `cfg.amount`).
- Peak IP/min metric (gainedIP / thisInfinity.time) → Tasks 6 (`computeRate`) + 7 (`updatePeak`) + 9 (sampler).
- Run-reset detection on `tMs < lastTMs - 50` → Task 6 (`isRunReset`) + Task 7 (`updatePeak`).
- Peak row above crunch in AD pane → Task 9 step 5.
- Whole-row click copies IP-at-peak into crunch amount → Task 9 step 8.
- 600 ms flash → Task 9 step 8.
- Reset to `—` on crunch → Task 7 (run-reset sets `peak.rate=null`) + Task 9 step 7 (renders `—` for null).
- `gates.crunch` comparing gainedIP to amount → Tasks 8 (`gateCrunch`) + 9 step 12.
- Crunch amount as text input → Task 9 step 9.
- Change-handler branch for crunch.amount → Task 9 step 10.
- localStorage load of string amount → Task 9 step 11.
- Bookmarklet regenerated as URL-encoded snippet body → Task 4 (build script uses `encodeBookmarklet`).
- Re-encode helper documented → Task 4 build script + `npm run build`.
- Round-trip verification → Task 10 step 1.

**Placeholder scan:** No "TBD", "TODO", "fill in", "similar to" remain. Every cycle has actual test code and actual implementation. The `// (rest unchanged)` markers in Task 9 reference identifiable, locatable existing code in the template — they describe what *not* to touch, not skipped work.

**Type/name consistency:**

- `peak`: `{ rate, ip, lastTMs }` — same shape in Tasks 7 (tests), 9 (template).
- `peakProbes`: defined Task 9 step 2, referenced steps 4 and 12.
- `updatePeak`, `gateCrunch`, `fmtExp`, `parseDecimalLike`, `isRunReset`, `computeRate`, `isHigherRate`, `encodeBookmarklet`, `decodeBookmarklet`: all defined in `src/core.mjs` across Tasks 2/5/6/7/8 and used inlined into the template by the build (Task 4) wherever called in Task 9.
- `resolveRaw`: defined Task 9 step 3, used steps 4 and 12.
- `peakIntervalId`: created Task 9 step 4, cleared step 13.
- `__auto_peak_row` DOM id and `.peak-row` class: defined Task 9 step 5, referenced steps 6/7/8.
- `saveSettings()`: belongs to the decoded body from Task 3 — confirmed present in `ad-auto.template.js`.

All consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-ad-auto-peak-ip.md`. Using **Subagent-Driven** execution as requested. I'll dispatch a fresh subagent per task, review between tasks, and report results back to you.

Starting with Task 1.
