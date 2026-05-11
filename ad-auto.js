// Antimatter Dimensions — console auto-buy helpers + GUI panel
// GENERATED FILE. Do not edit. Source: ad-auto.template.js + src/core.mjs. Rebuild with: npm run build.
//
// Two installs:
//   1. Paste the SNIPPET below into DevTools console.
//   2. Or use the BOOKMARKLET at the bottom of this file.


// ---------- SNIPPET (paste into console) ----------

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

function encodeBookmarklet(body) {
  return 'javascript:' + encodeURIComponent(body) + 'void(0);';
}
function decodeBookmarklet(line) {
  let s = line.trim();
  if (s.startsWith('// ')) s = s.slice(3).trim();
  if (!s.startsWith('javascript:')) throw new Error('not a bookmarklet');
  s = s.slice('javascript:'.length);
  if (!s.endsWith('void(0);')) throw new Error('missing void(0); suffix');
  s = s.slice(0, -'void(0);'.length);
  return decodeURIComponent(s);
}
function fmtExp(v) {
  if (v == null) return '—';
  if (typeof v?.toExponential === 'function') {
    try { return v.toExponential(2); } catch { /* fall through */ }
  }
  return Number(v).toExponential(2);
}
function isRunReset(tMs, lastTMs) {
  if (lastTMs == null) return false;
  return tMs < lastTMs - 50;
}
function computeRate(gip, tMs) {
  if (tMs < 1) return null;
  const minutes = tMs / 60000;
  if (typeof gip?.div === 'function') return gip.div(minutes);
  return Number(gip) / minutes;
}
function isHigherRate(rate, prev) {
  if (prev == null) return true;
  if (typeof rate?.gt === 'function') return rate.gt(prev);
  return Number(rate) > Number(prev);
}
function updatePeak(prev, sample) {
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
function gateCrunch(amount, gipResolver, DecimalCtor) {
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
function parseDecimalLike(s, DecimalCtor) {
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
function updateIpMult(prev, sample, DecimalCtor) {
  if (sample == null || sample.count == null) {
    return { count: prev.count, amount: prev.amount, scaled: false };
  }
  if (prev.count == null || sample.count <= prev.count) {
    return { count: sample.count, amount: prev.amount, scaled: false };
  }
  const delta = sample.count - prev.count;
  const amount = sample.amount;
  if (amount == null || amount === '') {
    return { count: sample.count, amount, scaled: false };
  }
  if (typeof DecimalCtor !== 'function') {
    return { count: sample.count, amount, scaled: false };
  }
  let factor, base;
  try {
    base = new DecimalCtor(amount);
    factor = new DecimalCtor(2).pow(delta);
  } catch {
    return { count: sample.count, amount, scaled: false };
  }
  let newAmount;
  try {
    newAmount = base.times(factor).toString();
  } catch {
    return { count: sample.count, amount, scaled: false };
  }
  return { count: sample.count, amount: newAmount, scaled: true };
}
  const STORAGE_KEY = '__auto_settings_v1';
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
        config.crunch.amount = result.amount;
        const input = panel.querySelector('input[data-name="crunch"][data-prop="amount"]');
        if (input) input.value = result.amount;
        const row = rowEls.crunch;
        if (row) {
          row.classList.add('flash');
          setTimeout(() => row.classList.remove('flash'), 600);
        }
      }
      saveSettings();
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
        min-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.4);user-select:none}
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
      #${PID} .row{display:grid;grid-template-columns:18px 1fr 56px 56px 56px;
        gap:8px;align-items:center;padding:3px 0}
      #${PID} .row.hdr{font-size:9px;color:#888;text-transform:uppercase;
        letter-spacing:.06em;padding:2px 0 4px;border-bottom:1px solid #2a2a32;margin-bottom:2px}
      #${PID} .row.hdr .lbl-time,#${PID} .row.hdr .lbl-amt{text-align:center}
      #${PID} .row.hdr .lbl-hits{text-align:right}
      #${PID} .name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PID} input[type=checkbox]{margin:0;cursor:pointer;width:14px;height:14px}
      #${PID} input[type=number]{width:100%;background:#1a1a24;color:#e8e8ee;
        border:1px solid #333;border-radius:3px;padding:2px 4px;
        font-size:11px;font-family:inherit;text-align:right;line-height:1.2}
      #${PID} input[type=number]:disabled{opacity:.32;cursor:not-allowed}
      #${PID} .stats{font-variant-numeric:tabular-nums;color:#888;
        font-size:10px;text-align:right;line-height:1.2}
      #${PID} .stats.err{color:#e88}
      #${PID} .foot{display:flex;justify-content:space-between;margin-top:6px;
        padding-top:6px;border-top:1px solid #333;font-size:10px;color:#888}
      #${PID}.collapsed .body,#${PID}.collapsed .tabs,#${PID}.collapsed .foot{display:none}
      #${PID} .peak-row{cursor:pointer}
      #${PID} .peak-row:hover{background:rgba(255,255,255,0.04)}
      #${PID} .peak-row .peak-rate{text-align:center;font-variant-numeric:tabular-nums}
      #${PID} .peak-row .peak-ip{text-align:right;color:#888;font-size:10px;font-variant-numeric:tabular-nums}
      #${PID} .row.flash{background:rgba(120,200,120,0.22)}
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
        <span></span>
        <span class="name">Peak IP/min</span>
        <span class="peak-rate">—</span>
        <span class="peak-ip">—</span>
        <span></span>
      `;
      paneEls[cfg.tab].appendChild(pr);
    }
    const hasGate = name in gates;
    const amtType = name === 'crunch' ? 'text' : 'number';
    const amtAttrs = name === 'crunch' ? '' : 'min="0" step="1"';
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
    } else if (name === 'crunch' && prop === 'amount') {
      config[name][prop] = t.value.trim() === '' ? null : t.value.trim();
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
      const s = (typeof peak.ip.toString === 'function') ? peak.ip.toString() : String(peak.ip);
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
      peakRow.querySelector('.peak-ip').textContent =
        peak.ip == null ? '—' : '(at ' + fmtExp(peak.ip) + ')';
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



// ---------- BOOKMARKLET (paste as URL of a new bookmark) ----------
//
// START:
// javascript:(()%20%3D%3E%20%7B%0A%20%20if%20(window.__auto)%20window.__auto.stop()%3B%0A%0A%20%20const%20config%20%3D%20%7B%0A%20%20%20%20maxAll%3A%20%20%20%20%7B%20tab%3A%20'AD'%2C%20%20%20%20%20%20%20label%3A%20'Max%20All'%2C%20%20%20%20enabled%3A%20true%2C%20%20period%3A%2050%2C%20%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20dimBoost%3A%20%20%7B%20tab%3A%20'AD'%2C%20%20%20%20%20%20%20label%3A%20'Dim%20Boost'%2C%20%20enabled%3A%20true%2C%20%20period%3A%2050%2C%20%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20galaxy%3A%20%20%20%20%7B%20tab%3A%20'AD'%2C%20%20%20%20%20%20%20label%3A%20'Galaxy'%2C%20%20%20%20%20enabled%3A%20true%2C%20%20period%3A%2050%2C%20%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20sacrifice%3A%20%7B%20tab%3A%20'AD'%2C%20%20%20%20%20%20%20label%3A%20'Sacrifice'%2C%20%20enabled%3A%20true%2C%20%20period%3A%201500%2C%20amount%3A%20null%20%7D%2C%0A%20%20%20%20crunch%3A%20%20%20%20%7B%20tab%3A%20'AD'%2C%20%20%20%20%20%20%20label%3A%20'Crunch'%2C%20%20%20%20%20enabled%3A%20true%2C%20%20period%3A%2050%2C%20%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20buyMaxID%3A%20%20%7B%20tab%3A%20'Infinity'%2C%20label%3A%20'Max%20IDs'%2C%20%20%20%20enabled%3A%20false%2C%20period%3A%20200%2C%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20buyMaxRep%3A%20%7B%20tab%3A%20'Infinity'%2C%20label%3A%20'Max%20Repl'%2C%20%20%20enabled%3A%20false%2C%20period%3A%20200%2C%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20eternity%3A%20%20%7B%20tab%3A%20'Infinity'%2C%20label%3A%20'Eternity'%2C%20%20%20enabled%3A%20false%2C%20period%3A%20100%2C%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20buyMaxTD%3A%20%20%7B%20tab%3A%20'Eternity'%2C%20label%3A%20'Max%20TDs'%2C%20%20%20%20enabled%3A%20false%2C%20period%3A%20200%2C%20%20amount%3A%20null%20%7D%2C%0A%20%20%20%20dilatedEternity%3A%20%7B%20tab%3A%20'Dilation'%2C%20label%3A%20'Dilated%20Eternity'%2C%20enabled%3A%20false%2C%20period%3A%20100%2C%20amount%3A%20null%20%7D%2C%0A%20%20%7D%3B%0A%0Afunction%20encodeBookmarklet(body)%20%7B%0A%20%20return%20'javascript%3A'%20%2B%20encodeURIComponent(body)%20%2B%20'void(0)%3B'%3B%0A%7D%0Afunction%20decodeBookmarklet(line)%20%7B%0A%20%20let%20s%20%3D%20line.trim()%3B%0A%20%20if%20(s.startsWith('%2F%2F%20'))%20s%20%3D%20s.slice(3).trim()%3B%0A%20%20if%20(!s.startsWith('javascript%3A'))%20throw%20new%20Error('not%20a%20bookmarklet')%3B%0A%20%20s%20%3D%20s.slice('javascript%3A'.length)%3B%0A%20%20if%20(!s.endsWith('void(0)%3B'))%20throw%20new%20Error('missing%20void(0)%3B%20suffix')%3B%0A%20%20s%20%3D%20s.slice(0%2C%20-'void(0)%3B'.length)%3B%0A%20%20return%20decodeURIComponent(s)%3B%0A%7D%0Afunction%20fmtExp(v)%20%7B%0A%20%20if%20(v%20%3D%3D%20null)%20return%20'%E2%80%94'%3B%0A%20%20if%20(typeof%20v%3F.toExponential%20%3D%3D%3D%20'function')%20%7B%0A%20%20%20%20try%20%7B%20return%20v.toExponential(2)%3B%20%7D%20catch%20%7B%20%2F*%20fall%20through%20*%2F%20%7D%0A%20%20%7D%0A%20%20return%20Number(v).toExponential(2)%3B%0A%7D%0Afunction%20isRunReset(tMs%2C%20lastTMs)%20%7B%0A%20%20if%20(lastTMs%20%3D%3D%20null)%20return%20false%3B%0A%20%20return%20tMs%20%3C%20lastTMs%20-%2050%3B%0A%7D%0Afunction%20computeRate(gip%2C%20tMs)%20%7B%0A%20%20if%20(tMs%20%3C%201)%20return%20null%3B%0A%20%20const%20minutes%20%3D%20tMs%20%2F%2060000%3B%0A%20%20if%20(typeof%20gip%3F.div%20%3D%3D%3D%20'function')%20return%20gip.div(minutes)%3B%0A%20%20return%20Number(gip)%20%2F%20minutes%3B%0A%7D%0Afunction%20isHigherRate(rate%2C%20prev)%20%7B%0A%20%20if%20(prev%20%3D%3D%20null)%20return%20true%3B%0A%20%20if%20(typeof%20rate%3F.gt%20%3D%3D%3D%20'function')%20return%20rate.gt(prev)%3B%0A%20%20return%20Number(rate)%20%3E%20Number(prev)%3B%0A%7D%0Afunction%20updatePeak(prev%2C%20sample)%20%7B%0A%20%20let%20%7B%20rate%3A%20peakRate%2C%20ip%3A%20peakIp%2C%20lastTMs%20%7D%20%3D%20prev%3B%0A%20%20const%20%7B%20gip%2C%20tMs%20%7D%20%3D%20sample%3B%0A%0A%20%20if%20(tMs%20%3D%3D%20null)%20return%20prev%3B%0A%0A%20%20if%20(isRunReset(tMs%2C%20lastTMs))%20%7B%0A%20%20%20%20peakRate%20%3D%20null%3B%0A%20%20%20%20peakIp%20%3D%20null%3B%0A%20%20%7D%0A%20%20lastTMs%20%3D%20tMs%3B%0A%0A%20%20if%20(gip%20%3D%3D%20null)%20return%20%7B%20rate%3A%20peakRate%2C%20ip%3A%20peakIp%2C%20lastTMs%20%7D%3B%0A%0A%20%20const%20rate%20%3D%20computeRate(gip%2C%20tMs)%3B%0A%20%20if%20(rate%20%3D%3D%20null)%20return%20%7B%20rate%3A%20peakRate%2C%20ip%3A%20peakIp%2C%20lastTMs%20%7D%3B%0A%0A%20%20if%20(isHigherRate(rate%2C%20peakRate))%20%7B%0A%20%20%20%20return%20%7B%20rate%2C%20ip%3A%20gip%2C%20lastTMs%20%7D%3B%0A%20%20%7D%0A%20%20return%20%7B%20rate%3A%20peakRate%2C%20ip%3A%20peakIp%2C%20lastTMs%20%7D%3B%0A%7D%0Afunction%20gateCrunch(amount%2C%20gipResolver%2C%20DecimalCtor)%20%7B%0A%20%20if%20(amount%20%3D%3D%20null)%20return%20true%3B%0A%20%20const%20a%20%3D%20String(amount).trim()%3B%0A%20%20if%20(a%20%3D%3D%3D%20'')%20return%20true%3B%0A%20%20const%20gip%20%3D%20gipResolver()%3B%0A%20%20if%20(gip%20%3D%3D%20null)%20return%20true%3B%0A%20%20const%20threshold%20%3D%20parseDecimalLike(a%2C%20DecimalCtor)%3B%0A%20%20if%20(threshold%20%3D%3D%20null)%20return%20true%3B%0A%20%20if%20(typeof%20gip.gte%20%3D%3D%3D%20'function')%20return%20gip.gte(threshold)%3B%0A%20%20return%20Number(gip)%20%3E%3D%20Number(threshold)%3B%0A%7D%0Afunction%20parseDecimalLike(s%2C%20DecimalCtor)%20%7B%0A%20%20if%20(s%20%3D%3D%20null)%20return%20null%3B%0A%20%20const%20trimmed%20%3D%20String(s).trim()%3B%0A%20%20if%20(trimmed%20%3D%3D%3D%20'')%20return%20null%3B%0A%20%20if%20(typeof%20DecimalCtor%20%3D%3D%3D%20'function')%20%7B%0A%20%20%20%20try%20%7B%20return%20new%20DecimalCtor(trimmed)%3B%20%7D%20catch%20%7B%20return%20null%3B%20%7D%0A%20%20%7D%0A%20%20const%20n%20%3D%20Number(trimmed)%3B%0A%20%20if%20(!Number.isFinite(n))%20return%20null%3B%0A%20%20return%20n%3B%0A%7D%0Afunction%20updateIpMult(prev%2C%20sample%2C%20DecimalCtor)%20%7B%0A%20%20if%20(sample%20%3D%3D%20null%20%7C%7C%20sample.count%20%3D%3D%20null)%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20prev.count%2C%20amount%3A%20prev.amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20if%20(prev.count%20%3D%3D%20null%20%7C%7C%20sample.count%20%3C%3D%20prev.count)%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%3A%20prev.amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20const%20delta%20%3D%20sample.count%20-%20prev.count%3B%0A%20%20const%20amount%20%3D%20sample.amount%3B%0A%20%20if%20(amount%20%3D%3D%20null%20%7C%7C%20amount%20%3D%3D%3D%20'')%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20if%20(typeof%20DecimalCtor%20!%3D%3D%20'function')%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20let%20factor%2C%20base%3B%0A%20%20try%20%7B%0A%20%20%20%20base%20%3D%20new%20DecimalCtor(amount)%3B%0A%20%20%20%20factor%20%3D%20new%20DecimalCtor(2).pow(delta)%3B%0A%20%20%7D%20catch%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20let%20newAmount%3B%0A%20%20try%20%7B%0A%20%20%20%20newAmount%20%3D%20base.times(factor).toString()%3B%0A%20%20%7D%20catch%20%7B%0A%20%20%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%2C%20scaled%3A%20false%20%7D%3B%0A%20%20%7D%0A%20%20return%20%7B%20count%3A%20sample.count%2C%20amount%3A%20newAmount%2C%20scaled%3A%20true%20%7D%3B%0A%7D%0A%20%20const%20STORAGE_KEY%20%3D%20'__auto_settings_v1'%3B%0A%20%20const%20stored%20%3D%20(()%20%3D%3E%20%7B%0A%20%20%20%20try%20%7B%20return%20JSON.parse(localStorage.getItem(STORAGE_KEY)%20%7C%7C%20'null')%3B%20%7D%20catch%20%7B%20return%20null%3B%20%7D%0A%20%20%7D)()%3B%0A%20%20if%20(stored%20%26%26%20stored.config)%20%7B%0A%20%20%20%20for%20(const%20%5Bn%2C%20saved%5D%20of%20Object.entries(stored.config))%20%7B%0A%20%20%20%20%20%20if%20(!config%5Bn%5D%20%7C%7C%20!saved)%20continue%3B%0A%20%20%20%20%20%20if%20(typeof%20saved.enabled%20%3D%3D%3D%20'boolean')%20config%5Bn%5D.enabled%20%3D%20saved.enabled%3B%0A%20%20%20%20%20%20if%20(typeof%20saved.period%20%3D%3D%3D%20'number')%20config%5Bn%5D.period%20%3D%20saved.period%3B%0A%20%20%20%20%20%20if%20(saved.amount%20%3D%3D%3D%20null)%20config%5Bn%5D.amount%20%3D%20null%3B%0A%20%20%20%20%20%20else%20if%20(n%20%3D%3D%3D%20'crunch'%20%26%26%20typeof%20saved.amount%20%3D%3D%3D%20'string')%20config%5Bn%5D.amount%20%3D%20saved.amount%3B%0A%20%20%20%20%20%20else%20if%20(typeof%20saved.amount%20%3D%3D%3D%20'number')%20config%5Bn%5D.amount%20%3D%20saved.amount%3B%0A%20%20%20%20%7D%0A%20%20%7D%0A%20%20let%20lastIpMultCount%20%3D%20(stored%20%26%26%20typeof%20stored.lastIpMultCount%20%3D%3D%3D%20'number')%0A%20%20%20%20%3F%20stored.lastIpMultCount%0A%20%20%20%20%3A%20null%3B%0A%20%20let%20currentTab%20%3D%20null%3B%0A%20%20function%20saveSettings()%20%7B%0A%20%20%20%20try%20%7B%0A%20%20%20%20%20%20localStorage.setItem(STORAGE_KEY%2C%20JSON.stringify(%7B%0A%20%20%20%20%20%20%20%20v%3A%201%2C%0A%20%20%20%20%20%20%20%20config%3A%20Object.fromEntries(Object.entries(config).map((%5Bn%2C%20c%5D)%20%3D%3E%20%5Bn%2C%20%7B%0A%20%20%20%20%20%20%20%20%20%20enabled%3A%20c.enabled%2C%20period%3A%20c.period%2C%20amount%3A%20c.amount%2C%0A%20%20%20%20%20%20%20%20%7D%5D))%2C%0A%20%20%20%20%20%20%20%20ui%3A%20%7B%0A%20%20%20%20%20%20%20%20%20%20activeTab%3A%20currentTab%2C%0A%20%20%20%20%20%20%20%20%20%20collapsed%3A%20panel.classList.contains('collapsed')%2C%0A%20%20%20%20%20%20%20%20%20%20left%3A%20panel.style.left%20%7C%7C%20null%2C%0A%20%20%20%20%20%20%20%20%20%20top%3A%20%20panel.style.top%20%20%7C%7C%20null%2C%0A%20%20%20%20%20%20%20%20%7D%2C%0A%20%20%20%20%20%20%20%20lastIpMultCount%2C%0A%20%20%20%20%20%20%7D))%3B%0A%20%20%20%20%7D%20catch%20%7B%7D%0A%20%20%7D%0A%0A%20%20const%20handlerPaths%20%3D%20%7B%0A%20%20%20%20maxAll%3A%20%20%20%20%20%20%20%20%20%20%5B'maxAll'%5D%2C%0A%20%20%20%20dimBoost%3A%20%20%20%20%20%20%20%20%5B'manualRequestDimensionBoost'%5D%2C%0A%20%20%20%20galaxy%3A%20%20%20%20%20%20%20%20%20%20%5B'manualRequestGalaxyReset'%5D%2C%0A%20%20%20%20sacrifice%3A%20%20%20%20%20%20%20%5B'sacrificeBtnClick'%5D%2C%0A%20%20%20%20crunch%3A%20%20%20%20%20%20%20%20%20%20%5B'manualBigCrunchResetRequest'%5D%2C%0A%20%20%20%20buyMaxID%3A%20%20%20%20%20%20%20%20%5B'buyMaxInfinityDimensions'%2C%20'InfinityDimensions.buyMax'%5D%2C%0A%20%20%20%20buyMaxRep%3A%20%20%20%20%20%20%20%5B'Replicanti.galaxies.buyMax'%2C%20'maxReplicantiGalaxies'%5D%2C%0A%20%20%20%20eternity%3A%20%20%20%20%20%20%20%20%5B'eternity'%2C%20'requestEternity'%2C%20'manualRequestEternity'%5D%2C%0A%20%20%20%20buyMaxTD%3A%20%20%20%20%20%20%20%20%5B'buyMaxTimeDimensions'%2C%20'TimeDimensions.buyMax'%5D%2C%0A%20%20%20%20dilatedEternity%3A%20%5B'startDilatedEternity'%2C%20'Dilation.requestStartDilation'%5D%2C%0A%20%20%7D%3B%0A%0A%20%20function%20resolveFn(path)%20%7B%0A%20%20%20%20return%20path.split('.').reduce((o%2C%20k)%20%3D%3E%20(o%20%3D%3D%20null%20%3F%20o%20%3A%20o%5Bk%5D)%2C%20window)%3B%0A%20%20%7D%0A%20%20function%20resolveRaw(paths)%20%7B%0A%20%20%20%20for%20(const%20p%20of%20paths)%20%7B%0A%20%20%20%20%20%20const%20v%20%3D%20p.split('.').reduce((o%2C%20k)%20%3D%3E%20(o%20%3D%3D%20null%20%3F%20o%20%3A%20o%5Bk%5D)%2C%20window)%3B%0A%20%20%20%20%20%20if%20(v%20%3D%3D%20null)%20continue%3B%0A%20%20%20%20%20%20if%20(typeof%20v%20%3D%3D%3D%20'function')%20%7B%0A%20%20%20%20%20%20%20%20try%20%7B%20const%20r%20%3D%20v()%3B%20if%20(r%20!%3D%20null)%20return%20r%3B%20%7D%20catch%20%7B%20%2F*%20try%20next%20*%2F%20%7D%0A%20%20%20%20%20%20%20%20continue%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20return%20v%3B%0A%20%20%20%20%7D%0A%20%20%20%20return%20null%3B%0A%20%20%7D%0A%20%20function%20dispatch(name)%20%7B%0A%20%20%20%20for%20(const%20p%20of%20handlerPaths%5Bname%5D%20%7C%7C%20%5B%5D)%20%7B%0A%20%20%20%20%20%20const%20fn%20%3D%20resolveFn(p)%3B%0A%20%20%20%20%20%20if%20(typeof%20fn%20%3D%3D%3D%20'function')%20return%20fn()%3B%0A%20%20%20%20%7D%0A%20%20%20%20throw%20new%20Error(%60%5Bauto%5D%20no%20handler%20resolved%20for%20%24%7Bname%7D%60)%3B%0A%20%20%7D%0A%0A%20%20const%20gates%20%3D%20%7B%0A%20%20%20%20sacrifice%3A%20(cfg)%20%3D%3E%20%7B%0A%20%20%20%20%20%20if%20(cfg.amount%20%3D%3D%20null)%20return%20true%3B%0A%20%20%20%20%20%20const%20nb%20%3D%20window.Sacrifice%20%26%26%20window.Sacrifice.nextBoost%3B%0A%20%20%20%20%20%20if%20(nb%20%3D%3D%20null)%20return%20true%3B%0A%20%20%20%20%20%20return%20typeof%20nb.gte%20%3D%3D%3D%20'function'%20%3F%20nb.gte(cfg.amount)%20%3A%20Number(nb)%20%3E%3D%20cfg.amount%3B%0A%20%20%20%20%7D%2C%0A%20%20%20%20crunch%3A%20(cfg)%20%3D%3E%20gateCrunch(cfg.amount%2C%20()%20%3D%3E%20resolveRaw(peakProbes.gip)%2C%20window.Decimal)%2C%0A%20%20%7D%3B%0A%0A%20%20const%20STATE_PROBES%20%3D%20%7B%0A%20%20%20%20antimatter%3A%20%20%20%20%20%5B'Currency.antimatter.value'%2C%20'Currency.antimatter'%2C%20'player.antimatter'%5D%2C%0A%20%20%20%20infinityPower%3A%20%20%5B'Currency.infinityPower.value'%2C%20'Currency.infinityPower'%5D%2C%0A%20%20%20%20ip%3A%20%20%20%20%20%20%20%20%20%20%20%20%20%5B'Currency.infinityPoints.value'%2C%20'Currency.infinityPoints'%2C%20'player.infinityPoints'%5D%2C%0A%20%20%20%20ep%3A%20%20%20%20%20%20%20%20%20%20%20%20%20%5B'Currency.eternityPoints.value'%2C%20'Currency.eternityPoints'%2C%20'player.eternityPoints'%5D%2C%0A%20%20%20%20infinities%3A%20%20%20%20%20%5B'Currency.infinities.value'%2C%20'Currency.infinities'%2C%20'player.infinitied'%5D%2C%0A%20%20%20%20eternities%3A%20%20%20%20%20%5B'Currency.eternities.value'%2C%20'Currency.eternities'%2C%20'player.eternities'%5D%2C%0A%20%20%20%20replicanti%3A%20%20%20%20%20%5B'Currency.replicanti.value'%2C%20'Replicanti.amount'%2C%20'player.replicanti.amount'%5D%2C%0A%20%20%20%20dimBoosts%3A%20%20%20%20%20%20%5B'DimBoost.purchasedBoosts'%2C%20'DimBoost.totalBoosts'%2C%20'player.dimensionBoosts'%5D%2C%0A%20%20%20%20galaxies%3A%20%20%20%20%20%20%20%5B'player.galaxies'%5D%2C%0A%20%20%20%20sacrificeMult%3A%20%20%5B'Sacrifice.totalBoost'%5D%2C%0A%20%20%20%20bestInfTimeS%3A%20%20%20%5B'player.records.bestInfinity.time'%2C%20'player.bestInfinityTime'%5D%2C%0A%20%20%20%20thisInfTimeS%3A%20%20%20%5B'player.records.thisInfinity.time'%5D%2C%0A%20%20%20%20brokenInfinity%3A%20%5B'player.break'%5D%2C%0A%20%20%20%20ipOnCrunch%3A%20%20%20%20%20%5B'gainedInfinityPoints'%5D%2C%0A%20%20%7D%3B%0A%20%20function%20probeState()%20%7B%0A%20%20%20%20const%20safe%20%3D%20(path)%20%3D%3E%20path.split('.').reduce((o%2C%20k)%20%3D%3E%20(o%20%3D%3D%20null%20%3F%20o%20%3A%20o%5Bk%5D)%2C%20window)%3B%0A%20%20%20%20const%20fmt%20%3D%20(v)%20%3D%3E%20%7B%0A%20%20%20%20%20%20if%20(v%20%3D%3D%20null)%20return%20null%3B%0A%20%20%20%20%20%20if%20(typeof%20v%20%3D%3D%3D%20'number'%20%7C%7C%20typeof%20v%20%3D%3D%3D%20'string'%20%7C%7C%20typeof%20v%20%3D%3D%3D%20'boolean')%20return%20v%3B%0A%20%20%20%20%20%20if%20(typeof%20v%20%3D%3D%3D%20'function')%20%7B%20try%20%7B%20return%20fmt(v())%3B%20%7D%20catch%20%7B%20return%20null%3B%20%7D%20%7D%0A%20%20%20%20%20%20if%20(typeof%20v.toString%20%3D%3D%3D%20'function')%20%7B%0A%20%20%20%20%20%20%20%20const%20s%20%3D%20v.toString()%3B%0A%20%20%20%20%20%20%20%20return%20s%20%3D%3D%3D%20'%5Bobject%20Object%5D'%20%3F%20null%20%3A%20s%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20return%20null%3B%0A%20%20%20%20%7D%3B%0A%20%20%20%20const%20out%20%3D%20%7B%7D%3B%0A%20%20%20%20for%20(const%20%5Bk%2C%20paths%5D%20of%20Object.entries(STATE_PROBES))%20%7B%0A%20%20%20%20%20%20for%20(const%20p%20of%20paths)%20%7B%0A%20%20%20%20%20%20%20%20const%20f%20%3D%20fmt(safe(p))%3B%0A%20%20%20%20%20%20%20%20if%20(f%20!%3D%20null)%20%7B%20out%5Bk%5D%20%3D%20f%3B%20break%3B%20%7D%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%20%20return%20out%3B%0A%20%20%7D%0A%0A%20%20const%20stats%20%3D%20%7B%7D%2C%20lastRun%20%3D%20%7B%7D%3B%0A%20%20for%20(const%20k%20of%20Object.keys(config))%20%7B%20stats%5Bk%5D%20%3D%20%7B%20fires%3A%200%2C%20errs%3A%200%20%7D%3B%20lastRun%5Bk%5D%20%3D%200%3B%20%7D%0A%20%20const%20peakProbes%20%3D%20%7B%0A%20%20%20%20gip%3A%20%5B'gainedInfinityPoints'%5D%2C%0A%20%20%20%20tMs%3A%20%5B'player.records.thisInfinity.time'%5D%2C%0A%20%20%20%20ipMult%3A%20%5B'InfinityUpgrade.ipMult.purchaseCount'%5D%2C%0A%20%20%7D%3B%0A%20%20let%20peak%20%3D%20%7B%20rate%3A%20null%2C%20ip%3A%20null%2C%20lastTMs%3A%20null%20%7D%3B%0A%20%20const%20startedAt%20%3D%20performance.now()%3B%0A%0A%20%20const%20TICK_MS%20%3D%2050%3B%0A%20%20const%20intervalId%20%3D%20setInterval(()%20%3D%3E%20%7B%0A%20%20%20%20const%20now%20%3D%20performance.now()%3B%0A%20%20%20%20for%20(const%20%5Bname%2C%20cfg%5D%20of%20Object.entries(config))%20%7B%0A%20%20%20%20%20%20if%20(!cfg.enabled)%20continue%3B%0A%20%20%20%20%20%20if%20(now%20-%20lastRun%5Bname%5D%20%3C%20cfg.period)%20continue%3B%0A%20%20%20%20%20%20if%20(gates%5Bname%5D%20%26%26%20!gates%5Bname%5D(cfg))%20continue%3B%0A%20%20%20%20%20%20try%20%7B%0A%20%20%20%20%20%20%20%20dispatch(name)%3B%0A%20%20%20%20%20%20%20%20stats%5Bname%5D.fires%2B%2B%3B%0A%20%20%20%20%20%20%20%20lastRun%5Bname%5D%20%3D%20now%3B%0A%20%20%20%20%20%20%7D%20catch%20(e)%20%7B%0A%20%20%20%20%20%20%20%20stats%5Bname%5D.errs%2B%2B%3B%0A%20%20%20%20%20%20%20%20if%20(stats%5Bname%5D.errs%20%3C%3D%202)%20console.warn(name%2C%20'threw'%2C%20e)%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%20%20refreshGui()%3B%0A%20%20%7D%2C%20TICK_MS)%3B%0A%0A%20%20const%20peakIntervalId%20%3D%20setInterval(()%20%3D%3E%20%7B%0A%20%20%20%20const%20tMs%20%3D%20resolveRaw(peakProbes.tMs)%3B%0A%20%20%20%20const%20gip%20%3D%20resolveRaw(peakProbes.gip)%3B%0A%20%20%20%20peak%20%3D%20updatePeak(peak%2C%20%7B%20gip%2C%20tMs%20%7D)%3B%0A%0A%20%20%20%20const%20ipMultCount%20%3D%20resolveRaw(peakProbes.ipMult)%3B%0A%20%20%20%20const%20result%20%3D%20updateIpMult(%0A%20%20%20%20%20%20%7B%20count%3A%20lastIpMultCount%2C%20amount%3A%20config.crunch.amount%20%7D%2C%0A%20%20%20%20%20%20%7B%20count%3A%20ipMultCount%2C%20amount%3A%20config.crunch.amount%20%7D%2C%0A%20%20%20%20%20%20window.Decimal%2C%0A%20%20%20%20)%3B%0A%20%20%20%20if%20(result.count%20!%3D%3D%20lastIpMultCount)%20%7B%0A%20%20%20%20%20%20lastIpMultCount%20%3D%20result.count%3B%0A%20%20%20%20%20%20if%20(result.scaled)%20%7B%0A%20%20%20%20%20%20%20%20config.crunch.amount%20%3D%20result.amount%3B%0A%20%20%20%20%20%20%20%20const%20input%20%3D%20panel.querySelector('input%5Bdata-name%3D%22crunch%22%5D%5Bdata-prop%3D%22amount%22%5D')%3B%0A%20%20%20%20%20%20%20%20if%20(input)%20input.value%20%3D%20result.amount%3B%0A%20%20%20%20%20%20%20%20const%20row%20%3D%20rowEls.crunch%3B%0A%20%20%20%20%20%20%20%20if%20(row)%20%7B%0A%20%20%20%20%20%20%20%20%20%20row.classList.add('flash')%3B%0A%20%20%20%20%20%20%20%20%20%20setTimeout(()%20%3D%3E%20row.classList.remove('flash')%2C%20600)%3B%0A%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20saveSettings()%3B%0A%20%20%20%20%7D%0A%20%20%7D%2C%20250)%3B%0A%0A%20%20const%20PID%20%3D%20'__auto_panel'%3B%0A%20%20document.getElementById(PID)%3F.remove()%3B%0A%0A%20%20const%20tabs%20%3D%20%5B%5D%3B%0A%20%20for%20(const%20cfg%20of%20Object.values(config))%20if%20(!tabs.includes(cfg.tab))%20tabs.push(cfg.tab)%3B%0A%0A%20%20const%20panel%20%3D%20document.createElement('div')%3B%0A%20%20panel.id%20%3D%20PID%3B%0A%20%20panel.innerHTML%20%3D%20%60%0A%20%20%20%20%3Cstyle%3E%0A%20%20%20%20%20%20%23%24%7BPID%7D%2C%23%24%7BPID%7D%20*%7Bbox-sizing%3Aborder-box%3Bfont-family%3A-apple-system%2Csystem-ui%2Csans-serif%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%7Bposition%3Afixed%3Bleft%3A12px%3Bbottom%3A12px%3Bz-index%3A999999%3B%0A%20%20%20%20%20%20%20%20font-size%3A12px%3Bbackground%3Argba(20%2C20%2C28%2C.94)%3Bcolor%3A%23e8e8ee%3B%0A%20%20%20%20%20%20%20%20border%3A1px%20solid%20%23444%3Bborder-radius%3A8px%3Bpadding%3A8px%2010px%3B%0A%20%20%20%20%20%20%20%20min-width%3A340px%3Bbox-shadow%3A0%204px%2016px%20rgba(0%2C0%2C0%2C.4)%3Buser-select%3Anone%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.head%7Bdisplay%3Aflex%3Balign-items%3Acenter%3Bgap%3A8px%3Bcursor%3Amove%3B%0A%20%20%20%20%20%20%20%20padding-bottom%3A6px%3Bborder-bottom%3A1px%20solid%20%23333%3Bmargin-bottom%3A6px%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.title%7Bfont-size%3A12px%3Bfont-weight%3A600%3Bflex%3A1%3Bcolor%3A%23e8e8ee%3Bline-height%3A1%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20button%7Bbackground%3A%232a2a38%3Bcolor%3A%23e8e8ee%3Bborder%3A1px%20solid%20%23444%3B%0A%20%20%20%20%20%20%20%20border-radius%3A4px%3Bpadding%3A2px%207px%3Bfont-size%3A11px%3Bcursor%3Apointer%3B%0A%20%20%20%20%20%20%20%20line-height%3A1%3Bmargin%3A0%3Bfont-family%3Ainherit%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20button%3Ahover%7Bbackground%3A%233a3a48%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.tabs%7Bdisplay%3Aflex%3Bgap%3A4px%3Bmargin-bottom%3A6px%3Bflex-wrap%3Awrap%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.tabs%20button%7Bpadding%3A3px%209px%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.tabs%20button.active%7Bbackground%3A%234a4a68%3Bborder-color%3A%23666%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.pane%7Bdisplay%3Anone%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.pane.active%7Bdisplay%3Ablock%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.row%7Bdisplay%3Agrid%3Bgrid-template-columns%3A18px%201fr%2056px%2056px%2056px%3B%0A%20%20%20%20%20%20%20%20gap%3A8px%3Balign-items%3Acenter%3Bpadding%3A3px%200%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.row.hdr%7Bfont-size%3A9px%3Bcolor%3A%23888%3Btext-transform%3Auppercase%3B%0A%20%20%20%20%20%20%20%20letter-spacing%3A.06em%3Bpadding%3A2px%200%204px%3Bborder-bottom%3A1px%20solid%20%232a2a32%3Bmargin-bottom%3A2px%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.row.hdr%20.lbl-time%2C%23%24%7BPID%7D%20.row.hdr%20.lbl-amt%7Btext-align%3Acenter%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.row.hdr%20.lbl-hits%7Btext-align%3Aright%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.name%7Bfont-weight%3A500%3Bwhite-space%3Anowrap%3Boverflow%3Ahidden%3Btext-overflow%3Aellipsis%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20input%5Btype%3Dcheckbox%5D%7Bmargin%3A0%3Bcursor%3Apointer%3Bwidth%3A14px%3Bheight%3A14px%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20input%5Btype%3Dnumber%5D%7Bwidth%3A100%25%3Bbackground%3A%231a1a24%3Bcolor%3A%23e8e8ee%3B%0A%20%20%20%20%20%20%20%20border%3A1px%20solid%20%23333%3Bborder-radius%3A3px%3Bpadding%3A2px%204px%3B%0A%20%20%20%20%20%20%20%20font-size%3A11px%3Bfont-family%3Ainherit%3Btext-align%3Aright%3Bline-height%3A1.2%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20input%5Btype%3Dnumber%5D%3Adisabled%7Bopacity%3A.32%3Bcursor%3Anot-allowed%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.stats%7Bfont-variant-numeric%3Atabular-nums%3Bcolor%3A%23888%3B%0A%20%20%20%20%20%20%20%20font-size%3A10px%3Btext-align%3Aright%3Bline-height%3A1.2%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.stats.err%7Bcolor%3A%23e88%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.foot%7Bdisplay%3Aflex%3Bjustify-content%3Aspace-between%3Bmargin-top%3A6px%3B%0A%20%20%20%20%20%20%20%20padding-top%3A6px%3Bborder-top%3A1px%20solid%20%23333%3Bfont-size%3A10px%3Bcolor%3A%23888%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D.collapsed%20.body%2C%23%24%7BPID%7D.collapsed%20.tabs%2C%23%24%7BPID%7D.collapsed%20.foot%7Bdisplay%3Anone%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.peak-row%7Bcursor%3Apointer%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.peak-row%3Ahover%7Bbackground%3Argba(255%2C255%2C255%2C0.04)%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.peak-row%20.peak-rate%7Btext-align%3Acenter%3Bfont-variant-numeric%3Atabular-nums%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.peak-row%20.peak-ip%7Btext-align%3Aright%3Bcolor%3A%23888%3Bfont-size%3A10px%3Bfont-variant-numeric%3Atabular-nums%7D%0A%20%20%20%20%20%20%23%24%7BPID%7D%20.row.flash%7Bbackground%3Argba(120%2C200%2C120%2C0.22)%7D%0A%20%20%20%20%3C%2Fstyle%3E%0A%20%20%20%20%3Cdiv%20class%3D%22head%22%3E%0A%20%20%20%20%20%20%3Cdiv%20class%3D%22title%22%3Eauto%3C%2Fdiv%3E%0A%20%20%20%20%20%20%3Cbutton%20data-act%3D%22copy%22%20title%3D%22copy%20state%20JSON%20to%20clipboard%22%3EJSON%3C%2Fbutton%3E%0A%20%20%20%20%20%20%3Cbutton%20data-act%3D%22collapse%22%20title%3D%22collapse%22%3E%E2%80%93%3C%2Fbutton%3E%0A%20%20%20%20%20%20%3Cbutton%20data-act%3D%22stop%22%20title%3D%22stop%20%26amp%3B%20remove%22%3E%C3%97%3C%2Fbutton%3E%0A%20%20%20%20%3C%2Fdiv%3E%0A%20%20%20%20%3Cdiv%20class%3D%22tabs%22%3E%3C%2Fdiv%3E%0A%20%20%20%20%3Cdiv%20class%3D%22body%22%3E%3C%2Fdiv%3E%0A%20%20%20%20%3Cdiv%20class%3D%22foot%22%3E%3Cspan%20class%3D%22uptime%22%3E0s%3C%2Fspan%3E%3Cspan%20class%3D%22totals%22%3E0%20fires%3C%2Fspan%3E%3C%2Fdiv%3E%0A%20%20%60%3B%0A%20%20document.body.appendChild(panel)%3B%0A%0A%20%20if%20(stored%3F.ui%3F.collapsed)%20panel.classList.add('collapsed')%3B%0A%20%20if%20(stored%3F.ui%3F.left)%20%7B%20panel.style.left%20%3D%20stored.ui.left%3B%20panel.style.right%20%3D%20'auto'%3B%20%7D%0A%20%20if%20(stored%3F.ui%3F.top)%20%20%7B%20panel.style.top%20%20%3D%20stored.ui.top%3B%20%20panel.style.bottom%20%3D%20'auto'%3B%20%7D%0A%0A%20%20const%20tabsEl%20%3D%20panel.querySelector('.tabs')%3B%0A%20%20const%20body%20%3D%20panel.querySelector('.body')%3B%0A%20%20const%20rowEls%20%3D%20%7B%7D%3B%0A%20%20const%20paneEls%20%3D%20%7B%7D%3B%0A%0A%20%20for%20(const%20tab%20of%20tabs)%20%7B%0A%20%20%20%20const%20tb%20%3D%20document.createElement('button')%3B%0A%20%20%20%20tb.textContent%20%3D%20tab%3B%0A%20%20%20%20tb.dataset.tab%20%3D%20tab%3B%0A%20%20%20%20tabsEl.appendChild(tb)%3B%0A%0A%20%20%20%20const%20pane%20%3D%20document.createElement('div')%3B%0A%20%20%20%20pane.className%20%3D%20'pane'%3B%0A%20%20%20%20pane.dataset.tab%20%3D%20tab%3B%0A%0A%20%20%20%20const%20hdr%20%3D%20document.createElement('div')%3B%0A%20%20%20%20hdr.className%20%3D%20'row%20hdr'%3B%0A%20%20%20%20hdr.innerHTML%20%3D%20%60%3Cspan%3E%3C%2Fspan%3E%3Cspan%3E%3C%2Fspan%3E%3Cspan%20class%3D%22lbl-time%22%3Etime%3C%2Fspan%3E%3Cspan%20class%3D%22lbl-amt%22%3Eamount%3C%2Fspan%3E%3Cspan%20class%3D%22lbl-hits%22%3Ehits%3C%2Fspan%3E%60%3B%0A%20%20%20%20pane.appendChild(hdr)%3B%0A%0A%20%20%20%20body.appendChild(pane)%3B%0A%20%20%20%20paneEls%5Btab%5D%20%3D%20pane%3B%0A%20%20%7D%0A%0A%20%20for%20(const%20%5Bname%2C%20cfg%5D%20of%20Object.entries(config))%20%7B%0A%20%20%20%20if%20(name%20%3D%3D%3D%20'crunch')%20%7B%0A%20%20%20%20%20%20const%20pr%20%3D%20document.createElement('div')%3B%0A%20%20%20%20%20%20pr.className%20%3D%20'row%20peak-row'%3B%0A%20%20%20%20%20%20pr.id%20%3D%20'__auto_peak_row'%3B%0A%20%20%20%20%20%20pr.title%20%3D%20'click%20to%20copy%20IP-at-peak%20into%20crunch%20amount'%3B%0A%20%20%20%20%20%20pr.innerHTML%20%3D%20%60%0A%20%20%20%20%20%20%20%20%3Cspan%3E%3C%2Fspan%3E%0A%20%20%20%20%20%20%20%20%3Cspan%20class%3D%22name%22%3EPeak%20IP%2Fmin%3C%2Fspan%3E%0A%20%20%20%20%20%20%20%20%3Cspan%20class%3D%22peak-rate%22%3E%E2%80%94%3C%2Fspan%3E%0A%20%20%20%20%20%20%20%20%3Cspan%20class%3D%22peak-ip%22%3E%E2%80%94%3C%2Fspan%3E%0A%20%20%20%20%20%20%20%20%3Cspan%3E%3C%2Fspan%3E%0A%20%20%20%20%20%20%60%3B%0A%20%20%20%20%20%20paneEls%5Bcfg.tab%5D.appendChild(pr)%3B%0A%20%20%20%20%7D%0A%20%20%20%20const%20hasGate%20%3D%20name%20in%20gates%3B%0A%20%20%20%20const%20amtType%20%3D%20name%20%3D%3D%3D%20'crunch'%20%3F%20'text'%20%3A%20'number'%3B%0A%20%20%20%20const%20amtAttrs%20%3D%20name%20%3D%3D%3D%20'crunch'%20%3F%20''%20%3A%20'min%3D%220%22%20step%3D%221%22'%3B%0A%20%20%20%20const%20row%20%3D%20document.createElement('div')%3B%0A%20%20%20%20row.className%20%3D%20'row'%3B%0A%20%20%20%20row.innerHTML%20%3D%20%60%0A%20%20%20%20%20%20%3Cinput%20type%3D%22checkbox%22%20data-name%3D%22%24%7Bname%7D%22%20data-prop%3D%22enabled%22%20%24%7Bcfg.enabled%20%3F%20'checked'%20%3A%20''%7D%3E%0A%20%20%20%20%20%20%3Cspan%20class%3D%22name%22%20title%3D%22%24%7Bcfg.label%7D%22%3E%24%7Bcfg.label%7D%3C%2Fspan%3E%0A%20%20%20%20%20%20%3Cinput%20type%3D%22number%22%20data-name%3D%22%24%7Bname%7D%22%20data-prop%3D%22period%22%20value%3D%22%24%7Bcfg.period%7D%22%20min%3D%220%22%20step%3D%2250%22%20title%3D%22period%20(ms)%20between%20fires%22%3E%0A%20%20%20%20%20%20%3Cinput%20type%3D%22%24%7BamtType%7D%22%20data-name%3D%22%24%7Bname%7D%22%20data-prop%3D%22amount%22%20value%3D%22%24%7Bcfg.amount%20%3F%3F%20''%7D%22%20%24%7BamtAttrs%7D%20placeholder%3D%22%24%7BhasGate%20%3F%20'%E2%80%94'%20%3A%20'n%2Fa'%7D%22%20%24%7BhasGate%20%3F%20''%20%3A%20'disabled'%7D%20title%3D%22%24%7BhasGate%20%3F%20'minimum%20amount%20gate%20(blank%20%3D%20off)'%20%3A%20'no%20gate%20defined%20for%20this%20action'%7D%22%3E%0A%20%20%20%20%20%20%3Cspan%20class%3D%22stats%22%3E0%3C%2Fspan%3E%0A%20%20%20%20%60%3B%0A%20%20%20%20paneEls%5Bcfg.tab%5D.appendChild(row)%3B%0A%20%20%20%20rowEls%5Bname%5D%20%3D%20row%3B%0A%20%20%7D%0A%0A%20%20function%20setActiveTab(tab)%20%7B%0A%20%20%20%20currentTab%20%3D%20tab%3B%0A%20%20%20%20for%20(const%20btn%20of%20tabsEl.querySelectorAll('button'))%20%7B%0A%20%20%20%20%20%20btn.classList.toggle('active'%2C%20btn.dataset.tab%20%3D%3D%3D%20tab)%3B%0A%20%20%20%20%7D%0A%20%20%20%20for%20(const%20%5Bt%2C%20p%5D%20of%20Object.entries(paneEls))%20%7B%0A%20%20%20%20%20%20p.classList.toggle('active'%2C%20t%20%3D%3D%3D%20tab)%3B%0A%20%20%20%20%7D%0A%20%20%7D%0A%20%20const%20initialTab%20%3D%20stored%3F.ui%3F.activeTab%20%26%26%20tabs.includes(stored.ui.activeTab)%0A%20%20%20%20%3F%20stored.ui.activeTab%20%3A%20tabs%5B0%5D%3B%0A%20%20setActiveTab(initialTab)%3B%0A%0A%20%20panel.addEventListener('change'%2C%20(e)%20%3D%3E%20%7B%0A%20%20%20%20const%20t%20%3D%20e.target%3B%0A%20%20%20%20const%20%7B%20name%2C%20prop%20%7D%20%3D%20t.dataset%3B%0A%20%20%20%20if%20(!name%20%7C%7C%20!prop)%20return%3B%0A%20%20%20%20if%20(t.type%20%3D%3D%3D%20'checkbox')%20%7B%0A%20%20%20%20%20%20config%5Bname%5D%5Bprop%5D%20%3D%20t.checked%3B%0A%20%20%20%20%7D%20else%20if%20(name%20%3D%3D%3D%20'crunch'%20%26%26%20prop%20%3D%3D%3D%20'amount')%20%7B%0A%20%20%20%20%20%20config%5Bname%5D%5Bprop%5D%20%3D%20t.value.trim()%20%3D%3D%3D%20''%20%3F%20null%20%3A%20t.value.trim()%3B%0A%20%20%20%20%7D%20else%20if%20(t.type%20%3D%3D%3D%20'number')%20%7B%0A%20%20%20%20%20%20config%5Bname%5D%5Bprop%5D%20%3D%20t.value%20%3D%3D%3D%20''%20%3F%20null%20%3A%20Number(t.value)%3B%0A%20%20%20%20%7D%0A%20%20%20%20saveSettings()%3B%0A%20%20%7D)%3B%0A%0A%20%20panel.addEventListener('click'%2C%20(e)%20%3D%3E%20%7B%0A%20%20%20%20if%20(e.target.closest%20%26%26%20e.target.closest('.peak-row'))%20%7B%0A%20%20%20%20%20%20if%20(peak.ip%20%3D%3D%20null)%20return%3B%0A%20%20%20%20%20%20const%20input%20%3D%20panel.querySelector('input%5Bdata-name%3D%22crunch%22%5D%5Bdata-prop%3D%22amount%22%5D')%3B%0A%20%20%20%20%20%20if%20(!input)%20return%3B%0A%20%20%20%20%20%20const%20s%20%3D%20(typeof%20peak.ip.toString%20%3D%3D%3D%20'function')%20%3F%20peak.ip.toString()%20%3A%20String(peak.ip)%3B%0A%20%20%20%20%20%20input.value%20%3D%20s%3B%0A%20%20%20%20%20%20config.crunch.amount%20%3D%20s%3B%0A%20%20%20%20%20%20saveSettings()%3B%0A%20%20%20%20%20%20const%20pr%20%3D%20e.target.closest('.peak-row')%3B%0A%20%20%20%20%20%20pr.classList.add('flash')%3B%0A%20%20%20%20%20%20setTimeout(()%20%3D%3E%20pr.classList.remove('flash')%2C%20600)%3B%0A%20%20%20%20%20%20return%3B%0A%20%20%20%20%7D%0A%20%20%20%20const%20tab%20%3D%20e.target.dataset%3F.tab%3B%0A%20%20%20%20if%20(tab)%20%7B%20setActiveTab(tab)%3B%20saveSettings()%3B%20return%3B%20%7D%0A%20%20%20%20const%20act%20%3D%20e.target.dataset%3F.act%3B%0A%20%20%20%20if%20(act%20%3D%3D%3D%20'stop')%20api.stop()%3B%0A%20%20%20%20else%20if%20(act%20%3D%3D%3D%20'collapse')%20%7B%20panel.classList.toggle('collapsed')%3B%20saveSettings()%3B%20%7D%0A%20%20%20%20else%20if%20(act%20%3D%3D%3D%20'copy')%20copyState(e.target)%3B%0A%20%20%7D)%3B%0A%0A%20%20async%20function%20copyState(btn)%20%7B%0A%20%20%20%20const%20data%20%3D%20%7B%0A%20%20%20%20%20%20ts%3A%20new%20Date().toISOString()%2C%0A%20%20%20%20%20%20state%3A%20probeState()%2C%0A%20%20%20%20%20%20auto%3A%20%7B%0A%20%20%20%20%20%20%20%20uptimeS%3A%20Math.floor((performance.now()%20-%20startedAt)%20%2F%201000)%2C%0A%20%20%20%20%20%20%20%20actions%3A%20Object.fromEntries(Object.entries(config).map((%5Bn%2C%20c%5D)%20%3D%3E%20%5Bn%2C%20%7B%0A%20%20%20%20%20%20%20%20%20%20enabled%3A%20c.enabled%2C%0A%20%20%20%20%20%20%20%20%20%20period%3A%20c.period%2C%0A%20%20%20%20%20%20%20%20%20%20amount%3A%20c.amount%2C%0A%20%20%20%20%20%20%20%20%20%20fires%3A%20stats%5Bn%5D.fires%2C%0A%20%20%20%20%20%20%20%20%20%20errs%3A%20stats%5Bn%5D.errs%2C%0A%20%20%20%20%20%20%20%20%7D%5D))%2C%0A%20%20%20%20%20%20%7D%2C%0A%20%20%20%20%7D%3B%0A%20%20%20%20const%20json%20%3D%20JSON.stringify(data%2C%20null%2C%202)%3B%0A%20%20%20%20const%20flash%20%3D%20(label%2C%20isErr)%20%3D%3E%20%7B%0A%20%20%20%20%20%20const%20orig%20%3D%20btn.textContent%3B%0A%20%20%20%20%20%20btn.textContent%20%3D%20label%3B%0A%20%20%20%20%20%20if%20(isErr)%20btn.style.color%20%3D%20'%23e88'%3B%0A%20%20%20%20%20%20setTimeout(()%20%3D%3E%20%7B%20btn.textContent%20%3D%20orig%3B%20btn.style.color%20%3D%20''%3B%20%7D%2C%201200)%3B%0A%20%20%20%20%7D%3B%0A%20%20%20%20try%20%7B%0A%20%20%20%20%20%20await%20navigator.clipboard.writeText(json)%3B%0A%20%20%20%20%20%20flash('copied')%3B%0A%20%20%20%20%7D%20catch%20%7B%0A%20%20%20%20%20%20const%20ta%20%3D%20document.createElement('textarea')%3B%0A%20%20%20%20%20%20ta.value%20%3D%20json%3B%0A%20%20%20%20%20%20ta.style.position%20%3D%20'fixed'%3B%0A%20%20%20%20%20%20ta.style.left%20%3D%20'-9999px'%3B%0A%20%20%20%20%20%20document.body.appendChild(ta)%3B%0A%20%20%20%20%20%20ta.select()%3B%0A%20%20%20%20%20%20let%20ok%20%3D%20false%3B%0A%20%20%20%20%20%20try%20%7B%20ok%20%3D%20document.execCommand('copy')%3B%20%7D%20catch%20%7B%7D%0A%20%20%20%20%20%20ta.remove()%3B%0A%20%20%20%20%20%20flash(ok%20%3F%20'copied'%20%3A%20'failed'%2C%20!ok)%3B%0A%20%20%20%20%7D%0A%20%20%7D%0A%0A%20%20const%20head%20%3D%20panel.querySelector('.head')%3B%0A%20%20let%20drag%20%3D%20null%3B%0A%20%20head.addEventListener('mousedown'%2C%20(e)%20%3D%3E%20%7B%0A%20%20%20%20if%20(e.target.tagName%20%3D%3D%3D%20'BUTTON')%20return%3B%0A%20%20%20%20const%20r%20%3D%20panel.getBoundingClientRect()%3B%0A%20%20%20%20drag%20%3D%20%7B%20dx%3A%20e.clientX%20-%20r.left%2C%20dy%3A%20e.clientY%20-%20r.top%20%7D%3B%0A%20%20%20%20e.preventDefault()%3B%0A%20%20%7D)%3B%0A%20%20window.addEventListener('mousemove'%2C%20(e)%20%3D%3E%20%7B%0A%20%20%20%20if%20(!drag)%20return%3B%0A%20%20%20%20panel.style.left%20%3D%20(e.clientX%20-%20drag.dx)%20%2B%20'px'%3B%0A%20%20%20%20panel.style.top%20%20%3D%20(e.clientY%20-%20drag.dy)%20%2B%20'px'%3B%0A%20%20%20%20panel.style.right%20%3D%20'auto'%3B%0A%20%20%20%20panel.style.bottom%20%3D%20'auto'%3B%0A%20%20%7D)%3B%0A%20%20window.addEventListener('mouseup'%2C%20()%20%3D%3E%20%7B%0A%20%20%20%20if%20(drag)%20%7B%20drag%20%3D%20null%3B%20saveSettings()%3B%20%7D%0A%20%20%7D)%3B%0A%0A%20%20let%20lastGui%20%3D%200%3B%0A%20%20function%20refreshGui()%20%7B%0A%20%20%20%20const%20now%20%3D%20performance.now()%3B%0A%20%20%20%20if%20(now%20-%20lastGui%20%3C%20250)%20return%3B%0A%20%20%20%20lastGui%20%3D%20now%3B%0A%20%20%20%20for%20(const%20%5Bname%2C%20s%5D%20of%20Object.entries(stats))%20%7B%0A%20%20%20%20%20%20const%20el%20%3D%20rowEls%5Bname%5D%3F.querySelector('.stats')%3B%0A%20%20%20%20%20%20if%20(!el)%20continue%3B%0A%20%20%20%20%20%20el.textContent%20%3D%20s.errs%20%3F%20%60%24%7Bs.fires%7D%20(%24%7Bs.errs%7D!)%60%20%3A%20%60%24%7Bs.fires%7D%60%3B%0A%20%20%20%20%20%20el.classList.toggle('err'%2C%20s.errs%20%3E%200)%3B%0A%20%20%20%20%7D%0A%20%20%20%20const%20peakRow%20%3D%20document.getElementById('__auto_peak_row')%3B%0A%20%20%20%20if%20(peakRow)%20%7B%0A%20%20%20%20%20%20peakRow.querySelector('.peak-rate').textContent%20%3D%20fmtExp(peak.rate)%3B%0A%20%20%20%20%20%20peakRow.querySelector('.peak-ip').textContent%20%3D%0A%20%20%20%20%20%20%20%20peak.ip%20%3D%3D%20null%20%3F%20'%E2%80%94'%20%3A%20'(at%20'%20%2B%20fmtExp(peak.ip)%20%2B%20')'%3B%0A%20%20%20%20%7D%0A%20%20%20%20panel.querySelector('.uptime').textContent%20%3D%20Math.floor((now%20-%20startedAt)%20%2F%201000)%20%2B%20's'%3B%0A%20%20%20%20const%20total%20%3D%20Object.values(stats).reduce((a%2C%20s)%20%3D%3E%20a%20%2B%20s.fires%2C%200)%3B%0A%20%20%20%20panel.querySelector('.totals').textContent%20%3D%20total%20%2B%20'%20fires'%3B%0A%20%20%7D%0A%0A%20%20const%20api%20%3D%20%7B%0A%20%20%20%20config%2C%20stats%2C%20handlerPaths%2C%20gates%2C%0A%20%20%20%20get%20peak()%20%7B%20return%20peak%3B%20%7D%2C%0A%20%20%20%20stop()%20%7B%0A%20%20%20%20%20%20clearInterval(intervalId)%3B%0A%20%20%20%20%20%20clearInterval(peakIntervalId)%3B%0A%20%20%20%20%20%20panel.remove()%3B%0A%20%20%20%20%20%20delete%20window.__auto%3B%0A%20%20%20%20%20%20console.log('auto%20stopped.%20stats%3A'%2C%20stats)%3B%0A%20%20%20%20%7D%2C%0A%20%20%20%20status()%20%7B%0A%20%20%20%20%20%20console.table(Object.entries(config).map((%5Bname%2C%20c%5D)%20%3D%3E%20(%7B%0A%20%20%20%20%20%20%20%20name%2C%20tab%3A%20c.tab%2C%20enabled%3A%20c.enabled%2C%20period%3A%20c.period%2C%0A%20%20%20%20%20%20%20%20amount%3A%20c.amount%20%3F%3F%20'-'%2C%20fires%3A%20stats%5Bname%5D.fires%2C%20errs%3A%20stats%5Bname%5D.errs%2C%0A%20%20%20%20%20%20%7D)))%3B%0A%20%20%20%20%7D%2C%0A%20%20%20%20resetSettings()%20%7B%0A%20%20%20%20%20%20try%20%7B%20localStorage.removeItem(STORAGE_KEY)%3B%20%7D%20catch%20%7B%7D%0A%20%20%20%20%20%20console.log('auto%20settings%20cleared.%20re-paste%20the%20snippet%20to%20apply%20defaults.')%3B%0A%20%20%20%20%7D%2C%0A%20%20%7D%3B%0A%20%20window.__auto%20%3D%20api%3B%0A%20%20console.log('auto%20running.%20window.__auto.stop()%20to%20stop%2C%20window.__auto.status()%20for%20table.')%3B%0A%7D)()%3B%0Avoid(0);
//
// STOP:
// javascript:(()=>{if(window.__auto)window.__auto.stop();else console.log('nothing running');})();void(0);
//
// RESET:
// javascript:(()=>{try{localStorage.removeItem('__auto_settings_v1');console.log('cleared')}catch(e){console.warn(e)}})();void(0);
