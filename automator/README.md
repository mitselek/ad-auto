# Automator script library

Scripts for the in-game **Automator** (unlocked at your first Reality). These take over
where the console helper's Dilation tab leaves off.

## Usage

1. In AD open the **Automator** tab, create a new script, switch the editor to text mode.
2. Paste a script from this directory.
3. Most scripts expect the **repeat** toggle ON (bottom of the Automator panel) so they
   loop; each file says so in its header.
4. Scripts reference **Time Study presets** by name (e.g. `load name TREE`). Save your
   own trees under those names in the Time Studies tab, or edit the `load` lines.
   Preset names are case-sensitive.

## Index

| Script | Purpose | Stage |
| --- | --- | --- |
| [`eternity-farm.txt`](./eternity-farm.txt) | Fast eternity/EP grind | Right after first Reality |
| [`infinity-grind.txt`](./infinity-grind.txt) | Banked infinities grind | Before realities that want banked ∞ |
| [`ec-clear.txt`](./ec-clear.txt) | Fully complete all 12 Eternity Challenges | Once EP supports EC trees |
| [`dilation-farm.txt`](./dilation-farm.txt) | Repeated dilated eternities for Tachyon Particles | After dilation unlock |
| [`reality-loop.txt`](./reality-loop.txt) | Full loop: tree → ECs → dilation → Reality | Standard RM/glyph farming |

## Bootstrapping a script from your play

`tools/action-recorder.js` records your **manual** play and emits a **first-draft
Automator script** — a literal transcript of the recordable actions, in the order they
happened. Use it to skip the blank page when authoring a new script for this library.

1. Mount the console panel, then paste the whole [`tools/action-recorder.js`](../tools/action-recorder.js)
   into the AD DevTools console. It starts recording silently.
2. Do your actions by hand — crunch, eternate, buy/load studies, unlock/enter an EC,
   start dilation, toggle the black hole, adjust autobuyers, etc.
3. `__actRec.copy()` copies the draft DSL to the clipboard (`__actRec.script()` returns
   it, `__actRec.reset()` clears, `__actRec.stop()` un-patches).

What it records: prestiges (`infinity`/`eternity`/`reality`), single time-study buys
(coalesced into one `studies purchase 11,21,…` line), preset loads, `unlock dilation`,
`unlock ec`/`start ec`, `start dilation`, `blackhole`, `storegametime`, `studies respec`,
and `auto infinity|eternity|reality` autobuyer settings. Runs of an identical line collapse
to one line + a `# xN` comment.

Caveats — it's a **draft**, not a runnable script:

- The Automator is **declarative**; the recorder can't infer intent. Add all
  `wait` / `until { }` / `while` / `if` / `pause` structure and loops **by hand**.
- Granular dimension buying and "max all" are **not** in the DSL — the autobuyers cover
  those in a real script; they aren't recorded.
- Hooks catch autobuyer- and Automator-driven actions too, not just your clicks — record
  with autobuyers off, or expect their firings to appear inline.

This is a manual authoring aid: not part of the built bookmarklet, not inlined.

## DSL cheat sheet

Verified against the game source (`src/core/automator/`).

```
# comment                    // comment
auto infinity <on|off|10s|x highest|1e100 ip>   # amounts need the currency suffix
auto eternity <on|off|0 ep>  auto reality <on|off|1 rm>
infinity|eternity|reality [nowait] [respec]   # nowait = don't stall if unavailable
studies [nowait] purchase <11,22,33 | antimatter|time|active|passive|idle|light|dark>
studies [nowait] load <id 1-6 | name PRESET>
studies respec
unlock [nowait] <ec7 | dilation>
start <ec7 | dilation>
blackhole <on|off>           storegametime <on|off|use>
notify "text"                pause <10s|5m>
wait <comparison | infinity|eternity|reality | blackhole off|bh1|bh2>
if <comparison> { ... }      while <comparison> { ... }
until <comparison | infinity|eternity|reality> { ... }
stop
```

Comparisons: `<currency> <op> <number|currency>` with ops `< <= > >=`.
Currencies: `am ip ep rm dt tp rg rep tt`, `pending ip|ep|tp|rm`, `pending glyph level`,
`pending completions`, `total completions`, `ec1..ec12 completions`, `infinities`,
`banked infinities`, `eternities`, `realities`, `total tt`, `filter score`,
`space theorems`. Durations: `ms`, `s`, `m`, `h`. Constants defined in the
Automator's constants panel can replace any number.
