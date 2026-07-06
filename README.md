# ad-auto

Antimatter Dimensions browser-console auto-buy helper with a draggable GUI panel.

## Install

### Snippet

Open AD in your browser, open DevTools, paste the entire SNIPPET section of [`ad-auto.js`](./ad-auto.js) into the console.

### Bookmarklet

Copy the long `// javascript:...` line under `// START:` in `ad-auto.js` (without the leading `//`), create a new bookmark, paste it as the URL. Click on the AD tab to mount the panel.

## Features

- Auto-fire actions:
  - **AD:** Max All, Dim Boost, Galaxy, Sacrifice, Crunch.
  - **Infinity:** Max IDs, Max Repl Upgrades, Repl Galaxy, Break Infinity, Max IPMult, Eternity.
  - **Eternity:** Max TDs, TT from AM, TT from IP, Max EP Mult, TT from EP.
  - **Dilation:** Dilated Eternity.
- Per-action enable, period, and amount gates.
- Sacrifice nextBoost threshold.
- Crunch fires only when `gainedInfinityPoints >= amount`.
- Break Infinity fires once, when replicanti has stayed at cap ("Infinite") with no replicanti-galaxy purchases for `amount` seconds (blank = 10). A galaxy buy or any dip below cap restarts the clock; once `player.break` is true it never fires again.
- Time-Theorem autobuyers per currency (AM / IP / EP). EP TT defers to Max EP Mult so the multiplier always gets first dibs on EP each tick (see the spec under `docs/superpowers/specs/`).
- Peak IP/min tracker (since last crunch). Click the displayed value to copy IP-at-peak into the crunch amount.
- Tab strip (AD / Infinity / Eternity / Dilation). Clicking the **already-active** tab disables/enables all mechanics on it (remembers your enabled subset and restores it on the next click); fully-paused tabs render dimmed. Draggable, collapsible panel. State persists in `localStorage` under `__auto_settings_v1`.

## Recorder (verifying behavior)

`tools/auto-recorder.js` is a standalone console tool that wraps the AD methods the TT / EP-Mult autobuyers call and logs only the invocations that actually changed state — with sequence numbers and before/after snapshots, so call order and effects are captured as ground truth rather than described. Paste the whole file into the console after mounting the panel, enable the autobuyers, then run `__autoRec.copy()`. See the header comment in the file for details.

## Develop

```
npm install
npm test            # vitest — pure-logic tests
npm run build       # regenerates ad-auto.js from ad-auto.template.js + src/core.mjs
```

`ad-auto.js` is a generated artifact. Edit `ad-auto.template.js` (browser-side skeleton) and `src/core.mjs` (pure logic), then `npm run build`. The build inlines `src/core.mjs` at the `// @inline:core` marker and URL-encodes the resulting IIFE for the bookmarklet line.

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for design and implementation history.
