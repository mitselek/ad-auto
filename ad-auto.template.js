(() => {
  if (window.__auto) window.__auto.stop();

  const config = {
    maxAll:    { tab: 'AD',       label: 'Max All',    enabled: true,  period: 50,   amount: null },
    dimBoost:  { tab: 'AD',       label: 'Dim Boost',  enabled: true,  period: 50,   amount: null },
    galaxy:    { tab: 'AD',       label: 'Galaxy',     enabled: true,  period: 50,   amount: null },
    sacrifice: { tab: 'AD',       label: 'Sacrifice',  enabled: true,  period: 1500, amount: null },
    crunch:    { tab: 'AD',       label: 'Crunch',     enabled: true,  period: 50,   amount: null },
    buyMaxID:           { tab: 'Infinity', label: 'Max IDs',           enabled: false, period: 200,  amount: null },
    buyMaxReplUpgrades: { tab: 'Infinity', label: 'Max Repl Upgrades', enabled: false, period: 200,  amount: null },
    replGalaxy:         { tab: 'Infinity', label: 'Repl Galaxy',       enabled: false, period: 50,   amount: null },
    replCrunch:         { tab: 'Infinity', label: 'Repl Crunch',       enabled: false, period: 200,  amount: 10, eternityWhenStale: false },
    buyMaxIPMult:       { tab: 'Infinity', label: 'Max IPMult',        enabled: false, period: 200,  amount: null },
    eternity:           { tab: 'Infinity', label: 'Eternity',          enabled: false, period: 100,  amount: null },
    buyMaxTD:     { tab: 'Eternity', label: 'Max TDs',     enabled: false, period: 200, amount: null },
    amTT:         { tab: 'Eternity', label: 'TT from AM',  enabled: false, period: 200, amount: null },
    ipTT:         { tab: 'Eternity', label: 'TT from IP',  enabled: false, period: 200, amount: null },
    buyMaxEPMult: { tab: 'Eternity', label: 'Max EP Mult', enabled: false, period: 200, amount: null },
    epTT:         { tab: 'Eternity', label: 'TT from EP',  enabled: false, period: 200, amount: null },
    dilatedEternity: { tab: 'Dilation', label: 'Dilated Eternity', enabled: false, period: 100, amount: null },
  };

  // @inline:core
  const STORAGE_KEY = '__auto_settings_v1';
  const RATCHET_MIN_MULT = 1.001;
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  })();
  if (stored && stored.config) {
    for (const [n, saved] of Object.entries(stored.config)) {
      if (!config[n] || !saved) continue;
      if (typeof saved.enabled === 'boolean') config[n].enabled = saved.enabled;
      if (typeof saved.period === 'number') config[n].period = saved.period;
      if (saved.amount === null) config[n].amount = null;
      else if (n === 'crunch' && typeof saved.amount === 'string') config[n].amount = saved.amount;
      else if (typeof saved.amount === 'number') config[n].amount = saved.amount;
      if (typeof saved.eternityWhenStale === 'boolean' && 'eternityWhenStale' in config[n]) {
        config[n].eternityWhenStale = saved.eternityWhenStale;
      }
    }
  }
  let lastIpMultCount = (stored && typeof stored.lastIpMultCount === 'number')
    ? stored.lastIpMultCount
    : null;
  let engineFps = clampFps(stored && stored.engineFps);
  let fpsBuf = [];
  let actualFps = 0;
  let crunchReadyAt = null;
  let replStability = { since: null, galaxies: null };
  let warnedNoCanEternityProbe = false;
  let tickNow = 0;
  let currentTab = null;
  const tabEnabledMemory = {}; // tab -> names enabled before a "disable all" (for restore)
  Object.assign(tabEnabledMemory, sanitizeTabMemory(stored?.ui?.tabMemory, config));
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 1,
        config: Object.fromEntries(Object.entries(config).map(([n, c]) => [n, {
          enabled: c.enabled, period: c.period, amount: c.amount,
          eternityWhenStale: c.eternityWhenStale,
        }])),
        ui: {
          activeTab: currentTab,
          collapsed: panel.classList.contains('collapsed'),
          left: panel.style.left || null,
          top:  panel.style.top  || null,
          tabMemory: tabEnabledMemory,
        },
        lastIpMultCount,
        engineFps,
      }));
    } catch {}
  }

  const handlerPaths = {
    maxAll:          ['maxAll'],
    dimBoost:        ['manualRequestDimensionBoost'],
    galaxy:          ['manualRequestGalaxyReset'],
    sacrifice:       ['sacrificeBtnClick'],
    crunch:          ['manualBigCrunchResetRequest'],
    buyMaxID:        ['buyMaxInfinityDimensions', 'InfinityDimensions.buyMax'],
    replGalaxy:      ['replicantiGalaxy'],
    replCrunch:      ['manualBigCrunchResetRequest'],
    buyMaxIPMult:    ['InfinityUpgrade.ipMult.buyMax'],
    eternity:        ['eternity', 'requestEternity', 'manualRequestEternity'],
    buyMaxTD:        ['maxAllTimeDimensions', 'buyMaxTimeDimensions', 'TimeDimensions.buyMax'],
    dilatedEternity: ['startDilatedEternity', 'Dilation.requestStartDilation'],
  };

  const buyMaxTTWith = (type) => {
    const t = window.TimeTheoremPurchaseType && window.TimeTheoremPurchaseType[type];
    if (t == null || typeof t.purchase !== 'function') throw new Error(`[auto] TT ${type}: TimeTheoremPurchaseType.${type} missing`);
    t.purchase(true);
  };
  const customDispatchers = {
    amTT: () => buyMaxTTWith('am'),
    ipTT: () => buyMaxTTWith('ip'),
    epTT: () => buyMaxTTWith('ep'),
    buyMaxEPMult: () => {
      const u = window.EternityUpgrade && window.EternityUpgrade.epMult;
      if (u == null || typeof u.buyMax !== 'function') throw new Error('[auto] buyMaxEPMult: EternityUpgrade.epMult missing');
      u.buyMax(true);
    },
    buyMaxReplUpgrades: () => {
      const buyToMax = (target) => {
        if (target == null || typeof target.purchase !== 'function') return;
        let safety = 1000;
        while (target.canBeBought && safety-- > 0) target.purchase();
      };
      const RU = window.ReplicantiUpgrade;
      if (RU == null) throw new Error('[auto] buyMaxReplUpgrades: ReplicantiUpgrade missing');
      buyToMax(RU.chance);
      buyToMax(RU.interval);
      buyToMax(RU.galaxies);
    },
    // Companion checkbox behavior: when the pending crunch's IP gain wouldn't
    // exceed the IP we already hold, the run has gone stale — eternity instead.
    // If eternity isn't available (or a probe is missing), crunch as usual.
    replCrunch: () => {
      const canEternityRaw = resolveRaw(['Player.canEternity', 'player.canEternity']);
      if (config.replCrunch.eternityWhenStale && canEternityRaw == null && !warnedNoCanEternityProbe) {
        warnedNoCanEternityProbe = true;
        console.warn('[auto] replCrunch: eternity-when-stale is on but Player.canEternity was not found in this build; the row will always crunch');
      }
      if (config.replCrunch.eternityWhenStale && shouldEternityInstead({
        gained: resolveRaw(['gainedInfinityPoints']),
        held: resolveRaw(['Currency.infinityPoints.value', 'player.infinityPoints']),
        canEternity: !!canEternityRaw,
      })) {
        const e = dispatchPaths(handlerPaths.eternity);
        if (e.fired) {
          stats.eternity.fires++;
          console.info('[auto] replCrunch: stale run — fired eternity instead of crunch');
          return e.result;
        }
      }
      const r = dispatchPaths(handlerPaths.replCrunch);
      if (!r.fired) throw new Error('[auto] replCrunch: no crunch handler resolved');
      return r.result;
    },
  };

  function resolveFn(path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), window);
  }
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
  function dispatchPaths(paths) {
    for (const p of paths || []) {
      const parts = p.split('.');
      const fnName = parts.pop();
      const receiver = parts.reduce((o, k) => (o == null ? o : o[k]), window);
      if (receiver != null && typeof receiver[fnName] === 'function') {
        return { fired: true, result: receiver[fnName]() };
      }
    }
    return { fired: false };
  }
  function dispatch(name) {
    const custom = customDispatchers[name];
    if (typeof custom === 'function') return custom();
    const r = dispatchPaths(handlerPaths[name]);
    if (!r.fired) throw new Error(`[auto] no handler resolved for ${name}`);
    return r.result;
  }

  const gates = {
    sacrifice: (cfg) => {
      if (cfg.amount == null) return true;
      const nb = window.Sacrifice && window.Sacrifice.nextBoost;
      if (nb == null) return true;
      return typeof nb.gte === 'function' ? nb.gte(cfg.amount) : Number(nb) >= cfg.amount;
    },
    crunch: (cfg) => gateCrunch(cfg.amount, () => resolveRaw(peakProbes.gip), window.Decimal),
    // Big Crunch, held until replicanti has sat at cap ("Infinite") with no
    // repl-galaxy purchases for `amount` seconds — i.e. galaxy farming is done.
    // Replicanti persists through crunches, so once stable this keeps crunching
    // every `period` ms until disabled or something resets replicanti.
    replCrunch: (cfg) => {
      const amt = resolveRaw(['Currency.replicanti.value', 'Replicanti.amount', 'player.replicanti.amount']);
      const galaxies = resolveRaw(['player.replicanti.galaxies', 'Replicanti.galaxies.bought']);
      replStability = updateReplStability(replStability, { atCap: isReplAtCap(amt), galaxies, now: tickNow });
      return hasBeenStableFor({
        since: replStability.since,
        now: tickNow,
        stableMs: stableMsFromAmount(cfg.amount),
      });
    },
    // EP TT defers to Max EP Mult: it only fires on a tick where EP Mult also got
    // its turn (so EP Mult always has first dibs on EP). This intentionally couples
    // EP TT's cadence to EP Mult's — if EP Mult's period is set longer than EP TT's,
    // EP TT is throttled down to EP Mult's period. If EP Mult is disabled, EP TT runs freely.
    epTT: () => shouldFireEpTt({
      epMultEnabled: config.buyMaxEPMult.enabled,
      epMultHadTurnThisTick: lastAttempt.buyMaxEPMult === tickNow,
    }),
  };

  const STATE_PROBES = {
    antimatter:     ['Currency.antimatter.value', 'Currency.antimatter', 'player.antimatter'],
    infinityPower:  ['Currency.infinityPower.value', 'Currency.infinityPower'],
    ip:             ['Currency.infinityPoints.value', 'Currency.infinityPoints', 'player.infinityPoints'],
    ep:             ['Currency.eternityPoints.value', 'Currency.eternityPoints', 'player.eternityPoints'],
    infinities:     ['Currency.infinities.value', 'Currency.infinities', 'player.infinitied'],
    eternities:     ['Currency.eternities.value', 'Currency.eternities', 'player.eternities'],
    replicanti:     ['Currency.replicanti.value', 'Replicanti.amount', 'player.replicanti.amount'],
    dimBoosts:      ['DimBoost.purchasedBoosts', 'DimBoost.totalBoosts', 'player.dimensionBoosts'],
    galaxies:       ['player.galaxies'],
    replGalaxies:   ['player.replicanti.galaxies', 'Replicanti.galaxies.bought'],
    sacrificeMult:  ['Sacrifice.totalBoost'],
    bestInfTimeS:   ['player.records.bestInfinity.time', 'player.bestInfinityTime'],
    thisInfTimeS:   ['player.records.thisInfinity.time'],
    brokenInfinity: ['player.break'],
    ipOnCrunch:     ['gainedInfinityPoints'],
  };
  function probeState() {
    const safe = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), window);
    const fmt = (v) => {
      if (v == null) return null;
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'function') { try { return fmt(v()); } catch { return null; } }
      if (typeof v.toString === 'function') {
        const s = v.toString();
        return s === '[object Object]' ? null : s;
      }
      return null;
    };
    const out = {};
    for (const [k, paths] of Object.entries(STATE_PROBES)) {
      for (const p of paths) {
        const f = fmt(safe(p));
        if (f != null) { out[k] = f; break; }
      }
    }
    return out;
  }

  const stats = {}, lastRun = {}, lastAttempt = {};
  for (const k of Object.keys(config)) { stats[k] = { fires: 0, errs: 0 }; lastRun[k] = 0; lastAttempt[k] = 0; }
  const peakProbes = {
    gip: ['gainedInfinityPoints'],
    tMs: ['player.records.thisInfinity.time'],
    ipMult: ['InfinityUpgrade.ipMult.purchaseCount'],
  };
  let peak = { rate: null, ip: null, lastTMs: null };
  const startedAt = performance.now();

  function mainTick() {
    const now = performance.now();
    tickNow = now;
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
      lastAttempt[name] = now; // got its turn this tick (period + gate passed), even if dispatch throws
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

  const peakIntervalId = setInterval(() => {
    const tMs = resolveRaw(peakProbes.tMs);
    const gip = resolveRaw(peakProbes.gip);
    peak = updatePeak(peak, { gip, tMs });

    const ipMultCount = resolveRaw(peakProbes.ipMult);
    const result = updateIpMult(
      { count: lastIpMultCount, amount: config.crunch.amount },
      { count: ipMultCount, amount: config.crunch.amount },
      window.Decimal,
    );
    if (result.count !== lastIpMultCount) {
      lastIpMultCount = result.count;
      if (result.scaled) {
        let formatted = result.amount;
        if (typeof window.Decimal === 'function') {
          try { formatted = new window.Decimal(result.amount).toExponential(2); } catch {}
        }
        config.crunch.amount = formatted;
        const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
        if (input) input.value = formatted;
        const row = rowEls.crunch;
        if (row) {
          row.classList.add('flash');
          setTimeout(() => row.classList.remove('flash'), 600);
        }
      }
      saveSettings();
    }

    if (peak.ip != null) {
      const cur = config.crunch.amount;
      let shouldUpdate = false;
      if (cur == null || cur === '') {
        shouldUpdate = true;
      } else if (typeof window.Decimal === 'function') {
        try {
          const prev = new window.Decimal(cur);
          shouldUpdate = peak.ip.gt(prev.times(RATCHET_MIN_MULT));
        } catch {
          shouldUpdate = false;
        }
      }
      if (shouldUpdate) {
        const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
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
  }, 250);

  const PID = '__auto_panel';
  document.getElementById(PID)?.remove();

  const tabs = [];
  for (const cfg of Object.values(config)) if (!tabs.includes(cfg.tab)) tabs.push(cfg.tab);

  const panel = document.createElement('div');
  panel.id = PID;
  panel.innerHTML = `
    <style>
      #${PID},#${PID} *{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif}
      #${PID}{position:fixed;left:12px;bottom:12px;z-index:999999;
        font-size:12px;background:rgba(20,20,28,.94);color:#e8e8ee;
        border:1px solid #444;border-radius:8px;padding:8px 10px;
        min-width:380px;box-shadow:0 4px 16px rgba(0,0,0,.4);user-select:none}
      #${PID} .head{display:flex;align-items:center;gap:8px;cursor:move;
        padding-bottom:6px;border-bottom:1px solid #333;margin-bottom:6px}
      #${PID} .title{font-size:12px;font-weight:600;flex:1;color:#e8e8ee;line-height:1}
      #${PID} .engine{display:flex;align-items:center;gap:4px;font-size:11px;
        color:#888;font-variant-numeric:tabular-nums}
      #${PID} .engine .fps-in{width:38px;background:#1a1a24;color:#e8e8ee;
        border:1px solid #333;border-radius:3px;padding:1px 3px;font-size:11px;
        font-family:inherit;text-align:right;line-height:1.2}
      #${PID} .engine .fps-sep{color:#555}
      #${PID} .engine .fps-actual{min-width:22px;text-align:right;color:#9c9}
      #${PID} button{background:#2a2a38;color:#e8e8ee;border:1px solid #444;
        border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;
        line-height:1;margin:0;font-family:inherit}
      #${PID} button:hover{background:#3a3a48}
      #${PID} .tabs{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}
      #${PID} .tabs button{padding:3px 9px}
      #${PID} .tabs button.active{background:#4a4a68;border-color:#666}
      #${PID} .tabs button.all-paused{color:#888;font-style:italic;opacity:.7}
      #${PID} .pane{display:none}
      #${PID} .pane.active{display:block}
      #${PID} .row{display:grid;grid-template-columns:18px 1fr 56px 80px 56px;
        gap:8px;align-items:center;padding:3px 0}
      #${PID} .row.hdr{font-size:9px;color:#888;text-transform:uppercase;
        letter-spacing:.06em;padding:2px 0 4px;border-bottom:1px solid #2a2a32;margin-bottom:2px}
      #${PID} .row.hdr .lbl-time,#${PID} .row.hdr .lbl-amt{text-align:center}
      #${PID} .row.hdr .lbl-hits{text-align:right}
      #${PID} .name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PID} input[type=checkbox]{margin:0;cursor:pointer;width:14px;height:14px}
      #${PID} .name .companion{width:11px;height:11px;margin-left:5px;vertical-align:-1px;accent-color:#96c}
      #${PID} input[type=number],#${PID} input[type=text]{width:100%;background:#1a1a24;color:#e8e8ee;
        border:1px solid #333;border-radius:3px;padding:2px 4px;
        font-size:11px;font-family:inherit;text-align:right;line-height:1.2}
      #${PID} input[type=number]:disabled{opacity:.32;cursor:not-allowed}
      #${PID} input[readonly]{opacity:.85;cursor:default;background:#15151c;color:#cfcfd6}
      #${PID} .stats{font-variant-numeric:tabular-nums;color:#888;
        font-size:10px;text-align:right;line-height:1.2}
      #${PID} .stats.err{color:#e88}
      #${PID} .foot{display:flex;justify-content:space-between;margin-top:6px;
        padding-top:6px;border-top:1px solid #333;font-size:10px;color:#888}
      #${PID}.collapsed .body,#${PID}.collapsed .tabs,#${PID}.collapsed .foot{display:none}
      #${PID} .peak-row{cursor:pointer}
      #${PID} .peak-row:hover{background:rgba(255,255,255,0.04)}
      #${PID} .peak-row .peak-rate{font-variant-numeric:tabular-nums}
      #${PID} .peak-row .peak-ip{color:#888;font-size:10px;font-variant-numeric:tabular-nums}
      #${PID} .row.flash{background:rgba(120,200,120,0.22)}
      #${PID} .row.peak-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0}
    </style>
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
    <div class="tabs"></div>
    <div class="body"></div>
    <div class="foot"><span class="uptime">0s</span><span class="totals">0 fires</span></div>
  `;
  document.body.appendChild(panel);

  if (stored?.ui?.collapsed) panel.classList.add('collapsed');
  if (stored?.ui?.left) { panel.style.left = stored.ui.left; panel.style.right = 'auto'; }
  if (stored?.ui?.top)  { panel.style.top  = stored.ui.top;  panel.style.bottom = 'auto'; }

  const tabsEl = panel.querySelector('.tabs');
  const body = panel.querySelector('.body');
  const rowEls = {};
  const paneEls = {};

  for (const tab of tabs) {
    const tb = document.createElement('button');
    tb.textContent = tab;
    tb.dataset.tab = tab;
    tb.title = 'switch tab; click the active tab to disable/enable all its mechanics';
    tabsEl.appendChild(tb);

    const pane = document.createElement('div');
    pane.className = 'pane';
    pane.dataset.tab = tab;

    const hdr = document.createElement('div');
    hdr.className = 'row hdr';
    hdr.innerHTML = `<span></span><span></span><span class="lbl-time">time</span><span class="lbl-amt">amount</span><span class="lbl-hits">hits</span>`;
    pane.appendChild(hdr);

    body.appendChild(pane);
    paneEls[tab] = pane;
  }

  // actions whose gate reads cfg.amount — only these get a user-editable amount input
  const amountGated = new Set(['sacrifice', 'crunch', 'replCrunch']);
  const amountTitles = { replCrunch: 'seconds replicanti must stay Infinite before crunching (blank = 10)' };
  for (const [name, cfg] of Object.entries(config)) {
    if (name === 'crunch') {
      const pr = document.createElement('div');
      pr.className = 'row peak-row';
      pr.id = '__auto_peak_row';
      pr.title = 'click to copy IP-at-peak into crunch amount';
      pr.innerHTML = `
        <span class="name">Peak IP/min</span>
        <span class="peak-value"><span class="peak-rate">—</span> at <span class="peak-ip">—</span></span>
      `;
      paneEls[cfg.tab].appendChild(pr);
    }
    const hasAmountGate = amountGated.has(name);
    const amtType = name === 'crunch' ? 'text' : 'number';
    const amtAttrs = name === 'crunch' ? 'readonly' : 'min="0" step="1"';
    const companion = 'eternityWhenStale' in cfg
      ? `<input type="checkbox" class="companion" data-name="${name}" data-prop="eternityWhenStale" ${cfg.eternityWhenStale ? 'checked' : ''} title="eternity instead, when the crunch would gain no more IP than already held">`
      : '';
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <input type="checkbox" data-name="${name}" data-prop="enabled" ${cfg.enabled ? 'checked' : ''}>
      <span class="name" title="${cfg.label}">${cfg.label}${companion}</span>
      <input type="number" data-name="${name}" data-prop="period" value="${cfg.period}" min="0" step="50" title="period (ms) between fires">
      <input type="${amtType}" data-name="${name}" data-prop="amount" value="${cfg.amount ?? ''}" ${amtAttrs} placeholder="${hasAmountGate ? '—' : 'n/a'}" ${hasAmountGate ? '' : 'disabled'} title="${hasAmountGate ? (amountTitles[name] ?? 'minimum amount gate (blank = off)') : 'no amount gate for this action'}">
      <span class="stats">0</span>
    `;
    paneEls[cfg.tab].appendChild(row);
    rowEls[name] = row;
  }

  function setActiveTab(tab) {
    currentTab = tab;
    for (const btn of tabsEl.querySelectorAll('button')) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    }
    for (const [t, p] of Object.entries(paneEls)) {
      p.classList.toggle('active', t === tab);
    }
  }
  function refreshPausedTabs() {
    for (const btn of tabsEl.querySelectorAll('button')) {
      btn.classList.toggle('all-paused', isTabFullyPaused(config, btn.dataset.tab));
    }
  }
  const initialTab = stored?.ui?.activeTab && tabs.includes(stored.ui.activeTab)
    ? stored.ui.activeTab : tabs[0];
  setActiveTab(initialTab);
  refreshPausedTabs();

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
    if (t.type === 'checkbox') {
      config[name][prop] = t.checked;
      if (prop === 'enabled') {
        // a manual enable/disable invalidates the remembered subset for that tab
        delete tabEnabledMemory[config[name].tab];
        refreshPausedTabs();
      }
    } else if (t.type === 'number') {
      config[name][prop] = t.value === '' ? null : Number(t.value);
    }
    saveSettings();
  });

  panel.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.peak-row')) {
      if (peak.ip == null) return;
      const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
      if (!input) return;
      const s = (typeof peak.ip.toExponential === 'function') ? peak.ip.toExponential(2) : String(peak.ip);
      input.value = s;
      config.crunch.amount = s;
      saveSettings();
      const pr = e.target.closest('.peak-row');
      pr.classList.add('flash');
      setTimeout(() => pr.classList.remove('flash'), 600);
      return;
    }
    const tab = e.target.dataset?.tab;
    if (tab) {
      if (tab === currentTab) {
        const states = Object.entries(config)
          .filter(([, c]) => c.tab === tab)
          .map(([name, c]) => ({ name, enabled: c.enabled }));
        const res = toggleTabEnabled(states, tabEnabledMemory[tab]);
        for (const s of res.states) {
          config[s.name].enabled = s.enabled;
          const cb = rowEls[s.name]?.querySelector('input[data-prop="enabled"]');
          if (cb) cb.checked = s.enabled;
        }
        tabEnabledMemory[tab] = res.remembered;
        refreshPausedTabs();
      } else {
        setActiveTab(tab);
      }
      saveSettings();
      return;
    }
    const act = e.target.dataset?.act;
    if (act === 'stop') api.stop();
    else if (act === 'collapse') { panel.classList.toggle('collapsed'); saveSettings(); }
    else if (act === 'copy') copyState(e.target);
  });

  async function copyState(btn) {
    const data = {
      ts: new Date().toISOString(),
      state: probeState(),
      auto: {
        uptimeS: Math.floor((performance.now() - startedAt) / 1000),
        actions: Object.fromEntries(Object.entries(config).map(([n, c]) => [n, {
          enabled: c.enabled,
          period: c.period,
          amount: c.amount,
          ...(c.eternityWhenStale !== undefined ? { eternityWhenStale: c.eternityWhenStale } : {}),
          fires: stats[n].fires,
          errs: stats[n].errs,
        }])),
      },
    };
    const json = JSON.stringify(data, null, 2);
    const flash = (label, isErr) => {
      const orig = btn.textContent;
      btn.textContent = label;
      if (isErr) btn.style.color = '#e88';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1200);
    };
    try {
      await navigator.clipboard.writeText(json);
      flash('copied');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      ta.remove();
      flash(ok ? 'copied' : 'failed', !ok);
    }
  }

  const head = panel.querySelector('.head');
  let drag = null;
  head.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || (e.target.closest && e.target.closest('.engine'))) return;
    const r = panel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    panel.style.left = (e.clientX - drag.dx) + 'px';
    panel.style.top  = (e.clientY - drag.dy) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });
  window.addEventListener('mouseup', () => {
    if (drag) { drag = null; saveSettings(); }
  });

  let lastGui = 0;
  function refreshGui() {
    const now = performance.now();
    if (now - lastGui < 250) return;
    lastGui = now;
    for (const [name, s] of Object.entries(stats)) {
      const el = rowEls[name]?.querySelector('.stats');
      if (!el) continue;
      el.textContent = s.errs ? `${s.fires} (${s.errs}!)` : `${s.fires}`;
      el.classList.toggle('err', s.errs > 0);
    }
    const peakRow = document.getElementById('__auto_peak_row');
    if (peakRow) {
      peakRow.querySelector('.peak-rate').textContent = fmtExp(peak.rate);
      peakRow.querySelector('.peak-ip').textContent = fmtExp(peak.ip);
    }
    panel.querySelector('.uptime').textContent = Math.floor((now - startedAt) / 1000) + 's';
    const total = Object.values(stats).reduce((a, s) => a + s.fires, 0);
    panel.querySelector('.totals').textContent = total + ' fires';
    const fpsEl = panel.querySelector('.fps-actual');
    if (fpsEl) fpsEl.textContent = String(actualFps);
  }

  const api = {
    config, stats, handlerPaths, gates,
    get peak() { return peak; },
    stop() {
      clearInterval(mainIntervalId);
      clearInterval(peakIntervalId);
      panel.remove();
      delete window.__auto;
      console.log('auto stopped. stats:', stats);
    },
    status() {
      console.table(Object.entries(config).map(([name, c]) => ({
        name, tab: c.tab, enabled: c.enabled, period: c.period,
        amount: c.amount ?? '-', fires: stats[name].fires, errs: stats[name].errs,
      })));
    },
    resetSettings() {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      console.log('auto settings cleared. re-paste the snippet to apply defaults.');
    },
  };
  window.__auto = api;
  console.log('auto running. window.__auto.stop() to stop, window.__auto.status() for table.');
})();
