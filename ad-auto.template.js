(() => {
  if (window.__auto) window.__auto.stop();

  const config = {
    maxAll:    { tab: 'AD',       label: 'Max All',    enabled: true,  period: 50,   amount: null },
    dimBoost:  { tab: 'AD',       label: 'Dim Boost',  enabled: true,  period: 50,   amount: null },
    galaxy:    { tab: 'AD',       label: 'Galaxy',     enabled: true,  period: 50,   amount: null },
    sacrifice: { tab: 'AD',       label: 'Sacrifice',  enabled: true,  period: 1500, amount: null },
    crunch:    { tab: 'AD',       label: 'Crunch',     enabled: true,  period: 50,   amount: null },
    buyMaxID:  { tab: 'Infinity', label: 'Max IDs',    enabled: false, period: 200,  amount: null },
    buyMaxRep: { tab: 'Infinity', label: 'Max Repl',   enabled: false, period: 200,  amount: null },
    eternity:  { tab: 'Infinity', label: 'Eternity',   enabled: false, period: 100,  amount: null },
    buyMaxTD:  { tab: 'Eternity', label: 'Max TDs',    enabled: false, period: 200,  amount: null },
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
    }
  }
  let lastIpMultCount = (stored && typeof stored.lastIpMultCount === 'number')
    ? stored.lastIpMultCount
    : null;
  let crunchReadyAt = null;
  let currentTab = null;
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 1,
        config: Object.fromEntries(Object.entries(config).map(([n, c]) => [n, {
          enabled: c.enabled, period: c.period, amount: c.amount,
        }])),
        ui: {
          activeTab: currentTab,
          collapsed: panel.classList.contains('collapsed'),
          left: panel.style.left || null,
          top:  panel.style.top  || null,
        },
        lastIpMultCount,
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
    buyMaxRep:       ['Replicanti.galaxies.buyMax', 'maxReplicantiGalaxies'],
    eternity:        ['eternity', 'requestEternity', 'manualRequestEternity'],
    buyMaxTD:        ['buyMaxTimeDimensions', 'TimeDimensions.buyMax'],
    dilatedEternity: ['startDilatedEternity', 'Dilation.requestStartDilation'],
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
  function dispatch(name) {
    for (const p of handlerPaths[name] || []) {
      const fn = resolveFn(p);
      if (typeof fn === 'function') return fn();
    }
    throw new Error(`[auto] no handler resolved for ${name}`);
  }

  const gates = {
    sacrifice: (cfg) => {
      if (cfg.amount == null) return true;
      const nb = window.Sacrifice && window.Sacrifice.nextBoost;
      if (nb == null) return true;
      return typeof nb.gte === 'function' ? nb.gte(cfg.amount) : Number(nb) >= cfg.amount;
    },
    crunch: (cfg) => gateCrunch(cfg.amount, () => resolveRaw(peakProbes.gip), window.Decimal),
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

  const stats = {}, lastRun = {};
  for (const k of Object.keys(config)) { stats[k] = { fires: 0, errs: 0 }; lastRun[k] = 0; }
  const peakProbes = {
    gip: ['gainedInfinityPoints'],
    tMs: ['player.records.thisInfinity.time'],
    ipMult: ['InfinityUpgrade.ipMult.purchaseCount'],
  };
  let peak = { rate: null, ip: null, lastTMs: null };
  const startedAt = performance.now();

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
      #${PID} button{background:#2a2a38;color:#e8e8ee;border:1px solid #444;
        border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;
        line-height:1;margin:0;font-family:inherit}
      #${PID} button:hover{background:#3a3a48}
      #${PID} .tabs{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}
      #${PID} .tabs button{padding:3px 9px}
      #${PID} .tabs button.active{background:#4a4a68;border-color:#666}
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
    const hasGate = name in gates;
    const amtType = name === 'crunch' ? 'text' : 'number';
    const amtAttrs = name === 'crunch' ? 'readonly' : 'min="0" step="1"';
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <input type="checkbox" data-name="${name}" data-prop="enabled" ${cfg.enabled ? 'checked' : ''}>
      <span class="name" title="${cfg.label}">${cfg.label}</span>
      <input type="number" data-name="${name}" data-prop="period" value="${cfg.period}" min="0" step="50" title="period (ms) between fires">
      <input type="${amtType}" data-name="${name}" data-prop="amount" value="${cfg.amount ?? ''}" ${amtAttrs} placeholder="${hasGate ? '—' : 'n/a'}" ${hasGate ? '' : 'disabled'} title="${hasGate ? 'minimum amount gate (blank = off)' : 'no gate defined for this action'}">
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
  const initialTab = stored?.ui?.activeTab && tabs.includes(stored.ui.activeTab)
    ? stored.ui.activeTab : tabs[0];
  setActiveTab(initialTab);

  panel.addEventListener('change', (e) => {
    const t = e.target;
    const { name, prop } = t.dataset;
    if (!name || !prop) return;
    if (t.type === 'checkbox') {
      config[name][prop] = t.checked;
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
    if (tab) { setActiveTab(tab); saveSettings(); return; }
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
    if (e.target.tagName === 'BUTTON') return;
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
  }

  const api = {
    config, stats, handlerPaths, gates,
    get peak() { return peak; },
    stop() {
      clearInterval(intervalId);
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
