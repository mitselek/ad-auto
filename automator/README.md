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
